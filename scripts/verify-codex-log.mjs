import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const allowEmpty = args.has("--allow-empty");
const minEntriesArg = [...args].find((arg) => arg.startsWith("--min-entries="));
const minEntries = minEntriesArg ? Number(minEntriesArg.split("=")[1]) : 1;
const templatePath = resolve("docs/codex-iteration-log.md");
const logDir = resolve("docs/codex-logs");
const sessionPath = resolve(".codex/candidate-session.json");
const aiConversationLogPath = resolve("src/data/aiConversationLog.ts");

function fail(message) {
  console.error(`codex log check failed: ${message}`);
  process.exit(1);
}

function readText(path, label) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    fail(`${label} does not exist`);
  }
}

function getSessionLogPath() {
  if (!existsSync(sessionPath)) return null;

  let session;

  try {
    session = JSON.parse(readFileSync(sessionPath, "utf8"));
  } catch {
    fail(".codex/candidate-session.json is not valid JSON");
  }

  if (!session.markdownLogPath || typeof session.markdownLogPath !== "string") {
    fail(".codex/candidate-session.json is missing markdownLogPath");
  }

  return resolve(session.markdownLogPath);
}

function getLatestLogPath() {
  if (!existsSync(logDir)) return null;

  const files = readdirSync(logDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => resolve(logDir, file))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  return files[0] ?? null;
}

function hasUiConversationEntries() {
  const content = readText(aiConversationLogPath, "src/data/aiConversationLog.ts");
  return !/aiConversationLogEntries:\s*AiConversationLogEntry\[\]\s*=\s*\[\s*\]/.test(content);
}

function validateLog(content, label) {
  const withoutCodeFences = content.replace(/```[\s\S]*?```/g, "");
  const logIntro = withoutCodeFences.split(/^##\s+/m)[0] ?? "";
  const candidateNameMatch = logIntro.match(/^候选人名称：(.+)$/m);

  if (!candidateNameMatch) {
    fail(`${label} must contain 候选人名称：... before iteration records`);
  }

  const candidateName = candidateNameMatch[1].trim();

  if (!candidateName || candidateName === "待填写") {
    fail(`${label} must contain the current candidate's real name`);
  }

  const entries = withoutCodeFences
    .split(/^##\s+/m)
    .slice(1)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    if (allowEmpty) {
      console.log(`codex log check passed: ${label} exists, no iteration entries yet`);
      return;
    }

    fail(`${label} has no iteration entries`);
  }

  if (entries.length < minEntries) {
    fail(`${label} expected at least ${minEntries} iteration entries, found ${entries.length}`);
  }

  const requiredSections = [
    "### 用户输入",
    "### AI 最终输出",
    "### 本轮改动文件",
    "### 验证结果",
  ];

  entries.forEach((entry, index) => {
    const line = entry.split("\n")[0]?.trim() ?? "";

    if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\([+-]\d{4}\)/.test(line)) {
      fail(`${label} entry ${index + 1} has invalid time heading: "${line}"`);
    }

    requiredSections.forEach((section) => {
      if (!entry.includes(section)) {
        fail(`${label} entry ${index + 1} is missing section "${section}"`);
      }
    });
  });

  console.log(`codex log check passed: ${label} has ${entries.length} iteration entr${entries.length === 1 ? "y" : "ies"}`);
}

const template = readText(templatePath, "docs/codex-iteration-log.md");

if (!template.includes("Codex 迭代记录模板") || !template.includes("docs/codex-logs/")) {
  fail("docs/codex-iteration-log.md must remain a template that points to docs/codex-logs/");
}

const activeLogPath = getSessionLogPath() ?? getLatestLogPath();

if (!activeLogPath) {
  if (allowEmpty || !hasUiConversationEntries()) {
    console.log("codex log check passed: template exists, no personal candidate log yet");
    process.exit(0);
  }

  fail('no personal candidate log found; ask the candidate for their name, then run pnpm codex:init-log -- --name="<候选人姓名>"');
}

validateLog(readText(activeLogPath, activeLogPath), activeLogPath);
