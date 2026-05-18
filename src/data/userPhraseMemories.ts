export type UserPhraseMemory = {
  id: string;
  phrase: string;
  meaning: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export const userPhraseMemoriesStorageKey = "arkme-demo.user-phrase-memories";

const maxUserPhraseMemories = 100;

export function createUserPhraseMemoryId(timestamp = Date.now()) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `phrase-memory-${timestamp}`;
}

function normalizeUserPhraseMemory(value: unknown): UserPhraseMemory | null {
  if (!value || typeof value !== "object") return null;

  const memory = value as Partial<UserPhraseMemory>;
  if (
    typeof memory.id !== "string" ||
    typeof memory.phrase !== "string" ||
    typeof memory.meaning !== "string" ||
    typeof memory.createdAt !== "number" ||
    typeof memory.updatedAt !== "number" ||
    !Number.isFinite(memory.createdAt) ||
    !Number.isFinite(memory.updatedAt)
  ) {
    return null;
  }

  const phrase = memory.phrase.trim();
  const meaning = memory.meaning.trim();
  const note = typeof memory.note === "string" ? memory.note.trim() : "";
  if (!phrase || !meaning) return null;

  return {
    id: memory.id,
    phrase,
    meaning,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    ...(note ? { note } : {}),
  };
}

export function getInitialUserPhraseMemories() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(userPhraseMemoriesStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeUserPhraseMemory)
      .filter((memory): memory is UserPhraseMemory => Boolean(memory))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, maxUserPhraseMemories);
  } catch {
    return [];
  }
}

export function persistUserPhraseMemories(items: UserPhraseMemory[]) {
  if (typeof window === "undefined") return;

  const nextItems = [...items]
    .map(normalizeUserPhraseMemory)
    .filter((memory): memory is UserPhraseMemory => Boolean(memory))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, maxUserPhraseMemories);

  try {
    window.localStorage.setItem(userPhraseMemoriesStorageKey, JSON.stringify(nextItems));
  } catch {
    // Phrase memory should never interrupt the main app flow.
  }
}
