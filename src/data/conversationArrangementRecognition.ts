import {
  appendArrangement,
  getInitialArrangements,
  isArrangementImportance,
  isArrangementUrgency,
  isDateKey,
  isTimeValue,
  persistArrangements,
  parseDateKey,
  toDateKey,
  type ArrangementImportance,
  type ArrangementItem,
  type ArrangementReminder,
  type ArrangementSourceContext,
  type ArrangementSourceType,
  type ArrangementUrgency,
} from "@/data/arrangements";
import {
  appendAiRecognitionLog,
  createAiRecognitionLogId,
  hasProcessedAiRecognitionKey,
  markAiRecognitionKeysProcessed,
  updateAiRecognitionLog,
  type AiRecognitionAction,
  type AiRecognitionChatType,
  type AiRecognitionUpdateIntent,
} from "@/data/aiRecognitionLogs";
import { getInitialUserPhraseMemories } from "@/data/userPhraseMemories";

export type AiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  arrangementRecognitionEnabled: boolean;
};

export type ChatCompletionsResponseBody = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: unknown } }>;
};

export type ConversationRecognitionMessage = {
  messageId: string;
  senderId: string;
  senderName: string;
  isMe: boolean;
  text: string;
  createdAt: number;
};

export type ConversationRecognitionContext = {
  chatType: AiRecognitionChatType;
  conversationId: string;
  conversationName: string;
  currentUserName: string;
  triggerMessageId: string;
  triggerText: string;
  messages: ConversationRecognitionMessage[];
  settings: AiSettings;
};

type ArrangementRecognitionResult = {
  action: AiRecognitionAction;
  confidence: number;
  existingArrangementId?: string;
  title?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  timeText?: string;
  note?: string;
  reminder?: ArrangementReminder;
  updateIntent?: AiRecognitionUpdateIntent;
  patchReason?: string;
  importance: ArrangementImportance;
  urgency: ArrangementUrgency;
  relatedPeople: string[];
  sourceMessageIds: string[];
  reason?: string;
};

const autoArrangementConfidenceThreshold = 0.75;
const autoResolveConfidenceThreshold = 0.85;
const duplicateTextRecognitionWindowMs = 5000;
const inFlightRecognitionKeys = new Set<string>();

function encodeRecognitionKeyPart(value: string) {
  return encodeURIComponent(value.trim());
}

function getLastContextMessageId(context: ConversationRecognitionContext) {
  return (
    [...context.messages]
      .filter((message) => message.text.trim())
      .sort((left, right) => left.createdAt - right.createdAt)
      .at(-1)?.messageId || context.triggerMessageId
  );
}

function getTriggerMessage(context: ConversationRecognitionContext) {
  return context.messages.find((message) => message.messageId === context.triggerMessageId);
}

function normalizeRecognitionFingerprintText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000，。、“”‘’：:；;,.!?！？、（）()[\]【】《》<>]/g, "")
    .slice(0, 80);
}

function buildRecognitionKey(context: ConversationRecognitionContext) {
  return [
    "v1",
    context.chatType,
    context.conversationId,
    context.triggerMessageId,
    getLastContextMessageId(context),
  ]
    .map(encodeRecognitionKeyPart)
    .join("|");
}

function buildRecognitionTriggerKey(context: ConversationRecognitionContext) {
  return [
    "v1-trigger",
    context.chatType,
    context.conversationId,
    context.triggerMessageId,
  ]
    .map(encodeRecognitionKeyPart)
    .join("|");
}

function buildRecognitionTextKey(context: ConversationRecognitionContext) {
  const normalizedText = normalizeRecognitionFingerprintText(context.triggerText);
  if (!normalizedText) return "";

  const triggerTimestamp = getTriggerMessage(context)?.createdAt ?? Date.now();
  const timeBucket = Math.floor(triggerTimestamp / duplicateTextRecognitionWindowMs);
  return [
    "v1-text",
    context.chatType,
    context.conversationId,
    String(timeBucket),
    normalizedText,
  ]
    .map(encodeRecognitionKeyPart)
    .join("|");
}

function hasInFlightRecognitionKey(keys: string[]) {
  return keys.some((key) => inFlightRecognitionKeys.has(key));
}

function lockRecognitionKeys(keys: string[]) {
  keys.forEach((key) => inFlightRecognitionKeys.add(key));
}

function unlockRecognitionKeys(keys: string[]) {
  keys.forEach((key) => inFlightRecognitionKeys.delete(key));
}

export function getChatCompletionsUrl(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  if (normalizedBaseUrl.endsWith("/chat/completions")) return normalizedBaseUrl;
  return `${normalizedBaseUrl}/chat/completions`;
}

export function extractJsonPayload(content: string) {
  const trimmedContent = content.trim();
  const fencedMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstObjectIndex = trimmedContent.indexOf("{");
  const firstArrayIndex = trimmedContent.indexOf("[");
  const jsonStartCandidates = [firstObjectIndex, firstArrayIndex].filter(
    (index) => index >= 0
  );
  const jsonStart =
    jsonStartCandidates.length > 0 ? Math.min(...jsonStartCandidates) : -1;
  const jsonEnd = Math.max(trimmedContent.lastIndexOf("}"), trimmedContent.lastIndexOf("]"));

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return trimmedContent.slice(jsonStart, jsonEnd + 1);
  }

  return trimmedContent;
}

function stringifyForDebugLog(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function isRecognitionUpdateIntent(value: unknown): value is AiRecognitionUpdateIntent {
  return (
    value === "append_context" ||
    value === "correct_time" ||
    value === "correct_title" ||
    value === "correct_details" ||
    value === "merge_details"
  );
}

function normalizeRecognitionReminder(value: unknown): ArrangementReminder | undefined {
  if (!value || typeof value !== "object") return undefined;

  const reminder = value as Partial<ArrangementReminder>;
  if (reminder.enabled === false) return undefined;

  if (
    typeof reminder.offsetDays !== "number" ||
    !Number.isInteger(reminder.offsetDays) ||
    reminder.offsetDays < 0 ||
    !isTimeValue(reminder.time)
  ) {
    return undefined;
  }

  return {
    enabled: true,
    offsetDays: reminder.offsetDays,
    time: reminder.time,
  };
}

function normalizeArrangementRecognitionResult(value: unknown): ArrangementRecognitionResult {
  if (!value || typeof value !== "object") {
    throw new Error("模型返回格式错误：不是 JSON 对象。");
  }

  const result = value as Record<string, unknown>;
  const legacyShouldCreate = result.shouldCreate === true;
  const rawAction = getStringField(result.action);
  const action: AiRecognitionAction =
    rawAction === "create" ||
    rawAction === "update" ||
    rawAction === "ignore" ||
    rawAction === "complete" ||
    rawAction === "expire"
      ? rawAction
      : legacyShouldCreate
        ? "create"
        : "ignore";
  const confidence = normalizeConfidence(result.confidence);
  const scheduledDate = getStringField(result.scheduledDate);
  const startTime = getStringField(result.startTime);
  const endTime = getStringField(result.endTime);
  const reason = getStringField(result.reason);
  const patchReason = getStringField(result.patchReason);
  const updateIntent = isRecognitionUpdateIntent(result.updateIntent)
    ? result.updateIntent
    : undefined;

  return {
    action,
    confidence,
    ...(getStringField(result.existingArrangementId)
      ? { existingArrangementId: getStringField(result.existingArrangementId) }
      : {}),
    ...(getStringField(result.title) ? { title: getStringField(result.title) } : {}),
    ...(isDateKey(scheduledDate) ? { scheduledDate } : {}),
    ...(isTimeValue(startTime) ? { startTime } : {}),
    ...(isTimeValue(endTime) ? { endTime } : {}),
    ...(getStringField(result.timeText) ? { timeText: getStringField(result.timeText) } : {}),
    ...(getStringField(result.note) ? { note: getStringField(result.note) } : {}),
    ...(normalizeRecognitionReminder(result.reminder)
      ? { reminder: normalizeRecognitionReminder(result.reminder) }
      : {}),
    ...(updateIntent ? { updateIntent } : {}),
    ...(patchReason ? { patchReason } : {}),
    importance: isArrangementImportance(result.importance) ? result.importance : "normal",
    urgency: isArrangementUrgency(result.urgency) ? result.urgency : "normal",
    relatedPeople: normalizeStringList(result.relatedPeople),
    sourceMessageIds: normalizeStringList(result.sourceMessageIds),
    ...(reason ? { reason } : {}),
  };
}

function parseArrangementRecognition(content: string) {
  const parsedValue = JSON.parse(extractJsonPayload(content)) as unknown;
  return normalizeArrangementRecognitionResult(parsedValue);
}

function getSourceType(chatType: AiRecognitionChatType): ArrangementSourceType {
  if (chatType === "private") return "private-chat";
  if (chatType === "group") return "group-chat";
  return "self-chat";
}

function getSourceLabel(chatType: AiRecognitionChatType) {
  if (chatType === "private") return "来自私聊";
  if (chatType === "group") return "来自群聊";
  return "来自发给自己";
}

function formatContextText(messages: ConversationRecognitionMessage[]) {
  return messages
    .map((message) => `${message.senderName}${message.isMe ? "（我）" : ""}：${message.text}`)
    .join("\n");
}

function getSourceMessageIds(
  result: ArrangementRecognitionResult,
  context: ConversationRecognitionContext
) {
  return Array.from(new Set([...result.sourceMessageIds, context.triggerMessageId]));
}

function buildSourceContext(
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult,
  createdAt = Date.now()
): ArrangementSourceContext {
  const reason = result.patchReason || result.reason;
  return {
    type: getSourceType(context.chatType) as ArrangementSourceContext["type"],
    conversationId: context.conversationId,
    conversationName: context.conversationName,
    triggerMessageId: context.triggerMessageId,
    sourceMessageIds: getSourceMessageIds(result, context),
    sourceText: context.triggerText,
    contextText: formatContextText(context.messages),
    ...(result.relatedPeople.length > 0 ? { relatedPeople: result.relatedPeople } : {}),
    ...(reason ? { reason } : {}),
    confidence: result.confidence,
    createdAt,
  };
}

function getArrangementSourceContexts(item: ArrangementItem) {
  return item.source?.contexts ?? [];
}

function hasProcessedTriggerMessage(context: ConversationRecognitionContext) {
  return getInitialArrangements().some((item) => {
    if (item.createdBy !== "ai" && !item.source?.contexts?.length) return false;
    return (
      item.source?.triggerMessageId === context.triggerMessageId ||
      item.source?.sourceMessageId === context.triggerMessageId ||
      item.source?.sourceMessageIds?.includes(context.triggerMessageId) ||
      item.source?.recordUids?.includes(context.triggerMessageId) ||
      item.source?.contexts?.some(
        (sourceContext) =>
          sourceContext.triggerMessageId === context.triggerMessageId ||
          sourceContext.sourceMessageIds.includes(context.triggerMessageId)
      )
    );
  });
}

function getExistingArrangementSummaries() {
  return getInitialArrangements()
    .filter((item) => {
      return item.status === "pending";
    })
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      title: item.title,
      scheduledDate: item.scheduledDate ?? "",
      startTime: item.startTime ?? "",
      endTime: item.endTime ?? "",
      timeText: item.timeText ?? "",
      note: item.note ?? "",
      reminder: item.reminder ?? null,
      importance: item.importance,
      urgency: item.urgency,
      relatedPeople: item.source?.relatedPeople ?? [],
      sourceTypes: Array.from(
        new Set([
          ...(item.source?.type ? [item.source.type] : []),
          ...getArrangementSourceContexts(item).map((sourceContext) => sourceContext.type),
        ])
      ),
      sourceSummary: getArrangementSourceContexts(item)
        .slice(-3)
        .map((sourceContext) => ({
          type: sourceContext.type,
          conversationName: sourceContext.conversationName,
          sourceText: sourceContext.sourceText,
          reason: sourceContext.reason ?? "",
        })),
      sourceMessageIds: Array.from(
        new Set([
          ...(item.source?.triggerMessageId ? [item.source.triggerMessageId] : []),
          ...(item.source?.sourceMessageId ? [item.source.sourceMessageId] : []),
          ...(item.source?.sourceMessageIds ?? []),
          ...getArrangementSourceContexts(item).flatMap(
            (sourceContext) => [
              sourceContext.triggerMessageId,
              ...sourceContext.sourceMessageIds,
            ]
          ),
        ])
      ),
    }));
}

function buildSystemPrompt(chatType: AiRecognitionChatType) {
  const base =
    "你是即我 App 的安排识别助手。你只返回一个 JSON 对象，不要 Markdown，不要解释。你需要判断最近对话是否应该为当前用户创建、更新或忽略一条安排。";

  if (chatType === "self") {
    return `${base} 当前场景是发给自己，可以较宽松地识别用户自己写下的未来需要关注、执行、确认、等待或落地的事项。`;
  }

  if (chatType === "private") {
    return `${base} 当前场景是一对一私聊。你需要判断对方是否提出请求或约定、我是否确认或承诺、我是否主动说了未来要做的事，以及这件事是否与我相关。`;
  }

  return `${base} 当前场景是群聊，必须谨慎。只有明确 @我、明确让我做某事、我自己承诺要做某事、我回复确认了某个请求，或这是我需要参与/关注的群内约定时，才允许创建或更新安排。与我无关的群聊内容必须返回 ignore。`;
}

function buildUserPrompt(context: ConversationRecognitionContext) {
  const recentMessages = [...context.messages]
    .filter((message) => message.text.trim())
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-10);
  const currentDate = toDateKey(new Date());
  const userPhraseMemories = getInitialUserPhraseMemories().map((memory) => ({
    phrase: memory.phrase,
    meaning: memory.meaning,
    note: memory.note ?? "",
  }));

  return JSON.stringify({
    currentDate,
    currentUserName: context.currentUserName,
    chatType: context.chatType,
    conversationId: context.conversationId,
    conversationName: context.conversationName,
    triggerMessageId: context.triggerMessageId,
    outputSchema: {
      action: "create | update | complete | expire | ignore",
      confidence: 0.86,
      existingArrangementId: "仅 action=update、complete、expire 时填写",
      updateIntent:
        "append_context | correct_time | correct_title | correct_details | merge_details，仅 action=update 时填写",
      patchReason: "本次更新覆盖核心字段的原因，没有覆盖时可为空",
      title: "安排标题",
      scheduledDate: "YYYY-MM-DD 或空字符串",
      startTime: "HH:mm 或空字符串",
      endTime: "HH:mm 或空字符串",
      timeText: "自然语言时间",
      note: "补充说明",
      reminder: {
        enabled: true,
        offsetDays: 1,
        time: "09:00",
      },
      importance: "important | normal",
      urgency: "urgent | normal",
      relatedPeople: ["相关人"],
      sourceMessageIds: ["参与判断的消息 ID"],
      reason: "为什么创建、更新或忽略",
    },
    rules: [
      "只判断 triggerMessageId 这次新消息及其最近上下文是否产生安排识别结果。",
      "如果是已有 pending 安排的补充，返回 action=update，并填写 existingArrangementId 和 updateIntent。",
      "当新对话只是提醒已有事项，例如“记得去医院”，updateIntent 必须是 append_context，不要覆盖原时间和标题。",
      "当新对话明确修正时间，例如“今天就去”“提前到今天”“改到18号”“不能拖”“不用等明天”，updateIntent 必须是 correct_time，并返回更准确的 scheduledDate、startTime、endTime 或 timeText。",
      "如果新旧时间冲突，且新消息来自后续更明确指令，应优先采用新消息，并在 patchReason 中说明为什么覆盖原时间。",
      "不要仅因为重复提到同一主题就覆盖时间。",
      "当新对话修正标题时，updateIntent=correct_title；当新对话补充事项细节时，updateIntent=merge_details 或 correct_details。",
      "如果是新事项，返回 action=create。",
      "如果上下文明确定已有 pending 安排已经完成，返回 action=complete，并填写 existingArrangementId；只有“已经做完/刚完成/已经交付”等明确完成表达才允许 complete，提到同一主题或未来计划不算完成。",
      "如果上下文明确定已有 pending 安排已经取消、作废、不需要处理或失效，返回 action=expire，并填写 existingArrangementId；不要自动删除安排。",
      "如果不是安排、与我无关、置信度不足，返回 action=ignore。",
      "如果用户明确表达提醒需求，可以返回 reminder；reminder 只支持按天提前，offsetDays=0 表示当天，offsetDays=1 表示提前 1 天，time 必须是 HH:mm。",
      "如果用户只说“提醒我”但没有明确提醒时间或提前天数，不要凭空设置 reminder，可保留 timeText。",
      "判断是否合并时，要综合主题、人物、地点、时间和上下文，不要仅因为日期相近就合并。",
      "例如“后天去医院体检”“爸爸提醒记得去医院”“姐姐问身体检查怎么样”可以合并；“后天去医院”和“后天开会”不能合并。",
      "如果一条消息要求带多个物品，例如咖啡、文件、两本书，这是一条安排，不要拆成多条安排。",
      "如果后续消息补充更多物品，例如再带两本书，应优先 update 已有安排，不要 create 新安排。",
      "同一人、同一时间、同一场景下的多个物品要合并成一条安排，title 可以写成“明天带咖啡、文件和两本书”，note 保留完整物品列表。",
      "不要因为物品不同就拆成多个安排。",
      "相对时间如明天、后天、周六必须基于 currentDate 解析；无法可靠解析时 scheduledDate 留空并保留 timeText。",
      "confidence 必须是 0 到 1 的数字。",
      "不要为同一件事创建多条安排，必须先检查 existingPendingArrangements，能确认同一件事时优先 update。",
      "completed、later 或 expired 安排不会出现在 existingPendingArrangements，本轮不要重新激活已放下事项。",
      "userPhraseMemories 是用户定义的个性化用语，请在理解对话时优先参考；如果对话中出现 phrase，应优先按 meaning 理解。",
    ],
    userPhraseMemories,
    triggerMessage: recentMessages.find(
      (message) => message.messageId === context.triggerMessageId
    ),
    contextMessages: recentMessages,
    existingPendingArrangements: getExistingArrangementSummaries(),
  });
}

function getActionConfidenceThreshold(action: AiRecognitionAction) {
  return action === "complete" || action === "expire"
    ? autoResolveConfidenceThreshold
    : autoArrangementConfidenceThreshold;
}

function shouldHandleResult(result: ArrangementRecognitionResult) {
  return (
    result.action !== "ignore" &&
    result.confidence >= getActionConfidenceThreshold(result.action)
  );
}

function getMergedRelatedPeople(
  existing: ArrangementItem,
  newContext: ArrangementSourceContext,
  result: ArrangementRecognitionResult
) {
  return Array.from(
    new Set([
      ...(existing.source?.relatedPeople ?? []),
      ...getArrangementSourceContexts(existing).flatMap(
        (sourceContext) => sourceContext.relatedPeople ?? []
      ),
      ...(newContext.relatedPeople ?? []),
      ...result.relatedPeople,
    ])
  );
}

function getMergedSourceMessageIds(
  existing: ArrangementItem,
  newContext: ArrangementSourceContext
) {
  return Array.from(
    new Set([
      ...(existing.source?.sourceMessageIds ?? []),
      ...(existing.source?.sourceMessageId ? [existing.source.sourceMessageId] : []),
      ...getArrangementSourceContexts(existing).flatMap(
        (sourceContext) => sourceContext.sourceMessageIds
      ),
      ...newContext.sourceMessageIds,
    ])
  );
}

function shouldAppendSourceContext(
  existing: ArrangementItem,
  newContext: ArrangementSourceContext
) {
  const existingContexts = getArrangementSourceContexts(existing);
  if (
    existingContexts.some(
      (sourceContext) => sourceContext.triggerMessageId === newContext.triggerMessageId
    )
  ) {
    return false;
  }

  const existingMessageIds = new Set([
    ...(existing.source?.sourceMessageIds ?? []),
    ...(existing.source?.sourceMessageId ? [existing.source.sourceMessageId] : []),
    ...existingContexts.flatMap((sourceContext) => sourceContext.sourceMessageIds),
  ]);
  return !newContext.sourceMessageIds.every((messageId) => existingMessageIds.has(messageId));
}

function getArrangementSourceMessageIds(item: ArrangementItem) {
  return Array.from(
    new Set([
      ...(item.source?.triggerMessageId ? [item.source.triggerMessageId] : []),
      ...(item.source?.sourceMessageId ? [item.source.sourceMessageId] : []),
      ...(item.source?.sourceMessageIds ?? []),
      ...(item.source?.recordUids ?? []),
      ...getArrangementSourceContexts(item).flatMap((sourceContext) => [
        sourceContext.triggerMessageId,
        ...sourceContext.sourceMessageIds,
      ]),
    ])
  );
}

function findArrangementBySourceMessageIds(
  items: ArrangementItem[],
  sourceMessageIds: string[]
) {
  const sourceMessageIdSet = new Set(sourceMessageIds.filter(Boolean));
  if (sourceMessageIdSet.size === 0) return null;

  return (
    items.find((item) =>
      getArrangementSourceMessageIds(item).some((messageId) =>
        sourceMessageIdSet.has(messageId)
      )
    ) ?? null
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\u3000，。、“”‘’：:；;,.!?！？、（）()[\]【】《》<>]/g, "");
}

function getArrangementSearchText(item: ArrangementItem) {
  return [
    item.title,
    item.note,
    item.timeText,
    item.scheduledDate,
    item.source?.sourceText,
    item.source?.contextText,
    item.source?.reason,
    ...getArrangementSourceContexts(item).flatMap((sourceContext) => [
      sourceContext.sourceText,
      sourceContext.contextText,
      sourceContext.reason ?? "",
      ...(sourceContext.relatedPeople ?? []),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function getResultSearchText(
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult
) {
  return [
    context.triggerText,
    result.title,
    result.note,
    result.timeText,
    result.reason,
    result.patchReason,
    ...result.relatedPeople,
  ]
    .filter(Boolean)
    .join(" ");
}

function getTextSimilarity(left: string, right: string) {
  const leftSet = new Set(normalizeSearchText(left).split("").filter(Boolean));
  const rightSet = new Set(normalizeSearchText(right).split("").filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  const intersectionSize = [...leftSet].filter((character) =>
    rightSet.has(character)
  ).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function areDateKeysClose(left?: string, right?: string) {
  if (!left || !right) return false;

  const leftDate = parseDateKey(left);
  const rightDate = parseDateKey(right);
  if (!leftDate || !rightDate) return false;

  const diffDays =
    Math.abs(leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays <= 1;
}

function areArrangementDatesCompatible(
  item: ArrangementItem,
  result: ArrangementRecognitionResult
) {
  if (item.scheduledDate && result.scheduledDate) {
    return areDateKeysClose(item.scheduledDate, result.scheduledDate);
  }

  const existingTimeText = normalizeSearchText(item.timeText ?? "");
  const incomingTimeText = normalizeSearchText(result.timeText ?? "");
  return Boolean(
    existingTimeText &&
      incomingTimeText &&
      (existingTimeText.includes(incomingTimeText) ||
        incomingTimeText.includes(existingTimeText))
  );
}

function getArrangementConversationIds(item: ArrangementItem) {
  return new Set([
    ...(item.source?.conversationId ? [item.source.conversationId] : []),
    ...getArrangementSourceContexts(item).map(
      (sourceContext) => sourceContext.conversationId
    ),
  ]);
}

function getArrangementRelatedPeople(item: ArrangementItem) {
  return new Set([
    ...(item.source?.relatedPeople ?? []),
    ...getArrangementSourceContexts(item).flatMap(
      (sourceContext) => sourceContext.relatedPeople ?? []
    ),
  ]);
}

function hasRelatedPeopleOverlap(
  item: ArrangementItem,
  result: ArrangementRecognitionResult
) {
  const existingPeople = getArrangementRelatedPeople(item);
  return result.relatedPeople.some((person) => existingPeople.has(person));
}

function isCarryPromiseText(value: string) {
  const normalizedText = normalizeSearchText(value);
  return /[带拿取带上捎准备]/.test(normalizedText);
}

function findSimilarPendingArrangement(
  items: ArrangementItem[],
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult
) {
  const incomingText = getResultSearchText(context, result);
  if (!normalizeSearchText(incomingText)) return null;

  const candidates = items
    .filter((item) => item.status === "pending")
    .map((item) => {
      const existingText = getArrangementSearchText(item);
      const sameConversation = getArrangementConversationIds(item).has(
        context.conversationId
      );
      const relatedPeopleOverlap = hasRelatedPeopleOverlap(item, result);
      const datesCompatible = areArrangementDatesCompatible(item, result);
      const similarity = getTextSimilarity(existingText, incomingText);
      const carryPromise =
        sameConversation &&
        datesCompatible &&
        isCarryPromiseText(existingText) &&
        isCarryPromiseText(incomingText);
      const isStrongCandidate =
        datesCompatible &&
        (sameConversation || relatedPeopleOverlap) &&
        (similarity >= 0.3 || carryPromise);

      return {
        item,
        score:
          (isStrongCandidate ? 1 : 0) +
          similarity +
          (carryPromise ? 0.5 : 0) +
          (sameConversation ? 0.2 : 0),
      };
    })
    .filter((candidate) => candidate.score >= 1)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.item ?? null;
}

function mergeNote(existingNote: string | undefined, nextNote: string | undefined) {
  const normalizedExistingNote = existingNote?.trim() ?? "";
  const normalizedNextNote = nextNote?.trim() ?? "";
  if (!normalizedNextNote) return normalizedExistingNote || undefined;
  if (!normalizedExistingNote) return normalizedNextNote;
  if (normalizedExistingNote.includes(normalizedNextNote)) return normalizedExistingNote;
  return `${normalizedExistingNote}\n${normalizedNextNote}`;
}

function mergeImportance(
  existing: ArrangementImportance,
  incoming: ArrangementImportance
): ArrangementImportance {
  return existing === "important" || incoming === "important" ? "important" : "normal";
}

function mergeUrgency(
  existing: ArrangementUrgency,
  incoming: ArrangementUrgency
): ArrangementUrgency {
  return existing === "urgent" || incoming === "urgent" ? "urgent" : "normal";
}

function pickMergedTitle(existingTitle: string, incomingTitle?: string) {
  const normalizedIncomingTitle = incomingTitle?.trim() ?? "";
  if (!normalizedIncomingTitle) return existingTitle;
  return normalizedIncomingTitle.length > existingTitle.length
    ? normalizedIncomingTitle
    : existingTitle;
}

function getUpdateIntent(result: ArrangementRecognitionResult): AiRecognitionUpdateIntent {
  if (result.action !== "update") return "append_context";
  return result.updateIntent ?? "merge_details";
}

function pickCorrectedValue(existingValue: string | undefined, incomingValue: string | undefined) {
  const normalizedIncomingValue = incomingValue?.trim() ?? "";
  if (normalizedIncomingValue) return normalizedIncomingValue;
  return existingValue;
}

function shouldUpdateTitle(updateIntent: AiRecognitionUpdateIntent) {
  return (
    updateIntent === "correct_title" ||
    updateIntent === "correct_details" ||
    updateIntent === "merge_details"
  );
}

function shouldUpdatePriority(updateIntent: AiRecognitionUpdateIntent) {
  return (
    updateIntent === "correct_time" ||
    updateIntent === "correct_details" ||
    updateIntent === "merge_details"
  );
}

function updateExistingArrangement(
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult,
  rawResponse: string
) {
  const sourceType = getSourceType(context.chatType);
  const currentItems = getInitialArrangements();
  const existing = currentItems.find(
    (item) =>
      item.id === result.existingArrangementId &&
      item.status === "pending"
  );

  if (!existing) {
    return { status: "ignored" as const, reason: "模型建议更新，但没有找到可更新的 pending 安排" };
  }

  const updateIntent = getUpdateIntent(result);
  const patchReason = result.patchReason || result.reason;
  const newSourceContext = buildSourceContext(context, result);
  const existingSourceMessageIds = new Set(getArrangementSourceMessageIds(existing));
  if (
    newSourceContext.sourceMessageIds.length > 0 &&
    newSourceContext.sourceMessageIds.every((messageId) =>
      existingSourceMessageIds.has(messageId)
    )
  ) {
    return {
      status: "ignored" as const,
      reason: "同一来源消息已更新过该安排，跳过重复更新",
      updatedArrangementId: existing.id,
      rawResponse,
    };
  }

  const shouldAppendContext = shouldAppendSourceContext(existing, newSourceContext);
  const contexts = shouldAppendContext
    ? [...getArrangementSourceContexts(existing), newSourceContext]
    : getArrangementSourceContexts(existing);
  const sourceMessageIds = getMergedSourceMessageIds(existing, newSourceContext);
  const relatedPeople = getMergedRelatedPeople(existing, newSourceContext, result);
  const nextScheduledDate =
    updateIntent === "correct_time"
      ? pickCorrectedValue(existing.scheduledDate, result.scheduledDate)
      : existing.scheduledDate;
  const nextStartTime =
    updateIntent === "correct_time"
      ? pickCorrectedValue(existing.startTime, result.startTime)
      : existing.startTime;
  const nextEndTime =
    updateIntent === "correct_time"
      ? pickCorrectedValue(existing.endTime, result.endTime)
      : existing.endTime;
  const nextTimeText =
    updateIntent === "correct_time"
      ? pickCorrectedValue(existing.timeText, result.timeText)
      : existing.timeText;
  const nextItem: ArrangementItem = {
    ...existing,
    title: shouldUpdateTitle(updateIntent)
      ? pickMergedTitle(existing.title, result.title)
      : existing.title,
    updatedAt: Date.now(),
    importance: shouldUpdatePriority(updateIntent)
      ? mergeImportance(existing.importance, result.importance)
      : existing.importance,
    urgency: shouldUpdatePriority(updateIntent)
      ? mergeUrgency(existing.urgency, result.urgency)
      : existing.urgency,
    scheduledDate: nextScheduledDate,
    startTime: nextStartTime,
    endTime: nextEndTime,
    timeText: nextTimeText,
    note: mergeNote(existing.note, result.note || result.reason),
    reminder: existing.reminder ?? result.reminder,
    source: {
      type: existing.source?.type ?? sourceType,
      label: existing.source?.label ?? getSourceLabel(context.chatType),
      conversationId: existing.source?.conversationId ?? context.conversationId,
      conversationName: existing.source?.conversationName ?? context.conversationName,
      triggerMessageId: context.triggerMessageId,
      sourceMessageIds,
      sourceMessageId: existing.source?.sourceMessageId ?? newSourceContext.triggerMessageId,
      sourceText: context.triggerText,
      contextText: newSourceContext.contextText,
      ...(relatedPeople.length > 0 ? { relatedPeople } : {}),
      contexts,
      createdBy: "ai",
      ...(patchReason ? { reason: patchReason } : existing.source?.reason ? { reason: existing.source.reason } : {}),
      confidence: result.confidence,
      ...(context.chatType === "self" ? { recordUids: sourceMessageIds } : {}),
    },
  };
  persistArrangements(currentItems.map((item) => (item.id === existing.id ? nextItem : item)));
  return {
    status: "updated" as const,
    reason: result.reason || "已合并到已有安排",
    updatedArrangementId: nextItem.id,
    updateIntent,
    ...(patchReason ? { patchReason } : {}),
    previousScheduledDate: existing.scheduledDate ?? "",
    nextScheduledDate: nextItem.scheduledDate ?? "",
    previousTimeText: existing.timeText ?? "",
    nextTimeText: nextItem.timeText ?? "",
    rawResponse,
  };
}

function createArrangementFromResult(
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult,
  rawResponse: string
) {
  if (!result.title?.trim()) {
    return { status: "ignored" as const, reason: "模型建议创建，但标题为空" };
  }

  const sourceType = getSourceType(context.chatType);
  const sourceContext = buildSourceContext(context, result);
  const sourceMessageIds = sourceContext.sourceMessageIds;
  const currentItems = getInitialArrangements();
  const existingBySource = findArrangementBySourceMessageIds(
    currentItems,
    sourceMessageIds
  );
  if (existingBySource) {
    return {
      status: "ignored" as const,
      reason:
        existingBySource.status === "pending"
          ? "同一来源消息已处理过，跳过重复创建"
          : "同一来源消息已处理到非 pending 安排，跳过重复创建",
      rawResponse,
      updatedArrangementId: existingBySource.id,
    };
  }

  const similarPendingArrangement = findSimilarPendingArrangement(
    currentItems,
    context,
    result
  );
  if (similarPendingArrangement) {
    return updateExistingArrangement(
      context,
      {
        ...result,
        action: "update",
        existingArrangementId: similarPendingArrangement.id,
        updateIntent: result.updateIntent ?? "merge_details",
        patchReason:
          result.patchReason ||
          result.reason ||
          "本地发现同一会话同一时间的相似承诺，改为合并更新",
      },
      rawResponse
    );
  }

  const createdArrangement = appendArrangement({
    title: result.title,
    status: "pending",
    importance: result.importance,
    urgency: result.urgency,
    scheduledDate: result.scheduledDate,
    startTime: result.startTime,
    endTime: result.endTime,
    timeText: result.timeText,
    note: result.note || result.reason,
    reminder: result.reminder,
    createdBy: "ai",
    source: {
      type: sourceType,
      label: getSourceLabel(context.chatType),
      conversationId: context.conversationId,
      conversationName: context.conversationName,
      triggerMessageId: context.triggerMessageId,
      sourceMessageIds,
      sourceMessageId: context.triggerMessageId,
      sourceText: context.triggerText,
      contextText: sourceContext.contextText,
      ...(result.relatedPeople.length > 0 ? { relatedPeople: result.relatedPeople } : {}),
      contexts: [sourceContext],
      createdBy: "ai",
      ...(result.reason ? { reason: result.reason } : {}),
      confidence: result.confidence,
      ...(context.chatType === "self" ? { recordUids: sourceMessageIds } : {}),
    },
  });

  return {
    status: createdArrangement ? "created" as const : "failed" as const,
    reason: createdArrangement ? "已自动创建安排" : "写入安排失败",
    rawResponse,
    ...(createdArrangement ? { createdArrangementId: createdArrangement.id } : {}),
    ...(createdArrangement ? {} : { error: "appendArrangement returned null" }),
  };
}

function resolveExistingArrangement(
  context: ConversationRecognitionContext,
  result: ArrangementRecognitionResult,
  status: "completed" | "expired",
  rawResponse: string
) {
  const sourceType = getSourceType(context.chatType);
  const currentItems = getInitialArrangements();
  const existing = currentItems.find(
    (item) => item.id === result.existingArrangementId && item.status === "pending"
  );

  if (!existing) {
    return {
      status: "ignored" as const,
      reason:
        status === "completed"
          ? "模型建议完成，但没有找到可完成的 pending 安排"
          : "模型建议失效，但没有找到可失效的 pending 安排",
    };
  }

  const timestamp = Date.now();
  const newSourceContext = buildSourceContext(context, result, timestamp);
  const shouldAppendContext = shouldAppendSourceContext(existing, newSourceContext);
  const contexts = shouldAppendContext
    ? [...getArrangementSourceContexts(existing), newSourceContext]
    : getArrangementSourceContexts(existing);
  const sourceMessageIds = getMergedSourceMessageIds(existing, newSourceContext);
  const relatedPeople = getMergedRelatedPeople(existing, newSourceContext, result);
  const nextItem: ArrangementItem = {
    ...existing,
    status,
    updatedAt: timestamp,
    ...(status === "completed"
      ? { completedAt: timestamp, expiredAt: undefined }
      : { expiredAt: timestamp, completedAt: undefined }),
    source: {
      type: existing.source?.type ?? sourceType,
      label: existing.source?.label ?? getSourceLabel(context.chatType),
      conversationId: existing.source?.conversationId ?? context.conversationId,
      conversationName: existing.source?.conversationName ?? context.conversationName,
      triggerMessageId: context.triggerMessageId,
      sourceMessageIds,
      sourceMessageId: existing.source?.sourceMessageId ?? newSourceContext.triggerMessageId,
      sourceText: context.triggerText,
      contextText: newSourceContext.contextText,
      ...(relatedPeople.length > 0 ? { relatedPeople } : {}),
      contexts,
      createdBy: "ai",
      ...(result.reason
        ? { reason: result.reason }
        : existing.source?.reason
          ? { reason: existing.source.reason }
          : {}),
      confidence: result.confidence,
      ...(context.chatType === "self" ? { recordUids: sourceMessageIds } : {}),
    },
  };

  persistArrangements(currentItems.map((item) => (item.id === existing.id ? nextItem : item)));
  return {
    status: status === "completed" ? ("completed" as const) : ("expired" as const),
    reason:
      result.reason ||
      (status === "completed" ? "已自动标记为完成" : "已自动标记为失效"),
    rawResponse,
    updatedArrangementId: nextItem.id,
  };
}

export async function recognizeArrangementFromConversation(
  context: ConversationRecognitionContext
) {
  const { settings } = context;
  if (!settings.arrangementRecognitionEnabled) return;

  const recognitionKey = buildRecognitionKey(context);
  const recognitionClaimKeys = Array.from(
    new Set([
      recognitionKey,
      buildRecognitionTriggerKey(context),
      buildRecognitionTextKey(context),
    ].filter(Boolean))
  );
  if (
    hasInFlightRecognitionKey(recognitionClaimKeys) ||
    recognitionClaimKeys.some(hasProcessedAiRecognitionKey)
  ) {
    return;
  }

  lockRecognitionKeys(recognitionClaimKeys);
  markAiRecognitionKeysProcessed(recognitionClaimKeys);

  const timestamp = Date.now();
  const logId = createAiRecognitionLogId(timestamp);
  const sourceText = context.triggerText;
  const baseLog = {
    id: logId,
    createdAt: timestamp,
    recognitionKey,
    triggerMessageId: context.triggerMessageId,
    sourceText,
    chatType: context.chatType,
    conversationId: context.conversationId,
    conversationName: context.conversationName,
  };
  let activeLogId = logId;
  let requestUrl = "";
  const appendSkippedLog = (reason: string) => {
    appendAiRecognitionLog({
      ...baseLog,
      status: "skipped",
      reason,
      skippedReason: reason,
    });
  };

  if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.model.trim()) {
    const missingFields = [
      !settings.apiKey.trim() ? "API Key" : "",
      !settings.baseUrl.trim() ? "Base URL" : "",
      !settings.model.trim() ? "Model" : "",
    ].filter(Boolean);
    appendSkippedLog(`缺少配置：${missingFields.join("、")}`);
    unlockRecognitionKeys(recognitionClaimKeys);
    return;
  }

  if (!context.triggerText.trim()) {
    appendSkippedLog("消息内容为空");
    unlockRecognitionKeys(recognitionClaimKeys);
    return;
  }

  if (hasProcessedTriggerMessage(context)) {
    appendSkippedLog("同一条消息已经处理过 AI 安排识别");
    unlockRecognitionKeys(recognitionClaimKeys);
    return;
  }

  requestUrl = getChatCompletionsUrl(settings.baseUrl);
  const requestLog = appendAiRecognitionLog({
    ...baseLog,
    status: "requesting",
    reason: "正在请求模型识别",
    requestUrl,
  });
  activeLogId = requestLog.id;

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: 0.2,
        messages: [
          { role: "system", content: buildSystemPrompt(context.chatType) },
          { role: "user", content: buildUserPrompt(context) },
        ],
      }),
    });
    const responseBody = (await response.json().catch(() => null)) as
      | ChatCompletionsResponseBody
      | null;
    const rawResponse = stringifyForDebugLog(responseBody);

    if (!response.ok) {
      updateAiRecognitionLog(activeLogId, {
        status: "failed",
        reason: `请求失败：HTTP ${response.status}`,
        requestUrl,
        rawResponse,
        error: responseBody?.error?.message || `HTTP ${response.status}`,
      });
      return;
    }

    const content = responseBody?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI arrangement response has no content.");
    }

    let result: ArrangementRecognitionResult;
    try {
      result = parseArrangementRecognition(content);
    } catch (error) {
      updateAiRecognitionLog(activeLogId, {
        status: "failed",
        reason: "模型返回格式错误，无法解析为识别 JSON",
        requestUrl,
        rawResponse: content,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    updateAiRecognitionLog(activeLogId, {
      status: "success",
      reason: "模型返回已解析",
      requestUrl,
      rawResponse: content,
      parsedResult: result,
      action: result.action,
      ...(result.updateIntent ? { updateIntent: result.updateIntent } : {}),
      ...(result.patchReason ? { patchReason: result.patchReason } : {}),
      shouldCreate: result.action === "create",
      confidence: result.confidence,
      ...(result.existingArrangementId
        ? { existingArrangementId: result.existingArrangementId }
        : {}),
    });

    if (!shouldHandleResult(result)) {
      updateAiRecognitionLog(activeLogId, {
        status: "ignored",
        reason:
          result.action === "ignore"
            ? result.reason || "模型判断不需要创建或更新安排"
            : `置信度 ${result.confidence} 低于阈值 ${getActionConfidenceThreshold(result.action)}`,
        requestUrl,
        rawResponse: content,
        parsedResult: result,
        action: result.action,
        ...(result.updateIntent ? { updateIntent: result.updateIntent } : {}),
        ...(result.patchReason ? { patchReason: result.patchReason } : {}),
        shouldCreate: result.action === "create",
        confidence: result.confidence,
      });
      return;
    }

    const writeResult =
      result.action === "update"
        ? updateExistingArrangement(context, result, content)
        : result.action === "complete"
          ? resolveExistingArrangement(context, result, "completed", content)
          : result.action === "expire"
            ? resolveExistingArrangement(context, result, "expired", content)
            : createArrangementFromResult(context, result, content);

    updateAiRecognitionLog(activeLogId, {
      status: writeResult.status,
      reason: writeResult.reason,
      requestUrl,
      rawResponse: content,
      parsedResult: result,
      action: result.action,
      ...("updateIntent" in writeResult && writeResult.updateIntent
        ? { updateIntent: writeResult.updateIntent }
        : result.updateIntent
          ? { updateIntent: result.updateIntent }
          : {}),
      ...("patchReason" in writeResult && writeResult.patchReason
        ? { patchReason: writeResult.patchReason }
        : result.patchReason
          ? { patchReason: result.patchReason }
          : {}),
      shouldCreate: result.action === "create",
      confidence: result.confidence,
      ...(result.existingArrangementId
        ? { existingArrangementId: result.existingArrangementId }
        : {}),
      ...("createdArrangementId" in writeResult
        ? { createdArrangementId: writeResult.createdArrangementId }
        : {}),
      ...("updatedArrangementId" in writeResult
        ? { updatedArrangementId: writeResult.updatedArrangementId }
        : {}),
      ...("previousScheduledDate" in writeResult
        ? { previousScheduledDate: writeResult.previousScheduledDate }
        : {}),
      ...("nextScheduledDate" in writeResult
        ? { nextScheduledDate: writeResult.nextScheduledDate }
        : {}),
      ...("previousTimeText" in writeResult
        ? { previousTimeText: writeResult.previousTimeText }
        : {}),
      ...("nextTimeText" in writeResult
        ? { nextTimeText: writeResult.nextTimeText }
        : {}),
      ...("error" in writeResult ? { error: writeResult.error } : {}),
    });
  } catch (error) {
    updateAiRecognitionLog(activeLogId, {
      status: "failed",
      reason: "识别请求或解析失败",
      requestUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn(
      "[Arkme] Failed to recognize conversation arrangement",
      error instanceof Error ? error.message : error
    );
  } finally {
    unlockRecognitionKeys(recognitionClaimKeys);
  }
}
