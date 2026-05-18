export type ArrangementStatus = "pending" | "completed" | "later" | "expired";
export type ArrangementImportance = "important" | "normal";
export type ArrangementUrgency = "urgent" | "normal";
export type ArrangementSourceType = "manual" | "self-chat" | "private-chat" | "group-chat";
export type ArrangementCreatedBy = "manual" | "ai";
export type ArrangementReminder = {
  enabled: boolean;
  offsetDays: number;
  time: string;
};

export type ArrangementSourceContext = {
  type: Exclude<ArrangementSourceType, "manual">;
  conversationId: string;
  conversationName: string;
  triggerMessageId: string;
  sourceMessageIds: string[];
  sourceText: string;
  contextText: string;
  relatedPeople?: string[];
  reason?: string;
  confidence?: number;
  createdAt: number;
};

export type ArrangementItem = {
  id: string;
  title: string;
  status: ArrangementStatus;
  importance: ArrangementImportance;
  urgency: ArrangementUrgency;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  expiredAt?: number;
  createdBy?: ArrangementCreatedBy;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  timeText?: string;
  note?: string;
  reminder?: ArrangementReminder;
  source?: {
    type: ArrangementSourceType;
    label: string;
    recordUids?: string[];
    sourceMessageId?: string;
    triggerMessageId?: string;
    conversationId?: string;
    conversationName?: string;
    sourceMessageIds?: string[];
    sourceText?: string;
    contextText?: string;
    relatedPeople?: string[];
    contexts?: ArrangementSourceContext[];
    createdBy?: ArrangementCreatedBy;
    reason?: string;
    confidence?: number;
  };
};

export type CreateArrangementInput = {
  title: string;
  status?: ArrangementStatus;
  importance?: ArrangementImportance;
  urgency?: ArrangementUrgency;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  timeText?: string;
  note?: string;
  reminder?: ArrangementReminder;
  createdBy?: ArrangementCreatedBy;
  source?: ArrangementItem["source"];
};

export const arrangementsStorageKey = "arkme-demo.arrangements";

export function isArrangementStatus(value: unknown): value is ArrangementStatus {
  return (
    value === "pending" ||
    value === "completed" ||
    value === "later" ||
    value === "expired"
  );
}

export function isArrangementImportance(value: unknown): value is ArrangementImportance {
  return value === "important" || value === "normal";
}

export function isArrangementUrgency(value: unknown): value is ArrangementUrgency {
  return value === "urgent" || value === "normal";
}

export function isArrangementCreatedBy(value: unknown): value is ArrangementCreatedBy {
  return value === "manual" || value === "ai";
}

export function isArrangementSourceType(value: unknown): value is ArrangementSourceType {
  return (
    value === "manual" ||
    value === "self-chat" ||
    value === "private-chat" ||
    value === "group-chat"
  );
}

function isConversationSourceType(
  value: unknown
): value is ArrangementSourceContext["type"] {
  return value === "self-chat" || value === "private-chat" || value === "group-chat";
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseDateKey(value);
  return Boolean(date && toDateKey(date) === value);
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isTimeValue(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeReminder(value: unknown): ArrangementReminder | undefined {
  if (!value || typeof value !== "object") return undefined;

  const reminder = value as Partial<ArrangementReminder>;
  if (reminder.enabled !== true) return undefined;

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

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSourceContext(
  value: unknown,
  fallbackCreatedAt: number
): ArrangementSourceContext | null {
  if (!value || typeof value !== "object") return null;

  const context = value as Partial<ArrangementSourceContext>;
  if (!isConversationSourceType(context.type)) return null;

  const conversationId =
    typeof context.conversationId === "string" ? context.conversationId.trim() : "";
  const conversationName =
    typeof context.conversationName === "string" ? context.conversationName.trim() : "";
  const triggerMessageId =
    typeof context.triggerMessageId === "string" ? context.triggerMessageId.trim() : "";
  const sourceMessageIds = Array.from(new Set(normalizeStringList(context.sourceMessageIds)));
  const sourceText = typeof context.sourceText === "string" ? context.sourceText.trim() : "";
  const contextText = typeof context.contextText === "string" ? context.contextText.trim() : "";
  const relatedPeople = normalizeStringList(context.relatedPeople);
  const reason = typeof context.reason === "string" ? context.reason.trim() : "";
  const confidence = normalizeConfidence(context.confidence);
  const createdAt =
    typeof context.createdAt === "number" && Number.isFinite(context.createdAt)
      ? context.createdAt
      : fallbackCreatedAt;

  if (!conversationId || !conversationName || !triggerMessageId) return null;

  return {
    type: context.type,
    conversationId,
    conversationName,
    triggerMessageId,
    sourceMessageIds: sourceMessageIds.length > 0 ? sourceMessageIds : [triggerMessageId],
    sourceText,
    contextText,
    ...(relatedPeople.length > 0 ? { relatedPeople } : {}),
    ...(reason ? { reason } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    createdAt,
  };
}

function buildLegacySourceContext(
  source: Partial<NonNullable<ArrangementItem["source"]>>,
  recordUids: string[] | undefined,
  fallbackCreatedAt: number
): ArrangementSourceContext | null {
  if (!isConversationSourceType(source.type)) return null;

  const sourceMessageIds = Array.from(
    new Set([
      ...normalizeStringList(source.sourceMessageIds),
      ...(typeof source.sourceMessageId === "string" && source.sourceMessageId.trim()
        ? [source.sourceMessageId.trim()]
        : []),
      ...(recordUids ?? []),
    ])
  );
  const triggerMessageId =
    (typeof source.triggerMessageId === "string" && source.triggerMessageId.trim()) ||
    (typeof source.sourceMessageId === "string" && source.sourceMessageId.trim()) ||
    sourceMessageIds[0] ||
    "";
  const conversationId =
    (typeof source.conversationId === "string" && source.conversationId.trim()) ||
    source.type;
  const conversationName =
    (typeof source.conversationName === "string" && source.conversationName.trim()) ||
    (typeof source.label === "string" && source.label.trim()) ||
    source.type;
  const sourceText = typeof source.sourceText === "string" ? source.sourceText.trim() : "";
  const contextText = typeof source.contextText === "string" ? source.contextText.trim() : "";
  const relatedPeople = normalizeStringList(source.relatedPeople);
  const reason = typeof source.reason === "string" ? source.reason.trim() : "";
  const confidence = normalizeConfidence(source.confidence);

  if (!triggerMessageId) return null;

  return {
    type: source.type,
    conversationId,
    conversationName,
    triggerMessageId,
    sourceMessageIds: sourceMessageIds.length > 0 ? sourceMessageIds : [triggerMessageId],
    sourceText,
    contextText,
    ...(relatedPeople.length > 0 ? { relatedPeople } : {}),
    ...(reason ? { reason } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    createdAt: fallbackCreatedAt,
  };
}

function normalizeSource(
  value: unknown,
  fallbackCreatedAt: number
): ArrangementItem["source"] | undefined {
  if (!value || typeof value !== "object") return undefined;

  const source = value as Partial<NonNullable<ArrangementItem["source"]>>;
  const sourceType = source.type;
  if (!isArrangementSourceType(sourceType) || typeof source.label !== "string") {
    return undefined;
  }

  const recordUids = normalizeStringList(source.recordUids);
  const sourceMessageId =
    typeof source.sourceMessageId === "string" ? source.sourceMessageId.trim() : "";
  const triggerMessageId =
    typeof source.triggerMessageId === "string" ? source.triggerMessageId.trim() : "";
  const conversationId =
    typeof source.conversationId === "string" ? source.conversationId.trim() : "";
  const conversationName =
    typeof source.conversationName === "string" ? source.conversationName.trim() : "";
  const sourceMessageIds = normalizeStringList(source.sourceMessageIds);
  const sourceText = typeof source.sourceText === "string" ? source.sourceText.trim() : "";
  const contextText = typeof source.contextText === "string" ? source.contextText.trim() : "";
  const relatedPeople = normalizeStringList(source.relatedPeople);
  const contexts = Array.isArray(source.contexts)
    ? source.contexts
        .map((context) => normalizeSourceContext(context, fallbackCreatedAt))
        .filter((context): context is ArrangementSourceContext => Boolean(context))
    : [];
  const legacyContext = contexts.length
    ? null
    : buildLegacySourceContext(source, recordUids, fallbackCreatedAt);
  const reason = typeof source.reason === "string" ? source.reason.trim() : "";
  const confidence = normalizeConfidence(source.confidence);

  return {
    type: sourceType,
    label: source.label,
    ...(recordUids.length > 0 ? { recordUids } : {}),
    ...(sourceMessageId ? { sourceMessageId } : {}),
    ...(triggerMessageId ? { triggerMessageId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(conversationName ? { conversationName } : {}),
    ...(sourceMessageIds.length > 0 ? { sourceMessageIds } : {}),
    ...(sourceText ? { sourceText } : {}),
    ...(contextText ? { contextText } : {}),
    ...(relatedPeople.length > 0 ? { relatedPeople } : {}),
    ...(contexts.length > 0
      ? { contexts }
      : legacyContext
        ? { contexts: [legacyContext] }
        : {}),
    ...(isArrangementCreatedBy(source.createdBy) ? { createdBy: source.createdBy } : {}),
    ...(reason ? { reason } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
}

export function normalizeArrangement(value: unknown): ArrangementItem | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Partial<ArrangementItem>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !isArrangementStatus(item.status) ||
    typeof item.createdAt !== "number" ||
    typeof item.updatedAt !== "number" ||
    !Number.isFinite(item.createdAt) ||
    !Number.isFinite(item.updatedAt)
  ) {
    return null;
  }

  const title = item.title.trim();
  if (!title) return null;

  const timeText = typeof item.timeText === "string" ? item.timeText.trim() : "";
  const note = typeof item.note === "string" ? item.note.trim() : "";
  const scheduledDate = isDateKey(item.scheduledDate) ? item.scheduledDate : "";
  const startTime = isTimeValue(item.startTime) ? item.startTime : "";
  const endTime = isTimeValue(item.endTime) ? item.endTime : "";
  const reminder = normalizeReminder(item.reminder);
  const source = normalizeSource(item.source, item.createdAt);
  const completedAt = normalizeTimestamp(item.completedAt);
  const expiredAt = normalizeTimestamp(item.expiredAt);

  return {
    id: item.id,
    title,
    status: item.status,
    importance: isArrangementImportance(item.importance) ? item.importance : "normal",
    urgency: isArrangementUrgency(item.urgency) ? item.urgency : "normal",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(completedAt ? { completedAt } : {}),
    ...(expiredAt ? { expiredAt } : {}),
    ...(isArrangementCreatedBy(item.createdBy) ? { createdBy: item.createdBy } : {}),
    ...(scheduledDate ? { scheduledDate } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(timeText ? { timeText } : {}),
    ...(note ? { note } : {}),
    ...(reminder ? { reminder } : {}),
    ...(source ? { source } : {}),
  };
}

export function getInitialArrangements() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(arrangementsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeArrangement)
      .filter((item): item is ArrangementItem => Boolean(item));
  } catch {
    return [];
  }
}

export function persistArrangements(items: ArrangementItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(arrangementsStorageKey, JSON.stringify(items));
  } catch {
    // Keep the in-memory list if storage is unavailable.
  }
}

export function createArrangementId(timestamp: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `manual-${timestamp}`;
}

export function buildArrangement(
  input: CreateArrangementInput,
  timestamp = Date.now()
): ArrangementItem | null {
  const normalizedTitle = input.title.trim();
  if (!normalizedTitle) return null;
  const reminder = normalizeReminder(input.reminder);

  return {
    id: createArrangementId(timestamp),
    title: normalizedTitle,
    status: input.status ?? "pending",
    importance: input.importance ?? "normal",
    urgency: input.urgency ?? "normal",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.createdBy ?? "manual",
    ...(isDateKey(input.scheduledDate) ? { scheduledDate: input.scheduledDate } : {}),
    ...(isTimeValue(input.startTime) ? { startTime: input.startTime } : {}),
    ...(isTimeValue(input.endTime) ? { endTime: input.endTime } : {}),
    ...(input.timeText?.trim() ? { timeText: input.timeText.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(reminder ? { reminder } : {}),
    ...(input.source ? { source: input.source } : {}),
  };
}

export function appendArrangement(input: CreateArrangementInput) {
  const nextArrangement = buildArrangement(input);
  if (!nextArrangement) return null;

  const nextItems = [nextArrangement, ...getInitialArrangements()];
  persistArrangements(nextItems);
  return nextArrangement;
}
