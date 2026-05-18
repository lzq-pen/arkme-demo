# Codex Interview Upload

本文件用于本地验证候选人 Codex 过程日志是否能按“每轮对话结束后触发一次”的准实时语义上传到线上 OSS。

## 实时定义

这里的“实时”不是每秒同步，也不是流式同步，而是：

```text
每次完整的用户输入 + AI 回复结束后，先写入本地日志，再触发一次上传。
```

每次上传会更新两个文件槽位：

- `codex.iteration_markdown`
- `codex.iteration_ui_data`

每次上传都是完整文件上传：

- 上传完整的当前候选人个人 Markdown 日志，包含该候选人日志初始化以来所有已记录轮次。
- 上传完整的 `src/data/aiConversationLog.ts`，包含当前候选人的全部 UI 对话数据。
- 不是只上传本轮新增内容，也不是从首次启用云端上传开始的增量。
- 如果项目里存在旧的 `docs/codex-archives/` 或 `src/data/ai-conversation-archives/`，应先合并到 `docs/codex-logs/` 下的当前统一 Markdown 日志和 `src/data/aiConversationLog.ts`，再上传完整文件。

## 环境变量

默认服务 Host：

```text
https://team.jotmo.cc
```

服务端会在 `register` 时签发或复用 `candidate_uid` 和 `exam_key`，脚本会把它们写回 `.codex/candidate-session.json`。不要手工生成或填写这两个主键。

可选覆盖服务 Host：

```sh
export CODEX_INTERVIEW_API_BASE="https://team.jotmo.cc"
```

可选 Codex 会话标识：

```sh
export CODEX_INTERVIEW_CODEX_SESSION_ID="<optional-codex-session-id>"
```

不要从候选人姓名、本机用户名、Git 信息、目录名或时间戳推断 `candidate_uid` 和 `exam_key`。

## 本地 dry-run

dry-run 只打印请求体，不调用线上接口：

```sh
pnpm codex:upload-interview -- --dry-run
```

## 真实上传

```sh
pnpm codex:upload-interview
```

脚本会执行：

1. `POST /api/public/v1/interview/sessions/register`
2. 把 `register` 返回的 `candidate_uid` 和 `exam_key` 写回 `.codex/candidate-session.json`
3. 对 `codex.iteration_markdown` 调用 `prepare-upload`
4. 对返回的 `upload_url` 执行 `PUT`
5. 对 `codex.iteration_ui_data` 调用 `prepare-upload`
6. 对返回的 `upload_url` 执行 `PUT`

成功后会在本地写入：

```text
.codex/interview-upload-last.json
```

研发同事可以用其中的 `object_key`、`prepare_uid`、`sha256` 和线上 latest 指针核对每轮是否产生了新上传。
该文件也会记录每个上传文件的 `entry_count`，用于快速核对本地记录条数和云端解析条数是否一致。
