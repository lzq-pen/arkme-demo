import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const nameArg = args.find((arg) => arg.startsWith("--name="));
const sessionPath = resolve(".codex/candidate-session.json");

function fail(message) {
  console.error(`candidate log init failed: ${message}`);
  process.exit(1);
}

function optionalCommand(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function slugify(value, fallback) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function readSession() {
  if (!existsSync(sessionPath)) return null;

  try {
    return JSON.parse(readFileSync(sessionPath, "utf8"));
  } catch {
    fail(".codex/candidate-session.json is not valid JSON");
  }
}

const existingSession = readSession();

if (existingSession?.markdownLogPath && existsSync(resolve(existingSession.markdownLogPath))) {
  console.log(`candidate log already initialized: ${existingSession.markdownLogPath}`);
  process.exit(0);
}

const candidateName = nameArg?.slice("--name=".length).trim();

if (!candidateName) {
  fail('missing --name="<候选人姓名>"; ask the candidate for their real name before creating a personal log');
}

const osUser = optionalCommand("whoami", []) || process.env.USER || "local";
const osUserSlug = slugify(osUser, "local-user");
const nameSlug = slugify(candidateName, "candidate");
const now = new Date();
const timestamp = now
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "");
const shortHash = createHash("sha1")
  .update(`${candidateName}:${osUserSlug}:${timestamp}:${process.cwd()}`)
  .digest("hex")
  .slice(0, 8);
const markdownLogPath = `docs/codex-logs/candidate-${nameSlug}-${osUserSlug}-${timestamp}-${shortHash}.md`;
const markdownLogAbsPath = resolve(markdownLogPath);

mkdirSync(dirname(markdownLogAbsPath), { recursive: true });
mkdirSync(dirname(sessionPath), { recursive: true });

const logContent = `# Codex 迭代记录

候选人名称：${candidateName}

本文件用于记录当前候选人在 Codex 客户端中迭代本项目的过程。每完成一次 Codex 迭代，都需要在文件末尾追加一条记录。
`;

writeFileSync(markdownLogAbsPath, `${logContent}\n`, "utf8");
writeFileSync(
  sessionPath,
  `${JSON.stringify(
    {
      candidateName,
      markdownLogPath,
      createdAt: now.toISOString(),
      osUser,
      shortHash,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`candidate log initialized: ${markdownLogPath}`);
