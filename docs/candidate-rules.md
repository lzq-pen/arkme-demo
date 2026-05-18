# 候选人答题规范

本项目用于考察候选人使用 AI 编程工具完成前端需求迭代的能力。候选人需要在 Codex 客户端中打开本项目，并让 Codex 按本规范完成需求分析、代码修改、验证和记录。

## 开始答题

候选人开始前应在 Codex 中明确输入类似内容：

```text
请先阅读 AGENTS.md 和 docs/candidate-rules.md，然后按其中的答题规范完成后续需求。
```

AI 助手在执行任何需求前，必须先理解：

- 项目是移动端优先的即我 Demo。
- 当前项目只保留首页、侧边栏、快记、洞见占位、我的等基础结构。
- “安排”模块是候选人后续需要根据题目新增的能力，初始项目不应预置安排模块实现。
- 每次迭代都必须更新当前候选人在 `docs/codex-logs/` 下的个人 Markdown 日志。
- 每次迭代也必须同步更新 `src/data/aiConversationLog.ts`，让应用内“和AI编程工具对话”能展示本轮输入输出。
- 所有 Codex 历史都应统一收敛到当前个人 Markdown 日志和 `src/data/aiConversationLog.ts`。不要再维护 `docs/codex-archives/` 或 `src/data/ai-conversation-archives/`；如果发现旧归档，先合并到统一日志和 UI 数据源，再删除归档目录。
- 首次读取规范后，AI 助手需要运行 `pnpm setup:git-hooks`。`pnpm install` 也会自动执行同一设置；设置完成后，候选人 `git push` 到 GitHub 前会自动运行 `pnpm verify:answer`。

## 新一轮对话前置检查

候选人每次在 AI 编程工具中输入新的需求后，AI 助手在回答或修改代码前，必须先检查上一轮输入输出是否已经写入：

- `.codex/candidate-session.json` 指向的当前候选人个人 Markdown 日志
- `src/data/aiConversationLog.ts`

如果上一轮记录缺失，必须先补齐上一轮记录，再继续处理新的需求。

同时，AI 助手必须检查 `.codex/candidate-session.json` 是否存在，并确认其中的 `markdownLogPath` 指向当前候选人的个人日志。如果本机会话文件或个人日志缺失，必须先引导候选人明确输入自己的真实姓名；拿到姓名后先创建 `docs/codex-logs/candidate-<候选人明确输入的姓名>-<本机用户名>-<时间戳>-<短哈希>.md`，再继续写入本轮迭代记录或进行后续分析。`候选人名称` 只能来自候选人明确输入，不能从 GitHub、Git 配置、本机用户名、邮箱、目录名或其他机器元数据推断。`docs/codex-iteration-log.md` 只作为共享模板，不写入真实迭代记录。

## 每轮迭代要求

每轮 Codex 迭代应尽量遵循以下步骤：

1. 先检查上一轮输入输出是否已经写入 Markdown 日志和 UI 数据源。
2. 检查 `.codex/candidate-session.json` 是否已指向当前候选人的个人日志；未初始化时先引导候选人明确输入真实姓名并创建个人日志。
3. 再复述本轮需求和影响范围。
4. 阅读相关代码后再修改。
5. 修改范围保持聚焦，不做无关重构。
6. 完成后运行必要验证，至少包括 `pnpm lint` 和 `pnpm build`。
7. 将本轮时间、用户输入、AI 最终输出、改动文件、验证结果追加到当前候选人的个人 Markdown 日志。
8. 将同一轮记录追加到 `src/data/aiConversationLog.ts` 的 `aiConversationLogEntries`，保持界面展示与 Markdown 日志一致。
9. 如果外部面试平台或上层提示词提供了云端上报环境变量，在本轮记录写入完成后运行 `pnpm codex:upload-interview`，把更新后的个人 Markdown 日志和 `src/data/aiConversationLog.ts` 上传到 OSS。这里的“实时”指每次完整的用户输入和 AI 回复结束后触发一次，不是按秒流式同步。每次上传的都是当前候选人个人 Markdown 日志和 `src/data/aiConversationLog.ts` 的完整文件，包含该候选人日志初始化以来所有已记录轮次，不是从首次启用云端上传开始的增量。

默认服务 Host 为 `https://team.jotmo.cc`。如需覆盖默认 Host，可额外提供 `CODEX_INTERVIEW_API_BASE`。

`candidate_uid` 和 `exam_key` 由 `register` 接口签发或复用，并写回 `.codex/candidate-session.json`。不允许从姓名、本机用户名、Git 信息、目录名或时间戳推断，也不允许手工生成。

## 最终输出测试链接

本项目只保留两个本地测试入口：

- 移动端 Demo：`http://127.0.0.1:5173/`
- 消息测试后台：`http://127.0.0.1:5173/sendtest`

AI 助手完成一轮改动后的最终回复必须按影响范围给出测试链接：

- 如果本轮改动影响移动端 Demo，最终回复必须包含 `http://127.0.0.1:5173/`。
- 如果本轮改动影响消息测试后台，最终回复必须包含 `http://127.0.0.1:5173/sendtest`。
- 如果两端都受影响，最终回复必须同时包含两个链接。

候选人一开始要求 Codex 阅读 `AGENTS.md` 和 `docs/candidate-rules.md` 后，AI 助手应在后续需要测试时明确这些入口，避免候选人不知道该打开哪个页面。

## 最终提交要求

候选人不需要记住手动运行验证命令。本项目会在 `pnpm install` 时自动安装本地 Git `pre-push` 钩子；AI 助手首次读取规范后也应主动运行：

```sh
pnpm setup:git-hooks
```

设置完成后，候选人执行 `git push` 时会自动运行：

```sh
pnpm verify:answer
```

该命令用于检查：

- 项目可以通过 lint。
- 项目可以完成生产构建。
- Codex 迭代日志存在且格式正确。
- 应用内 AI 对话数据源存在且包含必要字段。
- 答题规范文件和项目说明仍然存在。

如果验证不通过，`git push` 会被拦截；修复问题后再次 push 即可。

## 记录边界

本项目内的记录机制用于观察候选人的 AI 协作过程，不是防作弊系统。候选人应保持记录真实、完整、可追溯。
