import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/candidate-rules.md",
  "docs/codex-iteration-log.md",
  "src/data/aiConversationLog.ts",
  "scripts/ensure-candidate-log.mjs",
  "scripts/verify-codex-log.mjs",
  "scripts/verify-answer-standard.mjs",
];

function fail(message) {
  console.error(`answer standard check failed: ${message}`);
  process.exit(1);
}

requiredFiles.forEach((file) => {
  if (!existsSync(resolve(file))) {
    fail(`${file} does not exist`);
  }
});

const agents = readFileSync("AGENTS.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const candidateRules = readFileSync("docs/candidate-rules.md", "utf8");
const codexLog = readFileSync("docs/codex-iteration-log.md", "utf8");
const aiConversationLog = readFileSync("src/data/aiConversationLog.ts", "utf8");
const ensureCandidateLog = readFileSync("scripts/ensure-candidate-log.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts ?? {};

const requiredMentions = [
  ["AGENTS.md", agents, "docs/candidate-rules.md"],
  ["AGENTS.md", agents, "Pre-Response Log Check"],
  ["AGENTS.md", agents, "docs/codex-logs/"],
  ["AGENTS.md", agents, ".codex/candidate-session.json"],
  ["AGENTS.md", agents, "cannot be inferred from GitHub"],
  ["AGENTS.md", agents, "src/data/aiConversationLog.ts"],
  ["AGENTS.md", agents, "候选人名称"],
  ["AGENTS.md", agents, "pnpm verify:answer"],
  ["README.md", readme, "docs/candidate-rules.md"],
  ["README.md", readme, "本地测试入口"],
  ["README.md", readme, "http://127.0.0.1:5173/"],
  ["README.md", readme, "http://127.0.0.1:5173/sendtest"],
  ["README.md", readme, "安排"],
  ["docs/candidate-rules.md", candidateRules, "新一轮对话前置检查"],
  ["docs/candidate-rules.md", candidateRules, "src/data/aiConversationLog.ts"],
  ["docs/candidate-rules.md", candidateRules, "docs/codex-logs/"],
  ["docs/candidate-rules.md", candidateRules, ".codex/candidate-session.json"],
  ["docs/candidate-rules.md", candidateRules, "候选人名称"],
  ["docs/candidate-rules.md", candidateRules, "不能从 GitHub"],
  ["docs/codex-iteration-log.md", codexLog, "Codex 迭代记录模板"],
  ["docs/codex-iteration-log.md", codexLog, "docs/codex-logs/"],
  ["scripts/ensure-candidate-log.mjs", ensureCandidateLog, "markdownLogPath"],
];

requiredMentions.forEach(([file, content, phrase]) => {
  if (!content.includes(phrase)) {
    fail(`${file} must mention ${phrase}`);
  }
});

if (!scripts["verify:codex-log"]) {
  fail("package.json is missing scripts.verify:codex-log");
}

if (!scripts["codex:init-log"]) {
  fail("package.json is missing scripts.codex:init-log");
}

if (!scripts["verify:answer-standard"]) {
  fail("package.json is missing scripts.verify:answer-standard");
}

if (!scripts["verify:answer"]) {
  fail("package.json is missing scripts.verify:answer");
}

if (!scripts["verify:answer"].includes("pnpm lint")) {
  fail("scripts.verify:answer must run pnpm lint");
}

if (!scripts["verify:answer"].includes("pnpm build")) {
  fail("scripts.verify:answer must run pnpm build");
}

if (!scripts["verify:answer"].includes("pnpm verify:codex-log")) {
  fail("scripts.verify:answer must run pnpm verify:codex-log");
}

if (!scripts["verify:answer"].includes("pnpm verify:answer-standard")) {
  fail("scripts.verify:answer must run pnpm verify:answer-standard");
}

[
  "aiConversationLogEntries",
  "timestamp",
  "userInput",
  "aiFinalOutput",
  "changedFiles",
  "verification",
].forEach((phrase) => {
  if (!aiConversationLog.includes(phrase)) {
    fail(`src/data/aiConversationLog.ts must include ${phrase}`);
  }
});

console.log("answer standard check passed");
