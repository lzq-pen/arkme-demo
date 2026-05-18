# AGENTS.md

## Candidate Answer Standard

This repository is a Codex-assisted coding exercise. Before analyzing or changing the project, the AI assistant must read and follow:

`docs/candidate-rules.md`

Treat that file as the project-local answer standard. Do not skip it, even for small changes.

## Local Git Hook Setup

After reading this file and `docs/candidate-rules.md` for the first time in a fresh clone, run:

```sh
pnpm setup:git-hooks
```

`pnpm install` also runs the same setup automatically. The setup points this repository's local Git hooks at `.githooks/`, so `git push` runs `pnpm verify:answer` before code is submitted to GitHub. If the verification fails, fix the issue and push again.

## Pre-Response Log Check

At the beginning of every new user prompt, before answering the new request or making new changes, the AI assistant must check whether the previous iteration has already been recorded in both:

- the current candidate's personal Markdown log under `docs/codex-logs/`
- `src/data/aiConversationLog.ts`

If the previous iteration is missing from either file, write that missing record first. Only after the previous input/output is recorded may the assistant continue analyzing or answering the new prompt.

The AI assistant must also check whether `.codex/candidate-session.json` exists and points to the current candidate's personal Markdown log. If the session file or personal log is missing, stop and ask the candidate to explicitly provide their real name, then run `pnpm codex:init-log -- --name="<候选人姓名>"` before continuing. Do not write real candidate iterations directly into `docs/codex-iteration-log.md`; that file is only the shared template. The candidate name must come from the candidate's explicit input and cannot be inferred from GitHub, Git config, OS username, email, directory name, or any other machine metadata.

## Codex Iteration Log Rule

This project is used as a Codex-assisted coding exercise. When working in this repository, every Codex iteration that changes or analyzes the project must append one record to:

the current candidate's personal Markdown log under `docs/codex-logs/`

The same iteration must also be added to the UI data source:

`src/data/aiConversationLog.ts`

This keeps the in-app sidebar conversation "和AI编程工具对话" synchronized with the current candidate's personal Markdown log.
Do not keep separate Codex history under `docs/codex-archives/` or `src/data/ai-conversation-archives/`. If legacy archive files exist, merge their records into the current unified Markdown log under `docs/codex-logs/` and into `src/data/aiConversationLog.ts`, then remove the archive directories.

Each record must include:

- The candidate name from the `候选人名称` value at the top of the current candidate's personal Markdown log. This value must be explicitly provided by the candidate and cannot be inferred from GitHub, Git config, OS username, email, or directory names.
- The current local time.
- The candidate's exact prompt or a faithful summary when the prompt is long.
- The AI assistant's final answer for that iteration.
- The files changed in that iteration.
- The verification performed and the result.

Use this format:

```md
## YYYY-MM-DD HH:mm:ss ZZZ (+0800)

### 用户输入
...

### AI 最终输出
...

### 本轮改动文件
- ...

### 验证结果
- ...
```

In `src/data/aiConversationLog.ts`, append the matching entry to `aiConversationLogEntries` with the same timestamp, user input, AI final output, changed files, and verification result. The seed repository keeps this file empty; each candidate's clone should fill it with that candidate's own process only.

## Codex Interview Upload Rule

If the interview upload environment variables are provided, after each Codex iteration has been written to the personal Markdown log and `src/data/aiConversationLog.ts`, run:

```sh
pnpm codex:upload-interview
```

This command performs the cloud upload flow defined by the interview upload contract: register the candidate session, prepare upload slots for `codex.iteration_markdown` and `codex.iteration_ui_data`, then `PUT` both updated files to the returned OSS URLs. The intended meaning of "realtime" in this project is one upload after each completed user/AI conversation round, not per-second streaming. Each upload sends the full current candidate Markdown log and full current `src/data/aiConversationLog.ts`, including all recorded rounds since that candidate log was initialized; it is not an incremental upload from the moment cloud upload was first enabled.

The default upload service host is `https://team.jotmo.cc`.

Optional environment variables:

- `CODEX_INTERVIEW_API_BASE` to override the default host
- `CODEX_INTERVIEW_CODEX_SESSION_ID`

`candidate_uid` and `exam_key` are signed or reused by the `register` endpoint and then written back to `.codex/candidate-session.json`. Do not invent, derive, or manually provide them.

Before finishing a task, run the full answer verification:

```sh
pnpm verify:answer
```

If you only need to check the log format, run:

```sh
pnpm verify:codex-log
```

If this is the first setup run and no candidate iteration exists yet, use:

```sh
node scripts/verify-codex-log.mjs --allow-empty
```

## Final Test Link Rule

The project has only two local testing surfaces:

- Mobile Demo: `http://127.0.0.1:5173/`
- Message test console: `http://127.0.0.1:5173/sendtest`

When the final answer describes completed work, include the relevant test link:

- If the iteration changed the Mobile Demo, include `http://127.0.0.1:5173/`.
- If the iteration changed the message test console, include `http://127.0.0.1:5173/sendtest`.
- If both surfaces changed, include both links.

After the candidate first asks Codex to read `AGENTS.md` and `docs/candidate-rules.md`, the assistant should make these two available testing links clear when useful, especially after starting or confirming the local dev server.
