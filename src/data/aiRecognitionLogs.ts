export type AiRecognitionLogStatus =
  | "skipped"
  | "requesting"
  | "success"
  | "failed"
  | "ignored"
  | "created"
  | "updated"
  | "completed"
  | "expired";

export type AiRecognitionChatType = "self" | "private" | "group";
export type AiRecognitionAction = "create" | "update" | "ignore" | "complete" | "expire";
export type AiRecognitionUpdateIntent =
  | "append_context"
  | "correct_time"
  | "correct_title"
  | "correct_details"
  | "merge_details";

export type AiRecognitionLog = {
  id: string;
  createdAt: number;
  recognitionKey?: string;
  triggerMessageId?: string;
  sourceText: string;
  status: AiRecognitionLogStatus;
  reason: string;
  skippedReason?: string;
  requestUrl?: string;
  chatType?: AiRecognitionChatType;
  conversationId?: string;
  conversationName?: string;
  action?: AiRecognitionAction;
  updateIntent?: AiRecognitionUpdateIntent;
  patchReason?: string;
  existingArrangementId?: string;
  previousScheduledDate?: string;
  nextScheduledDate?: string;
  previousTimeText?: string;
  nextTimeText?: string;
  rawResponse?: string;
  parsedResult?: unknown;
  shouldCreate?: boolean;
  confidence?: number;
  createdArrangementId?: string;
  updatedArrangementId?: string;
  error?: string;
};

export const aiRecognitionLogsStorageKey = "arkme-demo.ai-recognition-logs";
export const aiRecognitionProcessedKeysStorageKey =
  "arkme-demo.ai-recognition-processed-keys";

const maxAiRecognitionLogs = 20;
const maxAiRecognitionProcessedKeys = 500;

export function createAiRecognitionLogId(timestamp = Date.now()) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `ai-recognition-${timestamp}`;
}

function normalizeAiRecognitionLog(value: unknown): AiRecognitionLog | null {
  if (!value || typeof value !== "object") return null;

  const log = value as Partial<AiRecognitionLog>;
  if (
    typeof log.id !== "string" ||
    typeof log.createdAt !== "number" ||
    !Number.isFinite(log.createdAt) ||
    typeof log.sourceText !== "string" ||
    !isAiRecognitionLogStatus(log.status) ||
    typeof log.reason !== "string"
  ) {
    return null;
  }

  return {
    id: log.id,
    createdAt: log.createdAt,
    ...(typeof log.recognitionKey === "string" && log.recognitionKey.trim()
      ? { recognitionKey: log.recognitionKey.trim() }
      : {}),
    ...(typeof log.triggerMessageId === "string" && log.triggerMessageId.trim()
      ? { triggerMessageId: log.triggerMessageId.trim() }
      : {}),
    sourceText: log.sourceText,
    status: log.status,
    reason: log.reason,
    ...(typeof log.skippedReason === "string" ? { skippedReason: log.skippedReason } : {}),
    ...(typeof log.requestUrl === "string" ? { requestUrl: log.requestUrl } : {}),
    ...(isAiRecognitionChatType(log.chatType) ? { chatType: log.chatType } : {}),
    ...(typeof log.conversationId === "string" ? { conversationId: log.conversationId } : {}),
    ...(typeof log.conversationName === "string"
      ? { conversationName: log.conversationName }
      : {}),
    ...(isAiRecognitionAction(log.action) ? { action: log.action } : {}),
    ...(isAiRecognitionUpdateIntent(log.updateIntent)
      ? { updateIntent: log.updateIntent }
      : {}),
    ...(typeof log.patchReason === "string" ? { patchReason: log.patchReason } : {}),
    ...(typeof log.existingArrangementId === "string"
      ? { existingArrangementId: log.existingArrangementId }
      : {}),
    ...(typeof log.previousScheduledDate === "string"
      ? { previousScheduledDate: log.previousScheduledDate }
      : {}),
    ...(typeof log.nextScheduledDate === "string"
      ? { nextScheduledDate: log.nextScheduledDate }
      : {}),
    ...(typeof log.previousTimeText === "string"
      ? { previousTimeText: log.previousTimeText }
      : {}),
    ...(typeof log.nextTimeText === "string" ? { nextTimeText: log.nextTimeText } : {}),
    ...(typeof log.rawResponse === "string" ? { rawResponse: log.rawResponse } : {}),
    ...(log.parsedResult !== undefined ? { parsedResult: log.parsedResult } : {}),
    ...(typeof log.shouldCreate === "boolean"
      ? { shouldCreate: log.shouldCreate }
      : {}),
    ...(typeof log.confidence === "number" && Number.isFinite(log.confidence)
      ? { confidence: Math.min(1, Math.max(0, log.confidence)) }
      : {}),
    ...(typeof log.createdArrangementId === "string"
      ? { createdArrangementId: log.createdArrangementId }
      : {}),
    ...(typeof log.updatedArrangementId === "string"
      ? { updatedArrangementId: log.updatedArrangementId }
      : {}),
    ...(typeof log.error === "string" ? { error: log.error } : {}),
  };
}

function normalizeProcessedRecognitionKey(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAiRecognitionLogStatus(value: unknown): value is AiRecognitionLogStatus {
  return (
    value === "skipped" ||
    value === "requesting" ||
    value === "success" ||
    value === "failed" ||
    value === "ignored" ||
    value === "created" ||
    value === "updated" ||
    value === "completed" ||
    value === "expired"
  );
}

function isAiRecognitionChatType(value: unknown): value is AiRecognitionChatType {
  return value === "self" || value === "private" || value === "group";
}

function isAiRecognitionAction(value: unknown): value is AiRecognitionAction {
  return (
    value === "create" ||
    value === "update" ||
    value === "ignore" ||
    value === "complete" ||
    value === "expire"
  );
}

function isAiRecognitionUpdateIntent(value: unknown): value is AiRecognitionUpdateIntent {
  return (
    value === "append_context" ||
    value === "correct_time" ||
    value === "correct_title" ||
    value === "correct_details" ||
    value === "merge_details"
  );
}

export function getInitialAiRecognitionLogs() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(aiRecognitionLogsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeAiRecognitionLog)
      .filter((log): log is AiRecognitionLog => Boolean(log))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, maxAiRecognitionLogs);
  } catch {
    return [];
  }
}

export function persistAiRecognitionLogs(logs: AiRecognitionLog[]) {
  if (typeof window === "undefined") return;

  const nextLogs = logs
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, maxAiRecognitionLogs);
  try {
    window.localStorage.setItem(aiRecognitionLogsStorageKey, JSON.stringify(nextLogs));
  } catch {
    // Debug logs should never interrupt the main chat or arrangement flow.
  }
}

export function appendAiRecognitionLog(log: AiRecognitionLog) {
  if (log.recognitionKey) {
    const existingLog = getInitialAiRecognitionLogs().find(
      (item) => item.recognitionKey === log.recognitionKey
    );
    if (existingLog) return existingLog;
  }

  const nextLogs = [log, ...getInitialAiRecognitionLogs()];
  persistAiRecognitionLogs(nextLogs);
  return log;
}

export function updateAiRecognitionLog(
  id: string,
  update: Partial<Omit<AiRecognitionLog, "id" | "createdAt" | "sourceText">>
) {
  const nextLogs = getInitialAiRecognitionLogs().map((log) =>
    log.id === id ? { ...log, ...update } : log
  );
  persistAiRecognitionLogs(nextLogs);
}

export function getInitialAiRecognitionProcessedKeys() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(aiRecognitionProcessedKeysStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return Array.from(new Set(parsedValue.map(normalizeProcessedRecognitionKey).filter(Boolean)))
      .slice(0, maxAiRecognitionProcessedKeys);
  } catch {
    return [];
  }
}

export function hasProcessedAiRecognitionKey(key: string) {
  const normalizedKey = key.trim();
  if (!normalizedKey) return false;
  return getInitialAiRecognitionProcessedKeys().includes(normalizedKey);
}

export function markAiRecognitionKeysProcessed(keys: string[]) {
  if (typeof window === "undefined") return;

  const normalizedKeys = Array.from(
    new Set(keys.map(normalizeProcessedRecognitionKey).filter(Boolean))
  );
  if (normalizedKeys.length === 0) return;

  const existingKeys = getInitialAiRecognitionProcessedKeys();
  const nextKeys = [
    ...normalizedKeys,
    ...existingKeys.filter((key) => !normalizedKeys.includes(key)),
  ].slice(0, maxAiRecognitionProcessedKeys);

  try {
    window.localStorage.setItem(
      aiRecognitionProcessedKeysStorageKey,
      JSON.stringify(nextKeys)
    );
  } catch {
    // Recognition idempotency should not interrupt the main chat flow.
  }
}
