import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const sessionPath = resolve(".codex/candidate-session.json");
const aiConversationLogPath = resolve("src/data/aiConversationLog.ts");
const uploadStatePath = resolve(".codex/interview-upload-last.json");
const defaultApiBase = "https://team.jotmo.cc";

const endpoints = {
  register: "/api/public/v1/interview/sessions/register",
  prepareUpload: "/api/public/v1/interview/files/prepare-upload",
};

function fail(message) {
  console.error(`interview upload failed: ${message}`);
  process.exit(1);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${label} is missing or invalid JSON`);
  }
}

function normalizeApiBase(value) {
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    fail(`CODEX_INTERVIEW_API_BASE is not a valid URL: ${value}`);
  }
}

function writeSession(session) {
  writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function countIterationEntries(filePath, content) {
  if (filePath.endsWith(".md")) {
    return content.match(/^## \d{4}-\d{2}-\d{2} /gm)?.length ?? 0;
  }

  if (filePath.endsWith("aiConversationLog.ts")) {
    return content.match(/timestamp: "/g)?.length ?? 0;
  }

  return null;
}

function getCandidateNameFromLog(path) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^候选人名称：(.+)$/m);
  const candidateName = match?.[1]?.trim();

  if (!candidateName || candidateName === "待填写") {
    fail(`${path} must contain 候选人名称：<候选人真实姓名>`);
  }

  return candidateName;
}

function buildUrl(apiBase, path) {
  return `${apiBase}${path}`;
}

async function postJson(apiBase, path, body) {
  const response = await fetch(buildUrl(apiBase, path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    fail(`${path} returned non-JSON response: ${text.slice(0, 240)}`);
  }

  if (!response.ok || payload?.code !== 200) {
    fail(`${path} failed with HTTP ${response.status}: ${text}`);
  }

  return payload.data;
}

async function putFile(uploadUrl, uploadHeaders, fileBuffer) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders ?? {},
    body: fileBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    fail(`OSS PUT failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
}

function getUploadTargets(markdownLogPath) {
  return [
    {
      artifact_key: "codex.iteration_markdown",
      filePath: markdownLogPath,
      content_type: "text/markdown; charset=utf-8",
    },
    {
      artifact_key: "codex.iteration_ui_data",
      filePath: aiConversationLogPath,
      content_type: "text/plain; charset=utf-8",
    },
  ];
}

async function main() {
  if (!existsSync(sessionPath)) {
    fail('.codex/candidate-session.json does not exist; run pnpm codex:init-log -- --name="<候选人姓名>" first');
  }

  const session = readJson(sessionPath, ".codex/candidate-session.json");

  if (!session.markdownLogPath || typeof session.markdownLogPath !== "string") {
    fail(".codex/candidate-session.json is missing markdownLogPath");
  }

  const markdownLogPath = resolve(session.markdownLogPath);

  if (!existsSync(markdownLogPath)) {
    fail(`candidate markdown log does not exist: ${markdownLogPath}`);
  }

  if (!existsSync(aiConversationLogPath)) {
    fail(`AI conversation log does not exist: ${aiConversationLogPath}`);
  }

  const apiBase = normalizeApiBase(process.env.CODEX_INTERVIEW_API_BASE?.trim() || defaultApiBase);
  const codexSessionId = process.env.CODEX_INTERVIEW_CODEX_SESSION_ID?.trim() || undefined;
  const candidateName = getCandidateNameFromLog(markdownLogPath);
  const localUsername = userInfo().username || process.env.USER || "local";

  const registerBody = {
    candidate_name: candidateName,
    local_username: localUsername,
    candidate_session_path: sessionPath,
    candidate_markdown_log_path: markdownLogPath,
    ai_conversation_log_path: aiConversationLogPath,
    context_refs: [],
    ...(codexSessionId ? { codex_session_id: codexSessionId } : {}),
  };
  const dryRunCandidateUid = session.candidateUid ?? "<candidate_uid from register>";
  const dryRunExamKey = session.examKey ?? "<exam_key from register>";

  const targets = getUploadTargets(markdownLogPath).map((target) => {
    const buffer = readFileSync(target.filePath);
    const content = buffer.toString("utf8");
    const stats = statSync(target.filePath);

    return {
      ...target,
      file_name: basename(target.filePath),
      declared_size: stats.size,
      sha256: sha256(buffer),
      entry_count: countIterationEntries(target.filePath, content),
      buffer,
    };
  });

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          apiBase,
          register: {
            endpoint: endpoints.register,
            url: buildUrl(apiBase, endpoints.register),
            body: registerBody,
          },
          uploads: targets.map(({ buffer: _buffer, ...target }) => ({
            endpoint: endpoints.prepareUpload,
            url: buildUrl(apiBase, endpoints.prepareUpload),
            prepare_upload_body: {
              candidate_uid: dryRunCandidateUid,
              exam_key: dryRunExamKey,
              artifact_key: target.artifact_key,
              file_name: target.file_name,
              content_type: target.content_type,
              declared_size: target.declared_size,
              sha256: target.sha256,
              entry_count: target.entry_count,
              ...(codexSessionId ? { codex_session_id: codexSessionId } : {}),
            },
            file_path: target.filePath,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  const registered = await postJson(apiBase, endpoints.register, registerBody);
  const candidateUid = registered?.candidate_uid;
  const examKey = registered?.exam_key;

  if (!candidateUid || !examKey) {
    fail("register response is missing candidate_uid or exam_key");
  }

  const updatedSession = {
    ...session,
    candidateUid,
    examKey,
    uploadRegisteredAt: new Date().toISOString(),
  };

  writeSession(updatedSession);
  console.log(`registered interview session: candidate_uid=${candidateUid}, exam_key=${examKey}`);

  const uploaded = [];

  for (const target of targets) {
    const prepareBody = {
      candidate_uid: candidateUid,
      exam_key: examKey,
      artifact_key: target.artifact_key,
      file_name: target.file_name,
      content_type: target.content_type,
      declared_size: target.declared_size,
      sha256: target.sha256,
      ...(codexSessionId ? { codex_session_id: codexSessionId } : {}),
    };

    const prepared = await postJson(apiBase, endpoints.prepareUpload, prepareBody);
    await putFile(prepared.upload_url, prepared.upload_headers, target.buffer);

    uploaded.push({
      artifact_key: target.artifact_key,
      file_path: target.filePath,
      file_name: target.file_name,
      declared_size: target.declared_size,
      sha256: target.sha256,
      entry_count: target.entry_count,
      prepare_uid: prepared.prepare_uid,
      object_key: prepared.object_key,
      expire_at: prepared.expire_at,
      ttl_seconds: prepared.ttl_seconds,
    });

    const entryCountLabel = target.entry_count === null ? "" : ` (${target.entry_count} entries)`;
    console.log(`uploaded ${target.artifact_key}${entryCountLabel}: ${prepared.object_key}`);
  }

  const state = {
    uploadedAt: new Date().toISOString(),
    apiBase,
    candidate_uid: candidateUid,
    exam_key: examKey,
    codex_session_id: codexSessionId ?? null,
    uploaded,
  };

  mkdirSync(dirname(uploadStatePath), { recursive: true });
  writeFileSync(uploadStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`interview upload completed: ${uploadStatePath}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
