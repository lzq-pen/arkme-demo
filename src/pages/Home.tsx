import React from "react";
import AppShell from "@/layouts/AppShell";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import ChatList from "@/components/ChatList";
import RecordDetailSheet from "@/components/RecordDetailSheet";
import RecordFullDetailScreen from "@/components/RecordFullDetailScreen";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Arrangements from "@/pages/Arrangements";
import Records from "@/pages/Records";
import {
  extractJsonPayload,
  getChatCompletionsUrl,
  recognizeArrangementFromConversation,
  type AiSettings,
  type ChatCompletionsResponseBody,
  type ConversationRecognitionMessage,
} from "@/data/conversationArrangementRecognition";
import {
  getInitialAiRecognitionLogs,
  type AiRecognitionLog,
} from "@/data/aiRecognitionLogs";
import { aiConversationLogEntries } from "@/data/aiConversationLog";
import { useCandidateProfile } from "@/data/candidateProfile";
import {
  createUserPhraseMemoryId,
  getInitialUserPhraseMemories,
  persistUserPhraseMemories,
  type UserPhraseMemory,
} from "@/data/userPhraseMemories";
import {
  createTestReplyMessage,
  demoSenderIdentityId,
  getInitialTestGroups,
  getInitialTestIdentities,
  getInitialTestMessages,
  getInitialTestReadState,
  getPrivateConversationId,
  persistTestMessages,
  persistTestReadState,
  testConversationStorageEvent,
  testGroupsStorageKey,
  testIdentitiesStorageKey,
  testMessagesStorageKey,
  testReadStateStorageKey,
  type TestConversationType,
  type TestGroup,
  type TestIdentity,
  type TestMessage,
  type TestReadState,
  type TestMessageSender,
} from "@/data/testConversations";
import { formatBubbleTime, formatTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  accentColorOptions,
  getLocaleDisplayName,
  supportedLocales,
  usePreferences,
  type AccentColor,
  type AppIcon,
  type LocaleCode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/settings/preferences";
import type { PageType } from "@/App";
import type { RecordItem, RecordReference, RecordSourceConversation } from "@/types/record";

type HomeProps = {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
};

type TabItem = {
  key: PageType;
};

const tabs: TabItem[] = [
  { key: "records" },
  { key: "arrangements" },
  { key: "insight" },
  { key: "mine" },
];

const aiConversationReadCountStorageKey = "arkme-demo.aiConversationReadCount";
const browserNotificationPromptedStorageKey = "arkme-demo.browserNotificationPrompted";
const createdSelfRecordsStorageKey = "arkme-demo.selfRecords";
const searchHistoryStorageKey = "arkme-demo.searchHistory";
const aiSettingsStorageKey = "arkme-demo.ai-settings";
const aiConversationTotalCount = aiConversationLogEntries.length;
const maxSearchHistoryCount = 4;

const defaultAiSettings: AiSettings = {
  apiKey: "",
  baseUrl: "",
  model: "",
  arrangementRecognitionEnabled: false,
};

type QuickSearchType = "image" | "audio" | "link" | "file" | "longArticle" | "contact";

type ConversationReturnContext =
  | { mode: "drawer" }
  | {
      mode: "previous";
      recordDetail: RecordItem | null;
      recordSnapshot: RecordItem | null;
    };

function normalizeAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") return defaultAiSettings;

  const settings = value as Partial<AiSettings>;
  return {
    apiKey: typeof settings.apiKey === "string" ? settings.apiKey : "",
    baseUrl: typeof settings.baseUrl === "string" ? settings.baseUrl : "",
    model: typeof settings.model === "string" ? settings.model : "",
    arrangementRecognitionEnabled:
      typeof settings.arrangementRecognitionEnabled === "boolean"
        ? settings.arrangementRecognitionEnabled
        : false,
  };
}

function readAiSettings(): AiSettings {
  if (typeof window === "undefined") return defaultAiSettings;

  try {
    const storedValue = window.localStorage.getItem(aiSettingsStorageKey);
    if (!storedValue) return defaultAiSettings;
    return normalizeAiSettings(JSON.parse(storedValue));
  } catch {
    return defaultAiSettings;
  }
}

function persistAiSettings(settings: AiSettings) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(aiSettingsStorageKey, JSON.stringify(settings));
}

type TestConversationSummary = {
  conversationId: string;
  conversationType: TestConversationType;
  title: string;
  subtitle: string;
  avatarLabel: string;
  color: string;
  identity?: TestIdentity;
  group?: TestGroup;
  memberIdentities: TestIdentity[];
  records: TestConversationRecord[];
  latestMessage: TestMessage;
  latestUnreadIdentityMessage: TestMessage | null;
  unreadCount: number;
};

type TestConversationRecord = RecordItem & {
  sender: TestMessageSender;
  identityId: string;
};

function toSelfRecognitionMessages(
  records: RecordItem[],
  currentUserName: string
): ConversationRecognitionMessage[] {
  return records.map((record) => ({
    messageId: record.uid,
    senderId: "self",
    senderName: currentUserName,
    isMe: true,
    text: record.text_content,
    createdAt: record.send_at,
  }));
}

function getTestMessageSenderName(
  message: TestMessage,
  identities: TestIdentity[],
  currentUserName: string
) {
  if (message.sender === "demo") return currentUserName;
  return identities.find((identity) => identity.id === message.identityId)?.name ?? "对方";
}

function toTestRecognitionMessages(
  messages: TestMessage[],
  identities: TestIdentity[],
  currentUserName: string
): ConversationRecognitionMessage[] {
  return messages.map((message) => ({
    messageId: message.id,
    senderId: message.sender === "demo" ? demoSenderIdentityId : message.identityId,
    senderName: getTestMessageSenderName(message, identities, currentUserName),
    isMe: message.sender === "demo",
    text: message.text,
    createdAt: message.sentAt,
  }));
}

type HomeMessagePreview = {
  summary: TestConversationSummary;
  message: TestMessage;
  unreadCount: number;
};

const quickSearchTypes: QuickSearchType[] = [
  "image",
  "audio",
  "link",
  "file",
  "longArticle",
  "contact",
];

function getInitialAiConversationReadCount() {
  if (typeof window === "undefined") {
    return aiConversationTotalCount;
  }

  const storedValue = window.localStorage.getItem(aiConversationReadCountStorageKey);
  if (storedValue === null) {
    window.localStorage.setItem(
      aiConversationReadCountStorageKey,
      String(aiConversationTotalCount)
    );
    return aiConversationTotalCount;
  }

  const parsedValue = Number(storedValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(0, parsedValue), aiConversationTotalCount);
}

function normalizeStoredSelfRecord(value: unknown): RecordItem | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordItem>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  const referencedRecord = normalizeStoredRecordReference(record.referencedRecord);

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(referencedRecord ? { referencedRecord } : {}),
  };
}

function normalizeStoredRecordReference(value: unknown): RecordReference | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordReference>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialCreatedSelfRecords() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(createdSelfRecordsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeStoredSelfRecord)
      .filter((record): record is RecordItem => Boolean(record));
  } catch {
    return [];
  }
}

function persistCreatedSelfRecords(records: RecordItem[]) {
  if (typeof window === "undefined") return;

  const storableRecords = records.map(
    ({ uid, text_content, send_at, create_at, update_at, referencedRecord }) => ({
      uid,
      text_content,
      send_at,
      create_at,
      update_at,
      ...(referencedRecord ? { referencedRecord } : {}),
    })
  );

  try {
    window.localStorage.setItem(
      createdSelfRecordsStorageKey,
      JSON.stringify(storableRecords)
    );
  } catch {
    // Storage can be unavailable in private modes; keep the in-memory record.
  }
}

function makeRecordReference(record: RecordItem): RecordReference {
  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialSearchHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(searchHistoryStorageKey);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, maxSearchHistoryCount);
  } catch {
    return [];
  }
}

function persistSearchHistory(history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(history));
  } catch {
    // Keep the visible in-memory history if storage is unavailable.
  }
}

function parseAiConversationTimestamp(value: string, fallbackTime: number) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return fallbackTime;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
}

function countRecordTextLength(value: string) {
  return Array.from(value.trim()).length;
}

function formatNumberForLocale(value: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function formatStatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function openExternalLink(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function shouldRequestBrowserNotificationPermission() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(browserNotificationPromptedStorageKey) === "true") {
    return false;
  }
  window.localStorage.setItem(browserNotificationPromptedStorageKey, "true");
  return true;
}

export default function Home({ currentPage, onNavigate }: HomeProps) {
  const { t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const currentUserName = candidateProfile?.name || t("recordDetail.me");
  const [showSearch, setShowSearch] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAnswerGuide, setShowAnswerGuide] = React.useState(false);
  const [showAiConversation, setShowAiConversation] = React.useState(false);
  const [showSendToSelf, setShowSendToSelf] = React.useState(false);
  const [showTestConversation, setShowTestConversation] = React.useState(false);
  const [conversationReturnContext, setConversationReturnContext] =
    React.useState<ConversationReturnContext>({ mode: "drawer" });
  const [aiConversationTargetIndex, setAiConversationTargetIndex] =
    React.useState<number | null>(null);
  const [sendToSelfTargetUid, setSendToSelfTargetUid] = React.useState<string | null>(null);
  const [activeTestIdentityId, setActiveTestIdentityId] = React.useState<string | null>(null);
  const [testConversationTargetUid, setTestConversationTargetUid] = React.useState<string | null>(null);
  const [settingsView, setSettingsView] = React.useState<
    null | "settings" | "appearance" | "about" | "ai" | "phrases"
  >(
    null
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchHistory, setSearchHistory] = React.useState(getInitialSearchHistory);
  const [recordDetail, setRecordDetail] = React.useState<RecordItem | null>(null);
  const [recordSnapshot, setRecordSnapshot] = React.useState<RecordItem | null>(null);
  const [lastReadAiConversationCount, setLastReadAiConversationCount] =
    React.useState(getInitialAiConversationReadCount);
  const recordsDemoBaseTime = React.useMemo(() => Date.now(), []);
  const selfDemoBaseTime = React.useMemo(() => Date.now(), []);
  const [createdSelfRecords, setCreatedSelfRecords] = React.useState(
    getInitialCreatedSelfRecords
  );
  const [testIdentities, setTestIdentities] = React.useState(getInitialTestIdentities);
  const [testGroups, setTestGroups] = React.useState(getInitialTestGroups);
  const [testMessages, setTestMessages] = React.useState(getInitialTestMessages);
  const [testReadState, setTestReadState] =
    React.useState<TestReadState>(getInitialTestReadState);
  const initializedBrowserNotificationMessagesRef = React.useRef(false);
  const browserNotifiedMessageIdsRef = React.useRef<Set<string>>(new Set());
  const initializedArrangementRecognitionMessagesRef = React.useRef(false);
  const recognizedTestMessageIdsRef = React.useRef<Set<string>>(new Set());

  const unreadAiConversationCount = Math.max(
    0,
    aiConversationTotalCount - lastReadAiConversationCount
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshTestConversations = () => {
      setTestIdentities(getInitialTestIdentities());
      setTestGroups(getInitialTestGroups());
      setTestMessages(getInitialTestMessages());
      setTestReadState(getInitialTestReadState());
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== testIdentitiesStorageKey &&
        event.key !== testGroupsStorageKey &&
        event.key !== testMessagesStorageKey &&
        event.key !== testReadStateStorageKey
      ) {
        return;
      }
      refreshTestConversations();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(testConversationStorageEvent, refreshTestConversations);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(testConversationStorageEvent, refreshTestConversations);
    };
  }, []);

  const markAiConversationAsRead = React.useCallback(() => {
    setLastReadAiConversationCount(aiConversationTotalCount);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        aiConversationReadCountStorageKey,
        String(aiConversationTotalCount)
      );
    }
  }, []);

  const makeSelfSource = React.useCallback(
    (recordUid: string): RecordSourceConversation => ({
      type: "self",
      label: t("sendToSelf.title"),
      actionLabel: t("sendToSelf.open"),
      iconLabel: t("sendToSelf.icon"),
      recordUid,
    }),
    [t]
  );

  const makeTestSource = React.useCallback(
    (
      label: string,
      iconLabel: string,
      conversationId: string,
      recordUid?: string
    ): RecordSourceConversation => ({
      type: "test",
      label,
      actionLabel: t("records.openSource"),
      iconLabel,
      conversationId,
      recordUid,
    }),
    [t]
  );

  const demoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "demo-1",
        text_content: t("records.demo1"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        create_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        update_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
      },
      {
        uid: "demo-2",
        text_content: t("records.demo2"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 45,
        create_at: recordsDemoBaseTime - 1000 * 60 * 45,
        update_at: recordsDemoBaseTime - 1000 * 60 * 45,
      },
      {
        uid: "demo-3",
        text_content: t("records.demo3"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 12,
        create_at: recordsDemoBaseTime - 1000 * 60 * 12,
        update_at: recordsDemoBaseTime - 1000 * 60 * 12,
      },
    ],
    [recordsDemoBaseTime, t]
  );

  const aiConversationRecords = React.useMemo<RecordItem[]>(
    () =>
      aiConversationLogEntries.map((entry, index) => {
        const timestamp = parseAiConversationTimestamp(
          entry.timestamp,
          recordsDemoBaseTime + index
        );
        return {
          uid: `ai-conversation-user-${index}`,
          text_content: entry.userInput,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          sourceConversation: {
            type: "ai",
            label: t("ai.title"),
            actionLabel: t("records.openSource"),
            iconLabel: "AI",
            entryIndex: index,
          },
        };
      }),
    [recordsDemoBaseTime, t]
  );

  const selfDemoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "self-demo-1",
        text_content: t("sendToSelf.demo1"),
        send_at: selfDemoBaseTime - 1000 * 60 * 28,
        create_at: selfDemoBaseTime - 1000 * 60 * 28,
        update_at: selfDemoBaseTime - 1000 * 60 * 28,
        sourceConversation: makeSelfSource("self-demo-1"),
      },
      {
        uid: "self-demo-2",
        text_content: t("sendToSelf.demo2"),
        send_at: selfDemoBaseTime - 1000 * 60 * 7,
        create_at: selfDemoBaseTime - 1000 * 60 * 7,
        update_at: selfDemoBaseTime - 1000 * 60 * 7,
        sourceConversation: makeSelfSource("self-demo-2"),
      },
    ],
    [makeSelfSource, selfDemoBaseTime, t]
  );

  const selfRecords = React.useMemo(
    () =>
      [...selfDemoRecords, ...createdSelfRecords].map((record) => ({
        ...record,
        sourceConversation: makeSelfSource(record.uid),
      })),
    [createdSelfRecords, makeSelfSource, selfDemoRecords]
  );

  const testConversationRecords = React.useMemo<TestConversationRecord[]>(
    () =>
      testMessages
        .map<TestConversationRecord | null>((message) => {
          const identity = testIdentities.find((item) => item.id === message.identityId);
          const group = testGroups.find((item) => item.id === message.conversationId);
          const isGroup = message.conversationType === "group";
          const privateIdentity =
            !isGroup
              ? testIdentities.find(
                  (item) => getPrivateConversationId(item.id) === message.conversationId
                )
              : null;
          const sourceLabel = isGroup ? group?.name : privateIdentity?.name;
          const iconLabel = isGroup ? group?.avatarLabel : privateIdentity?.avatarLabel;
          if (!sourceLabel || !iconLabel) return null;
          if (message.sender === "identity" && !identity) return null;

          const uid = `test-${message.id}`;
          return {
            uid,
            text_content: message.text,
            send_at: message.sentAt,
            create_at: message.sentAt,
            update_at: message.sentAt,
            sourceConversation: makeTestSource(
              sourceLabel,
              iconLabel,
              message.conversationId,
              uid
            ),
            sender: message.sender,
            identityId: message.identityId,
          };
        })
        .filter((record): record is TestConversationRecord => Boolean(record)),
    [makeTestSource, testGroups, testIdentities, testMessages]
  );

  const testDemoReplyRecords = React.useMemo<RecordItem[]>(
    () => testConversationRecords.filter((record) => record.sender === "demo"),
    [testConversationRecords]
  );

  const testConversationSummaries = React.useMemo<TestConversationSummary[]>(
    () => {
      const privateSummaries = testIdentities
        .map<TestConversationSummary | null>((identity) => {
          const conversationId = getPrivateConversationId(identity.id);
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === conversationId
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === conversationId
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[conversationId] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) return null;

          return {
            conversationId,
            conversationType: "private",
            title: identity.name,
            subtitle: identity.note || "测试私聊",
            avatarLabel: identity.avatarLabel,
            color: identity.color,
            identity,
            memberIdentities: [identity],
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });
      const groupSummaries = testGroups
        .map<TestConversationSummary | null>((group) => {
          const memberIdentities = group.memberIdentityIds
            .map((identityId) => testIdentities.find((identity) => identity.id === identityId))
            .filter((identity): identity is TestIdentity => Boolean(identity));
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === group.id
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === group.id
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[group.id] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) {
            return {
              conversationId: group.id,
              conversationType: "group",
              title: group.name,
              subtitle: group.note || `${memberIdentities.length} 位成员`,
              avatarLabel: group.avatarLabel,
              color: group.color,
              group,
              memberIdentities,
              records,
              latestMessage: {
                id: `empty-${group.id}`,
                conversationId: group.id,
                conversationType: "group",
                identityId: demoSenderIdentityId,
                text: "群聊能力已开启，可从后台发送群消息测试。",
                sentAt: group.createdAt,
                sender: "demo",
              },
              latestUnreadIdentityMessage: null,
              unreadCount: 0,
            };
          }

          return {
            conversationId: group.id,
            conversationType: "group",
            title: group.name,
            subtitle: group.note || `${memberIdentities.length} 位成员`,
            avatarLabel: group.avatarLabel,
            color: group.color,
            group,
            memberIdentities,
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });

      return [...privateSummaries, ...groupSummaries]
        .filter((summary): summary is TestConversationSummary => Boolean(summary))
        .sort((a, b) => b.latestMessage.sentAt - a.latestMessage.sentAt);
    },
    [testConversationRecords, testGroups, testIdentities, testMessages, testReadState]
  );

  React.useEffect(() => {
    if (!initializedArrangementRecognitionMessagesRef.current) {
      recognizedTestMessageIdsRef.current = new Set(
        testMessages.map((message) => message.id)
      );
      initializedArrangementRecognitionMessagesRef.current = true;
      return;
    }

    const knownMessageIds = recognizedTestMessageIdsRef.current;
    const newMessages = testMessages
      .filter((message) => !knownMessageIds.has(message.id))
      .sort((left, right) => left.sentAt - right.sentAt);

    if (newMessages.length === 0) return;

    for (const message of newMessages) {
      knownMessageIds.add(message.id);
      const summary = testConversationSummaries.find(
        (item) => item.conversationId === message.conversationId
      );
      if (!summary || !message.text.trim()) continue;

      const conversationMessages = testMessages
        .filter((item) => item.conversationId === message.conversationId)
        .sort((left, right) => left.sentAt - right.sentAt);

      void recognizeArrangementFromConversation({
        chatType: summary.conversationType === "group" ? "group" : "private",
        conversationId: summary.conversationId,
        conversationName: summary.title,
        currentUserName,
        triggerMessageId: message.id,
        triggerText: message.text,
        messages: toTestRecognitionMessages(
          conversationMessages,
          testIdentities,
          currentUserName
        ),
        settings: readAiSettings(),
      });
    }
  }, [currentUserName, testConversationSummaries, testIdentities, testMessages]);

  const unreadTestConversationCount = testConversationSummaries.reduce(
    (total, summary) => total + summary.unreadCount,
    0
  );
  const homeMessagePreview = React.useMemo<HomeMessagePreview | null>(
    () =>
      testConversationSummaries.reduce<HomeMessagePreview | null>(
        (latestPreview, summary) => {
          if (!summary.latestUnreadIdentityMessage) return latestPreview;
          if (
            latestPreview &&
            latestPreview.message.sentAt >= summary.latestUnreadIdentityMessage.sentAt
          ) {
            return latestPreview;
          }
          return {
            summary,
            message: summary.latestUnreadIdentityMessage,
            unreadCount: summary.unreadCount,
          };
        },
        null
      ),
    [testConversationSummaries]
  );

  const activeTestConversationSummary =
    testConversationSummaries.find(
      (summary) => summary.conversationId === activeTestIdentityId
    ) ?? null;

  const mineStatisticRecords = React.useMemo(
    () => [
      ...demoRecords,
      ...aiConversationRecords,
      ...selfRecords,
      ...testDemoReplyRecords,
    ],
    [aiConversationRecords, demoRecords, selfRecords, testDemoReplyRecords]
  );
  const recordDetailExtensionRecords = React.useMemo(
    () =>
      recordDetail
        ? mineStatisticRecords.filter(
            (record) => record.referencedRecord?.uid === recordDetail.uid
          )
        : [],
    [mineStatisticRecords, recordDetail]
  );

  const commitSearchKeyword = React.useCallback((keyword: string) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    setSearchHistory((prev) => {
      const nextHistory = [
        normalizedKeyword,
        ...prev.filter((value) => value !== normalizedKeyword),
      ].slice(0, maxSearchHistoryCount);
      persistSearchHistory(nextHistory);
      return nextHistory;
    });
  }, []);

  const createSelfRecord = React.useCallback(
    (content: string) => {
      const timestamp = Date.now();
      const nextRecord: RecordItem = {
        uid: `self-${timestamp}`,
        text_content: content,
        send_at: timestamp,
        create_at: timestamp,
        update_at: timestamp,
      };
      const nextRecords = [...createdSelfRecords, nextRecord];

      setCreatedSelfRecords(nextRecords);
      persistCreatedSelfRecords(nextRecords);
      void recognizeArrangementFromConversation({
        chatType: "self",
        conversationId: "self-chat",
        conversationName: t("sendToSelf.title"),
        currentUserName,
        triggerMessageId: nextRecord.uid,
        triggerText: nextRecord.text_content,
        messages: toSelfRecognitionMessages(nextRecords, currentUserName),
        settings: readAiSettings(),
      });
    },
    [createdSelfRecords, currentUserName, t]
  );

  const createRecordExtension = React.useCallback((parentRecord: RecordItem, content: string) => {
    const timestamp = Date.now();
    setCreatedSelfRecords((prev) => {
      const nextRecords = [
        ...prev,
        {
          uid: `self-extension-${timestamp}`,
          text_content: content,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          referencedRecord: makeRecordReference(parentRecord),
        },
      ];
      persistCreatedSelfRecords(nextRecords);
      return nextRecords;
    });
  }, []);

  const backToDrawer = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(true);
    setConversationReturnContext({ mode: "drawer" });
  };

  const backToPreviousConversationOrigin = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(false);

    if (conversationReturnContext.mode === "previous") {
      setRecordDetail(conversationReturnContext.recordDetail);
      setRecordSnapshot(conversationReturnContext.recordSnapshot);
    }

    setConversationReturnContext({ mode: "drawer" });
  };

  const handleConversationBack = () => {
    if (conversationReturnContext.mode === "drawer") {
      backToDrawer();
      return;
    }

    backToPreviousConversationOrigin();
  };

  const openAiConversation = React.useCallback(
    (
      targetIndex: number | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markAiConversationAsRead();
      setConversationReturnContext(returnContext);
      setAiConversationTargetIndex(targetIndex);
      setShowMenu(false);
      setShowSendToSelf(false);
      setShowTestConversation(false);
      setShowAiConversation(true);
    },
    [markAiConversationAsRead]
  );

  const openSendToSelf = React.useCallback(
    (
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      setConversationReturnContext(returnContext);
      setShowMenu(false);
      setSendToSelfTargetUid(targetUid);
      setShowAiConversation(false);
      setShowTestConversation(false);
      setShowSendToSelf(true);
    },
    []
  );

  const markTestConversationAsRead = React.useCallback(
    (conversationId: string) => {
      const latestMessageTime = testMessages.reduce((latest, message) => {
        if (message.conversationId !== conversationId) return latest;
        return Math.max(latest, message.sentAt);
      }, 0);

      setTestReadState((prev) => {
        const nextReadState = {
          ...prev,
          [conversationId]: latestMessageTime || Date.now(),
        };
        persistTestReadState(nextReadState);
        return nextReadState;
      });
    },
    [testMessages]
  );

  const openTestConversation = React.useCallback(
    (
      conversationId: string,
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markTestConversationAsRead(conversationId);
      setConversationReturnContext(returnContext);
      setActiveTestIdentityId(conversationId);
      setTestConversationTargetUid(targetUid);
      setShowMenu(false);
      setShowAiConversation(false);
      setShowSendToSelf(false);
      setShowTestConversation(true);
    },
    [markTestConversationAsRead]
  );

  const returnToHomeFromNotification = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.focus();
    }

    setShowSearch(false);
    setShowMenu(false);
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setConversationReturnContext({ mode: "drawer" });
    setAiConversationTargetIndex(null);
    setSendToSelfTargetUid(null);
    setActiveTestIdentityId(null);
    setTestConversationTargetUid(null);
    setSettingsView(null);
    setRecordDetail(null);
    setRecordSnapshot(null);
    onNavigate("records");
  }, [onNavigate]);

  const showBrowserMessageNotification = React.useCallback(
    (summary: TestConversationSummary, message: TestMessage) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;

      const showNotification = () => {
        const notification = new Notification(summary.title, {
          body: message.text,
          icon: "/images/logo-jiwo-green.svg",
          tag: `arkme-demo-message-${message.id}`,
        });
        notification.onclick = () => {
          notification.close();
          returnToHomeFromNotification();
        };
      };

      if (Notification.permission === "granted") {
        showNotification();
        return;
      }

      if (
        Notification.permission === "default" &&
        shouldRequestBrowserNotificationPermission()
      ) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            showNotification();
          }
        });
      }
    },
    [returnToHomeFromNotification]
  );

  React.useEffect(() => {
    if (!showTestConversation || !activeTestIdentityId) return;
    markTestConversationAsRead(activeTestIdentityId);
  }, [
    activeTestIdentityId,
    markTestConversationAsRead,
    showTestConversation,
    testMessages.length,
  ]);

  React.useEffect(() => {
    const identityMessages = testMessages.filter(
      (message) => message.sender === "identity"
    );

    if (!initializedBrowserNotificationMessagesRef.current) {
      identityMessages.forEach((message) => {
        browserNotifiedMessageIdsRef.current.add(message.id);
      });
      initializedBrowserNotificationMessagesRef.current = true;
      return;
    }

    const newIdentityMessages = identityMessages.filter(
      (message) => !browserNotifiedMessageIdsRef.current.has(message.id)
    );
    if (newIdentityMessages.length === 0) return;

    newIdentityMessages.forEach((message) => {
      browserNotifiedMessageIdsRef.current.add(message.id);
    });

    const latestMessage = newIdentityMessages.reduce((latest, message) =>
      message.sentAt > latest.sentAt ? message : latest
    );
    if (
      showTestConversation &&
      activeTestIdentityId === latestMessage.conversationId
    ) {
      return;
    }

    const summary = testConversationSummaries.find(
      (item) => item.conversationId === latestMessage.conversationId
    );
    if (!summary) return;

    showBrowserMessageNotification(summary, latestMessage);
  }, [
    activeTestIdentityId,
    showBrowserMessageNotification,
    showTestConversation,
    testConversationSummaries,
    testMessages,
  ]);

  const openHomeMessagePreview = React.useCallback(() => {
    if (!homeMessagePreview) return;

    const returnContext: ConversationReturnContext = {
      mode: "previous",
      recordDetail: null,
      recordSnapshot: null,
    };
    openTestConversation(
      homeMessagePreview.summary.conversationId,
      `test-${homeMessagePreview.message.id}`,
      returnContext
    );
  }, [homeMessagePreview, openTestConversation]);

  const createTestReply = React.useCallback((summary: TestConversationSummary, content: string) => {
    const reply = createTestReplyMessage(
      summary.conversationId,
      content,
      summary.conversationType
    );
    const nextMessages = [...testMessages, reply];
    setTestMessages(nextMessages);
    persistTestMessages(nextMessages);
    markTestConversationAsRead(summary.conversationId);
    setTestConversationTargetUid(`test-${reply.id}`);
  }, [markTestConversationAsRead, testMessages]);

  const openSourceConversation = React.useCallback(
    (source: RecordSourceConversation) => {
      const returnContext: ConversationReturnContext = {
        mode: "previous",
        recordDetail,
        recordSnapshot,
      };

      setRecordDetail(null);
      setRecordSnapshot(null);

      if (source.type === "ai" && typeof source.entryIndex === "number") {
        openAiConversation(source.entryIndex, returnContext);
        return;
      }

      if (source.type === "test" && source.conversationId) {
        openTestConversation(source.conversationId, source.recordUid ?? null, returnContext);
        return;
      }

      openSendToSelf(source.recordUid ?? null, returnContext);
    },
    [
      openAiConversation,
      openSendToSelf,
      openTestConversation,
      recordDetail,
      recordSnapshot,
    ]
  );

  const renderMainContent = () => {
    if (recordDetail) {
      return (
        <RecordFullDetailScreen
          record={recordDetail}
          extensionRecords={recordDetailExtensionRecords}
          onBack={() => setRecordDetail(null)}
          onCreateExtension={createRecordExtension}
          onOpenSource={openSourceConversation}
        />
      );
    }

    if (settingsView === "appearance") {
      return <AppearanceStyleScreen onBack={() => setSettingsView("settings")} />;
    }

    if (settingsView === "about") {
      return <AboutScreen onBack={() => setSettingsView(null)} />;
    }

    if (settingsView === "ai") {
      return <AiSettingsScreen onBack={() => setSettingsView(null)} />;
    }

    if (settingsView === "phrases") {
      return <PhraseMemoryScreen onBack={() => setSettingsView(null)} />;
    }

    if (settingsView === "settings") {
      return (
        <SettingsScreen
          onBack={() => setSettingsView(null)}
          onOpenAppearance={() => setSettingsView("appearance")}
          onOpenAiSettings={() => setSettingsView("ai")}
          onOpenPhraseMemories={() => setSettingsView("phrases")}
        />
      );
    }

    if (showAiConversation) {
      return (
        <AiToolConversationChat
          onBack={handleConversationBack}
          targetIndex={aiConversationTargetIndex}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showSendToSelf) {
      return (
        <SendToSelfConversationChat
          records={selfRecords}
          targetUid={sendToSelfTargetUid}
          onBack={handleConversationBack}
          onCreateRecord={createSelfRecord}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showTestConversation && activeTestConversationSummary) {
      return (
        <TestIdentityConversationChat
          summary={activeTestConversationSummary}
          targetUid={testConversationTargetUid}
          onBack={handleConversationBack}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onCreateReply={(content) => createTestReply(activeTestConversationSummary, content)}
        />
      );
    }

    if (showAnswerGuide) {
      return <AnswerGuideChat onBack={backToDrawer} />;
    }

    if (showSearch) {
      return (
        <SearchScreen
          searchQuery={searchQuery}
          searchHistory={searchHistory}
          records={mineStatisticRecords}
          onChangeSearchQuery={setSearchQuery}
          onCommitSearch={commitSearchKeyword}
          onClose={() => {
            commitSearchKeyword(searchQuery);
            setShowSearch(false);
          }}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onOpenSourceConversation={openSourceConversation}
        />
      );
    }

    if (currentPage === "mine") {
      return (
        <MinePreview
          records={mineStatisticRecords}
          onOpenSettings={() => setSettingsView("settings")}
          onOpenAiSettings={() => setSettingsView("ai")}
          onOpenPhraseMemories={() => setSettingsView("phrases")}
          onOpenAbout={() => setSettingsView("about")}
        />
      );
    }

    if (currentPage === "arrangements") {
      return <Arrangements />;
    }

    if (currentPage === "insight") {
      return <InsightPreview />;
    }

    return (
      <div className="flex h-full flex-col bg-bg">
        <MobileHeader
          onMenuClick={() => setShowMenu(true)}
          onSearchClick={() => setShowSearch(true)}
          unreadCount={unreadAiConversationCount + unreadTestConversationCount}
        />
        {homeMessagePreview && (
          <div className="shrink-0 bg-bg px-4 pb-2">
            <HomeNewMessagePreview
              preview={homeMessagePreview}
              onOpen={openHomeMessagePreview}
            />
          </div>
        )}
        <Records
          compactHeader
          demoRecords={[...demoRecords, ...testDemoReplyRecords]}
          aiConversationEntries={aiConversationLogEntries}
          selfRecords={selfRecords}
          onCreateSelfRecord={createSelfRecord}
          onOpenSourceConversation={openSourceConversation}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      </div>
    );
  };

  return (
    <AppShell
      mainPane={
        <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-hidden">{renderMainContent()}</main>
          {!recordDetail && !showSearch && !showAnswerGuide && !showAiConversation && !showSendToSelf && !showTestConversation && !settingsView && (
            <MobileBottomNavigation currentPage={currentPage} onNavigate={onNavigate} />
          )}
          <MobileSideDrawer
            open={showMenu}
            onClose={() => setShowMenu(false)}
            onOpenAnswerGuide={() => {
              setShowMenu(false);
              setShowAnswerGuide(true);
            }}
            onOpenAiConversation={() => {
              openAiConversation(null);
            }}
            onOpenSendToSelf={() => {
              openSendToSelf(null);
            }}
            onOpenTestConversation={(conversationId) => {
              openTestConversation(conversationId);
            }}
            unreadAiConversationCount={unreadAiConversationCount}
            selfRecords={selfRecords}
            testConversations={testConversationSummaries}
          />
          <RecordDetailSheet
            record={recordSnapshot}
            onClose={() => setRecordSnapshot(null)}
            onOpenSource={openSourceConversation}
          />
        </div>
      }
    />
  );
}

function SearchScreen({
  searchQuery,
  searchHistory,
  records,
  onChangeSearchQuery,
  onCommitSearch,
  onClose,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onOpenSourceConversation,
}: {
  searchQuery: string;
  searchHistory: string[];
  records: RecordItem[];
  onChangeSearchQuery: (value: string) => void;
  onCommitSearch: (value: string) => void;
  onClose: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onOpenSourceConversation: (source: RecordSourceConversation) => void;
}) {
  const { resolvedTheme, t } = usePreferences();
  const [activeTab, setActiveTab] = React.useState<"records" | "topics">("records");
  const [activeQuickType, setActiveQuickType] = React.useState<QuickSearchType | null>(null);
  const keyword = searchQuery.trim().toLowerCase();
  const hasSearchCondition = keyword.length > 0 || activeQuickType !== null;
  const searchTags = React.useMemo(
    () =>
      t("search.defaultTags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [t]
  );
  const emptyImageSrc =
    resolvedTheme === "dark"
      ? "/images/image_search_empty.png"
      : "/images/image_search_empty_light.png";

  const filteredRecords = React.useMemo(
    () =>
      records.filter((record) => {
        const content = record.text_content.toLowerCase();
        const matchesKeyword = !keyword || content.includes(keyword);
        const matchesQuickType =
          activeQuickType === null || recordMatchesQuickType(record, activeQuickType);
        return matchesKeyword && matchesQuickType;
      }),
    [activeQuickType, keyword, records]
  );

  const topicGroups = React.useMemo(
    () => buildSearchTopicGroups(records, t).filter((topic) => {
      if (!keyword) return topic.count > 0;
      return (
        topic.title.toLowerCase().includes(keyword) ||
        topic.description.toLowerCase().includes(keyword)
      );
    }),
    [keyword, records, t]
  );

  const handleKeywordSelect = (value: string) => {
    setActiveQuickType(null);
    onChangeSearchQuery(value);
    onCommitSearch(value);
  };

  const handleQuickSearch = (type: QuickSearchType) => {
    setActiveQuickType(type);
    setActiveTab("records");
    onChangeSearchQuery("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex h-[50px] shrink-0 items-center bg-bg pl-2.5">
        <div className="relative min-w-0 flex-1">
          <input
            value={searchQuery}
            onChange={(event) => {
              onChangeSearchQuery(event.target.value);
              setActiveQuickType(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitSearch(searchQuery);
                event.currentTarget.blur();
              }
            }}
            onBlur={() => onCommitSearch(searchQuery)}
            autoFocus
            placeholder={t("search.placeholder")}
            className="h-10 w-full rounded-[12px] bg-surface px-2.5 pr-12 text-[16px] leading-10 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-fill-2 text-text-tertiary transition active:scale-[0.94]"
              onClick={() => {
                onChangeSearchQuery("");
                setActiveQuickType(null);
              }}
              aria-label={t("search.clear")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 px-[19px] py-2 text-[16px] leading-6 text-text transition active:scale-[0.96]"
          onClick={onClose}
        >
          {t("search.cancel")}
        </button>
      </header>

      {!hasSearchCondition ? (
        <SearchLanding
          searchHistory={searchHistory}
          searchTags={searchTags}
          onKeywordSelect={handleKeywordSelect}
          onQuickSearch={handleQuickSearch}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <SearchTabs
            activeTab={activeTab}
            activeQuickType={activeQuickType}
            onChangeTab={setActiveTab}
            onClearQuickType={() => setActiveQuickType(null)}
          />
          {activeTab === "records" ? (
            filteredRecords.length > 0 ? (
              <ChatList
                records={filteredRecords}
                hasMore={false}
                loading={false}
                onLoadMore={() => undefined}
                onOpenSourceConversation={onOpenSourceConversation}
                onOpenRecordDetail={onOpenRecordDetail}
                onOpenRecordSnapshot={onOpenRecordSnapshot}
              />
            ) : (
              <SearchEmptyState
                imageSrc={emptyImageSrc}
                keyword={searchQuery || quickSearchLabel(activeQuickType, t)}
              />
            )
          ) : topicGroups.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {topicGroups.map((topic) => (
                  <button
                    key={topic.key}
                    type="button"
                    className="flex min-h-[62px] w-full items-center rounded-[12px] bg-surface px-3 text-left transition active:scale-[0.99]"
                    onClick={() => handleKeywordSelect(topic.searchKeyword)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">
                      {topic.icon}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium leading-5 text-text">
                        {topic.title}
                      </p>
                      <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
                        {formatTemplate(t("search.topicCount"), {
                          count: String(topic.count),
                        })}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-disabled" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <SearchEmptyState imageSrc={emptyImageSrc} keyword={searchQuery} />
          )}
        </div>
      )}
    </div>
  );
}

function SearchLanding({
  searchHistory,
  searchTags,
  onKeywordSelect,
  onQuickSearch,
}: {
  searchHistory: string[];
  searchTags: string[];
  onKeywordSelect: (value: string) => void;
  onQuickSearch: (type: QuickSearchType) => void;
}) {
  const { t } = usePreferences();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-[22px]">
      {searchHistory.length > 0 && (
        <section className="pb-[22px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.recent")}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {searchHistory.map((keyword) => (
              <SearchChip
                key={keyword}
                label={keyword}
                textClassName="text-text"
                onClick={() => onKeywordSelect(keyword)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
          {t("search.quickSearch")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {quickSearchTypes.map((type) => (
            <SearchChip
              key={type}
              label={quickSearchLabel(type, t)}
              textClassName="text-link"
              onClick={() => onQuickSearch(type)}
            />
          ))}
        </div>
      </section>

      {searchTags.length > 0 && (
        <section className="mt-[30px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.tags")}
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
            {searchTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="px-2 py-[3px] text-[14px] leading-5 text-link transition active:scale-[0.97]"
                onClick={() => onKeywordSelect(tag.replace(/^#/, ""))}
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SearchTabs({
  activeTab,
  activeQuickType,
  onChangeTab,
  onClearQuickType,
}: {
  activeTab: "records" | "topics";
  activeQuickType: QuickSearchType | null;
  onChangeTab: (tab: "records" | "topics") => void;
  onClearQuickType: () => void;
}) {
  const { t } = usePreferences();
  const tabs: Array<{ key: "records" | "topics"; label: string }> = [
    { key: "records", label: t("search.tabRecords") },
    { key: "topics", label: t("search.tabTopics") },
  ];

  return (
    <div className="flex h-[30px] shrink-0 items-center bg-gray-8">
      <div className="ml-[18px] flex min-w-0 flex-1 items-center gap-[30px]">
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={cn(
                "relative h-[30px] px-0 pb-1 text-[14px] leading-[24px] transition",
                selected ? "font-semibold text-primary" : "font-normal text-text"
              )}
              onClick={() => onChangeTab(tab.key)}
            >
              {tab.label}
              {selected && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-2.5 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      {activeQuickType && (
        <button
          type="button"
          className="mr-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] leading-5 text-primary transition active:scale-[0.96]"
          onClick={onClearQuickType}
        >
          {quickSearchLabel(activeQuickType, t)}
        </button>
      )}
      <button
        type="button"
        className="mr-[18px] flex h-[21px] w-[23px] items-center justify-center text-text-muted transition active:scale-[0.96]"
        aria-label={t("search.filter")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function SearchChip({
  label,
  textClassName,
  onClick,
}: {
  label: string;
  textClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-full border border-[var(--record-topic-border)] px-3 py-[3px] text-[14px] leading-5 transition active:scale-[0.97]",
        textClassName
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SearchEmptyState({ imageSrc, keyword }: { imageSrc: string; keyword: string }) {
  const { t } = usePreferences();
  const label = keyword.trim() || t("search.label");

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center px-4 pt-20 text-center">
      <div>
        <img src={imageSrc} alt="" className="mx-auto w-[140px]" aria-hidden="true" />
        <p className="mt-2.5 whitespace-pre-line text-[14px] leading-5 text-text-tertiary">
          {formatTemplate(t("search.noResult"), { keyword: label })}
        </p>
      </div>
    </div>
  );
}

function quickSearchLabel(type: QuickSearchType | null, t: (key: string) => string) {
  if (!type) return "";
  return t(`search.quick.${type}`);
}

function recordMatchesQuickType(record: RecordItem, type: QuickSearchType) {
  const content = record.text_content.toLowerCase();
  const sourceLabel = record.sourceConversation?.label.toLowerCase() ?? "";
  const combined = `${content} ${sourceLabel}`;

  switch (type) {
    case "image":
      return /图片|照片|视频|image|photo|video/.test(combined);
    case "audio":
      return /语音|音频|录音|voice|audio|recording/.test(combined);
    case "link":
      return /链接|http|link|url/.test(combined);
    case "file":
      return /文件|文档|file|document/.test(combined);
    case "longArticle":
      return Array.from(record.text_content).length >= 80;
    case "contact":
      return /联系人|同事|候选人|用户|ai|contact|user/.test(combined);
    default:
      return true;
  }
}

function buildSearchTopicGroups(records: RecordItem[], t: (key: string) => string) {
  const quickNotes = records.filter((record) => !record.sourceConversation);
  const selfNotes = records.filter((record) => record.sourceConversation?.type === "self");
  const aiNotes = records.filter((record) => record.sourceConversation?.type === "ai");

  return [
    {
      key: "quick",
      icon: t("search.topicQuickIcon"),
      title: t("records.title"),
      description: t("recordDetail.quickNoteSource"),
      count: quickNotes.length,
      searchKeyword: t("records.title"),
    },
    {
      key: "self",
      icon: t("sendToSelf.icon"),
      title: t("sendToSelf.title"),
      description: t("sendToSelf.privateTag"),
      count: selfNotes.length,
      searchKeyword: t("sendToSelf.title"),
    },
    {
      key: "ai",
      icon: "AI",
      title: t("ai.title"),
      description: t("ai.rounds"),
      count: aiNotes.length,
      searchKeyword: "AI",
    },
  ];
}

function MobileHeader({
  onMenuClick,
  onSearchClick,
  unreadCount,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
  unreadCount: number;
}) {
  const { appIcon, resolvedTheme, t } = usePreferences();
  const logoSrc = getJiwoLogoSrc(appIcon, resolvedTheme);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-bg px-4">
      <button
        type="button"
        className="flex h-9 items-center gap-[2px] text-text transition active:scale-[0.96]"
        onClick={onMenuClick}
        aria-label={t("common.openMenu")}
      >
        <span className="flex h-9 w-5 items-center justify-center">
          <svg
            className="h-6 w-5"
            viewBox="0 0 20 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5 6.25C5 5.55964 5.55964 5 6.25 5H12.75C13.4404 5 14 5.55964 14 6.25C14 6.94036 13.4404 7.5 12.75 7.5H6.25C5.55964 7.5 5 6.94036 5 6.25ZM5 12.25C5 11.5596 5.55964 11 6.25 11H15.75C16.4404 11 17 11.5596 17 12.25C17 12.9404 16.4404 13.5 15.75 13.5H6.25C5.55964 13.5 5 12.9404 5 12.25ZM6.25 17C5.55964 17 5 17.5596 5 18.25C5 18.9404 5.55964 19.5 6.25 19.5H9.75C10.4404 19.5 11 18.9404 11 18.25C11 17.5596 10.4404 17 9.75 17H6.25Z"
              fill="currentColor"
            />
          </svg>
        </span>
        {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
        <img src={logoSrc} alt="" className="h-8 w-8" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onSearchClick}
          aria-label={t("search.label")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 25 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.0969 19.0453C14.9754 19.0453 18.1196 15.9012 18.1196 12.0227C18.1196 8.14416 14.9754 5 11.0969 5C7.21838 5 4.07422 8.14416 4.07422 12.0227C4.07422 15.9012 7.21838 19.0453 11.0969 19.0453ZM11.0969 21.0453C16.08 21.0453 20.1196 17.0058 20.1196 12.0227C20.1196 7.03959 16.08 3 11.0969 3C6.11381 3 2.07422 7.03959 2.07422 12.0227C2.07422 17.0058 6.11381 21.0453 11.0969 21.0453Z"
              fill="currentColor"
            />
            <path
              d="M16.8203 17.8184L19.7295 20.7282"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

function HomeNewMessagePreview({
  preview,
  onOpen,
}: {
  preview: HomeMessagePreview;
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const unreadLabel = formatUnreadCount(preview.unreadCount);

  return (
    <button
      type="button"
      className="flex w-full items-center rounded-[16px] border border-border-light bg-surface px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
      onClick={onOpen}
      aria-label={`${t("homeMessagePreview.label")}，${preview.summary.title}`}
    >
      <AvatarUnreadWrap unreadCount={preview.unreadCount}>
        <TestConversationAvatar summary={preview.summary} className="h-[34px] w-[34px]" />
      </AvatarUnreadWrap>
      <div className="ml-3 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[14px] font-medium leading-5 text-text">
              {preview.summary.title}
            </p>
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-[2px] text-[10px] font-medium leading-3 text-primary">
              {t("homeMessagePreview.label")}
            </span>
          </div>
          <span className="shrink-0 text-[11px] leading-4 text-text-tertiary">
            {formatBubbleTime(preview.message.sentAt)}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs leading-4 text-text-muted">
            {preview.message.text}
          </p>
          <span className="shrink-0 text-[11px] leading-4 text-primary">
            {unreadLabel}
            {t("common.unreadCount")}
          </span>
        </div>
      </div>
      <svg
        className="ml-2 h-4 w-4 shrink-0 text-text-tertiary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function getLatestRecord(records: RecordItem[]) {
  return records.reduce<RecordItem | null>((latest, record) => {
    if (!latest || record.send_at > latest.send_at) return record;
    return latest;
  }, null);
}

function MobileSideDrawer({
  open,
  onClose,
  onOpenAnswerGuide,
  onOpenAiConversation,
  onOpenSendToSelf,
  onOpenTestConversation,
  unreadAiConversationCount,
  selfRecords,
  testConversations,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAnswerGuide: () => void;
  onOpenAiConversation: () => void;
  onOpenSendToSelf: () => void;
  onOpenTestConversation: (conversationId: string) => void;
  unreadAiConversationCount: number;
  selfRecords: RecordItem[];
  testConversations: TestConversationSummary[];
}) {
  const { t } = usePreferences();
  const latestSelfRecord = React.useMemo(
    () => getLatestRecord(selfRecords),
    [selfRecords]
  );
  const latestAiEntry = aiConversationLogEntries.at(-1);
  const latestAiTime = latestAiEntry
    ? parseAiConversationTimestamp(latestAiEntry.timestamp, 0)
    : 0;
  const conversationItems = React.useMemo(
    () =>
      [
        {
          key: "self",
          latestAt: latestSelfRecord?.send_at ?? 0,
          node: (
            <SendToSelfDrawerItem
              records={selfRecords}
              latestRecord={latestSelfRecord}
              onClick={onOpenSendToSelf}
            />
          ),
        },
        {
          key: "ai",
          latestAt: latestAiTime,
          node: (
            <AiToolConversationItem
              onClick={onOpenAiConversation}
              unreadCount={unreadAiConversationCount}
              latestAt={latestAiTime}
            />
          ),
        },
        ...testConversations.map((summary) => ({
          key: `test-${summary.conversationId}`,
          latestAt: summary.latestMessage.sentAt,
          node: (
            <TestConversationDrawerItem
              summary={summary}
              onClick={() => onOpenTestConversation(summary.conversationId)}
            />
          ),
        })),
      ].sort((a, b) => b.latestAt - a.latestAt),
    [
      latestAiTime,
      latestSelfRecord,
      onOpenAiConversation,
      onOpenSendToSelf,
      onOpenTestConversation,
      selfRecords,
      testConversations,
      unreadAiConversationCount,
    ]
  );

  return (
    <div
      className={cn(
        "absolute inset-x-0 -top-9 z-50 h-[calc(100%+36px)] transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-overlay-light transition-opacity duration-150 ease-out",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-label={t("drawer.closeMask")}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full w-[296px] max-w-[82%] flex-col bg-surface px-4 pb-4 pt-[52px] shadow-[8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-[180ms] ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label={t("drawer.label")}
      >
        <h2 className="-mx-1 px-3 pb-[5px] pt-[3px] text-xl font-semibold leading-[1.2] text-text">
          {t("drawer.title")}
        </h2>

        <nav className="-mx-4 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3">
          <GuideConversationItem onClick={onOpenAnswerGuide} />
          {conversationItems.map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </nav>

        <div className="mt-auto rounded-[12px] bg-bg px-3 py-3">
          <p className="text-xs font-semibold text-text">{t("drawer.footerTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
            {t("drawer.footerDesc")}
          </p>
        </div>
      </aside>
    </div>
  );
}

function SendToSelfDrawerItem({
  records,
  latestRecord,
  onClick,
}: {
  records: RecordItem[];
  latestRecord: RecordItem | null;
  onClick: () => void;
}) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            <p className="truncate text-[16px] font-normal leading-6 text-text">
              {t("sendToSelf.title")}
            </p>
            <OverviewEntryTag label={t("sendToSelf.privateTag")} />
          </div>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestRecord
              ? formatBubbleTime(latestRecord.send_at)
              : formatRoundCount(records.length, t("sendToSelf.recordCount"))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestRecord?.text_content ?? t("sendToSelf.emptyPreview")}
        </p>
      </div>
    </button>
  );
}

function GuideConversationItem({ onClick }: { onClick: () => void }) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-[11px] font-semibold text-primary">
        {t("guide.avatar")}
      </div>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("guide.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {t("guide.pinned")}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {t("guide.subtitle")}
        </p>
      </div>
    </button>
  );
}

function AvatarUnreadWrap({
  unreadCount,
  children,
}: {
  unreadCount: number;
  children: React.ReactNode;
}) {
  const label = formatUnreadCount(unreadCount);

  return (
    <span className="relative shrink-0">
      {children}
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary text-[10px] font-normal leading-none text-on-primary",
            label.length > 1 ? "px-[4px]" : "px-0"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function AiToolConversationItem({
  onClick,
  unreadCount,
  latestAt,
}: {
  onClick: () => void;
  unreadCount: number;
  latestAt: number;
}) {
  const { t } = usePreferences();
  const latestEntry = aiConversationLogEntries.at(-1);

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={unreadCount}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
          AI
        </div>
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("ai.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestAt > 0
              ? formatBubbleTime(latestAt)
              : `${aiConversationLogEntries.length}${t("ai.rounds")}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestEntry?.userInput ?? t("ai.emptyTitle")}
        </p>
      </div>
    </button>
  );
}

function TestConversationDrawerItem({
  summary,
  onClick,
}: {
  summary: TestConversationSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={summary.unreadCount}>
        <TestConversationAvatar summary={summary} className="h-[30px] w-[30px]" />
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {summary.title}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {formatBubbleTime(summary.latestMessage.sentAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {summary.conversationType === "group" &&
          summary.latestMessage.sender === "identity"
            ? `${summary.memberIdentities.find((identity) => identity.id === summary.latestMessage.identityId)?.name ?? "成员"}：${summary.latestMessage.text}`
            : summary.latestMessage.text}
        </p>
      </div>
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const { t } = usePreferences();
  const label = formatUnreadCount(count);

  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-normal leading-[14px] text-on-primary",
        label.length > 1 ? "px-[5px]" : "px-0"
      )}
      aria-label={`${label}${t("common.unreadCount")}`}
    >
      {label}
    </span>
  );
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function AiToolConversationChat({
  onBack,
  targetIndex,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  onBack: () => void;
  targetIndex?: number | null;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const entryRefs = React.useRef<Array<HTMLElement | null>>([]);
  const fallbackBaseTime = React.useMemo(() => Date.now(), []);

  const makeUserInputRecord = React.useCallback(
    (entry: (typeof aiConversationLogEntries)[number], index: number): RecordItem => {
      const timestamp = parseAiConversationTimestamp(
        entry.timestamp,
        fallbackBaseTime + index
      );
      return {
        uid: `ai-conversation-user-${index}`,
        text_content: entry.userInput,
        send_at: timestamp,
        create_at: timestamp,
        update_at: timestamp,
        sourceConversation: {
          type: "ai",
          label: t("ai.title"),
          actionLabel: t("records.openSource"),
          iconLabel: "AI",
          entryIndex: index,
        },
      };
    },
    [fallbackBaseTime, t]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (targetIndex !== null && targetIndex !== undefined) {
      entryRefs.current[targetIndex]?.scrollIntoView({
        block: "center",
      });
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [targetIndex]);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
            AI
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("ai.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(aiConversationLogEntries.length, t("ai.rounds"))}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-4"
      >
        {aiConversationLogEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-sm font-semibold text-primary">
                AI
              </div>
              <p className="mt-4 text-sm font-semibold text-text">
                {t("ai.emptyTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {t("ai.emptyDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            {aiConversationLogEntries.map((entry, index) => (
              <section
                key={`${entry.timestamp}-${index}`}
                ref={(node) => {
                  entryRefs.current[index] = node;
                }}
                className={cn(
                  "min-w-0 scroll-mt-4 space-y-3 transition-colors duration-300",
                  targetIndex === index && "-m-1 rounded-[18px] bg-primary-soft/70 p-1"
                )}
              >
                <div className="flex justify-center">
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                    {entry.timestamp}
                  </span>
                </div>

                <div className="flex min-w-0 justify-end gap-2">
                  <div className="-mx-4 min-w-0 flex-1">
                    {(() => {
                      const userInputRecord = makeUserInputRecord(entry, index);
                      return (
                        <ChatBubble
                          textContent={userInputRecord.text_content}
                          disableAnimation
                          variant="primary"
                          onOpenDetail={() => onOpenRecordDetail(userInputRecord)}
                          onOpenMemorySnapshot={() =>
                            onOpenRecordSnapshot(userInputRecord)
                          }
                        />
                      );
                    })()}
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
                    AI
                  </div>
                  <div className="min-w-0 max-w-[82%]">
                    <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                      {t("ai.output")}
                    </p>
                    <div className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-text [overflow-wrap:anywhere]">
                        {entry.aiFinalOutput}
                      </p>
                    </div>

                    <div className="mt-2 min-w-0 max-w-full rounded-[10px] bg-surface-muted px-3 py-2">
                      <p className="text-[11px] font-semibold leading-4 text-text">
                        {t("ai.changedFiles")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.changedFiles.map((file) => (
                          <li key={file} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {file}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] font-semibold leading-4 text-text">
                        {t("ai.verification")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.verification.map((item) => (
                          <li key={item} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendToSelfConversationChat({
  records,
  targetUid,
  onBack,
  onCreateRecord,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  records: RecordItem[];
  targetUid?: string | null;
  onBack: () => void;
  onCreateRecord: (content: string) => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const recordsWithoutSource = React.useMemo(
    () => records.map(({ sourceConversation: _sourceConversation, ...record }) => record),
    [records]
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <h1 className="truncate text-[18px] font-normal leading-6 text-text">
                {t("sendToSelf.title")}
              </h1>
              <OverviewEntryTag label={t("sendToSelf.privateTag")} />
            </div>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(records.length, t("sendToSelf.recordCount"))}
            </p>
          </div>
        </div>
      </header>

      <ChatList
        records={recordsWithoutSource}
        hasMore={false}
        loading={false}
        onLoadMore={() => undefined}
        targetRecordUid={targetUid}
        onOpenRecordDetail={onOpenRecordDetail}
        onOpenRecordSnapshot={onOpenRecordSnapshot}
      />
      <ChatInput
        onSubmit={onCreateRecord}
        onVoiceSubmit={() => onCreateRecord(t("records.voiceRecord"))}
      />
    </div>
  );
}

function TestIdentityConversationChat({
  summary,
  targetUid,
  onBack,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onCreateReply,
}: {
  summary: TestConversationSummary;
  targetUid?: string | null;
  onBack: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onCreateReply: (content: string) => void;
}) {
  const { resolvedLocale, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const selfDisplayName = candidateProfile?.name || t("recordDetail.me");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const recordRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const sortedRecords = React.useMemo(
    () => [...summary.records].sort((a, b) => a.send_at - b.send_at),
    [summary.records]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (targetUid) {
      recordRefs.current.get(targetUid)?.scrollIntoView({ block: "center" });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [sortedRecords.length, targetUid]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <TestConversationAvatar summary={summary} className="h-8 w-8" />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {summary.title}
            </h1>
            <p className="mt-0.5 truncate text-[11px] leading-3 text-text-tertiary">
              {summary.subtitle}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4"
      >
        <div className="space-y-3">
          {sortedRecords.map((record, index) => {
            const prevRecord = sortedRecords[index - 1];
            const showTime =
              index === 0 || shouldShowConversationTime(prevRecord.send_at, record.send_at);

            return (
              <div
                key={record.uid}
                ref={(node) => {
                  if (node) {
                    recordRefs.current.set(record.uid, node);
                  } else {
                    recordRefs.current.delete(record.uid);
                  }
                }}
                className={cn(
                  "scroll-mt-4",
                  targetUid === record.uid && "rounded-[18px] bg-primary-soft/70 py-1"
                )}
              >
                {showTime && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                      {formatTimeLabel(record.send_at, {
                        locale: resolvedLocale,
                        today: t("time.today"),
                        yesterday: t("time.yesterday"),
                        dayBeforeYesterday: t("time.dayBeforeYesterday"),
                      })}{" "}
                      {formatBubbleTime(record.send_at)}
                    </span>
                  </div>
                )}
                {record.sender === "demo" ? (
                  <div className="-mx-4">
                    <ChatBubble
                      textContent={record.text_content}
                      disableAnimation
                      variant="primary"
                      topLabel={
                        summary.conversationType === "group" ? selfDisplayName : undefined
                      }
                      onOpenDetail={() => onOpenRecordDetail(record)}
                      onOpenMemorySnapshot={() => onOpenRecordSnapshot(record)}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <TestMessageIdentityAvatar
                      identityId={record.identityId}
                      summary={summary}
                    />
                    <div className="min-w-0 max-w-[82%]">
                      {summary.conversationType === "group" && (
                        <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                          {summary.memberIdentities.find(
                            (identity) => identity.id === record.identityId
                          )?.name ?? "群成员"}
                        </p>
                      )}
                      <button
                        type="button"
                        className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 text-left text-text shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99]"
                        onClick={() => onOpenRecordDetail(record)}
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
                          {record.text_content}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ChatInput
        onSubmit={onCreateReply}
        onVoiceSubmit={() => onCreateReply(t("records.voiceRecord"))}
      />
    </div>
  );
}

function shouldShowConversationTime(prevSendAt: number, currentSendAt: number) {
  return Math.abs(currentSendAt - prevSendAt) > 1000 * 60 * 5;
}

function TestIdentityAvatar({
  identity,
  className,
}: {
  identity: TestIdentity;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: identity.color }}
      aria-hidden="true"
    >
      {identity.avatarLabel}
    </div>
  );
}

function TestConversationAvatar({
  summary,
  className,
}: {
  summary: TestConversationSummary;
  className?: string;
}) {
  if (summary.identity) {
    return <TestIdentityAvatar identity={summary.identity} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: summary.color }}
      aria-hidden="true"
    >
      {summary.avatarLabel}
    </div>
  );
}

function TestMessageIdentityAvatar({
  identityId,
  summary,
}: {
  identityId: string;
  summary: TestConversationSummary;
}) {
  const identity =
    summary.memberIdentities.find((item) => item.id === identityId) ?? summary.identity;

  if (identity) {
    return <TestIdentityAvatar identity={identity} className="mt-0.5 h-8 w-8" />;
  }

  return <TestConversationAvatar summary={summary} className="mt-0.5 h-8 w-8" />;
}

function AnswerGuideChat({ onBack }: { onBack: () => void }) {
  const { resolvedLocale, t } = usePreferences();
  const guideTime = React.useMemo(() => Date.now(), []);
  const answerGuideMessages = [
    t("guide.message1"),
    t("guide.message2"),
    t("guide.message3"),
    t("guide.message4"),
    t("guide.message5"),
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
            {t("guide.avatar")}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("guide.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {t("guide.scope")}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
            {formatTimeLabel(guideTime, {
              locale: resolvedLocale,
              today: t("time.today"),
              yesterday: t("time.yesterday"),
              dayBeforeYesterday: t("time.dayBeforeYesterday"),
            })}{" "}
            {formatBubbleTime(guideTime)}
          </span>
        </div>
        <div className="space-y-3">
          {answerGuideMessages.map((message, index) => (
            <div key={message} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
                {t("guide.avatar")}
              </div>
              <div className="max-w-[78%]">
                <div className="rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-text">
                    {message}
                  </p>
                </div>
                {index === 0 && (
                  <p className="mt-1 px-1 text-[11px] leading-4 text-text-tertiary">
                    {t("guide.title")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileBottomNavigation({
  currentPage,
  onNavigate,
}: {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}) {
  const { t } = usePreferences();

  return (
    <nav className="shrink-0 bg-bg px-2 pb-3 pt-1">
      <div className="flex h-12 items-center">
        {tabs.map((tab) => {
          const active = tab.key === currentPage;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onNavigate(tab.key)}
              className={cn(
                "flex h-full flex-1 items-center justify-center rounded-[10px] text-base transition active:scale-[0.98]",
                active
                  ? "font-semibold text-text"
                  : "font-normal text-text-tertiary"
              )}
            >
              {getTabLabel(tab.key, t)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function InsightPreview() {
  const { t } = usePreferences();

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center bg-bg px-4">
        <h1 className="text-lg font-semibold text-text">{t("insight.title")}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-text">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-text">
            {t("insight.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("insight.emptyDesc")}</p>
        </div>
      </div>
    </div>
  );
}

function MinePreview({
  records,
  onOpenSettings,
  onOpenAiSettings,
  onOpenPhraseMemories,
  onOpenAbout,
}: {
  records: RecordItem[];
  onOpenSettings: () => void;
  onOpenAiSettings: () => void;
  onOpenPhraseMemories: () => void;
  onOpenAbout: () => void;
}) {
  const { resolvedLocale, resolvedTheme, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const mineImagePrefix = resolvedTheme === "dark" ? "/images/mine/theme_dark/" : "/images/mine/";
  const mineUserName = candidateProfile?.name || t("mine.user");
  const mineAvatarLabel =
    candidateProfile?.avatarLabel || t("recordDetail.me").slice(0, 1);
  const quickNoteCount = records.length;
  const wordCount = records.reduce(
    (total, record) => total + countRecordTextLength(record.text_content),
    0
  );
  const quickNoteCountText = formatNumberForLocale(quickNoteCount, resolvedLocale);
  const wordCountText = formatNumberForLocale(wordCount, resolvedLocale);
  const mineStats = [
    t("mine.stat1"),
    formatStatTemplate(t("mine.stat2"), {
      count: quickNoteCountText,
      places: "0",
    }),
    t("mine.stat3"),
    formatStatTemplate(t("mine.stat4"), {
      words: wordCountText,
    }),
  ];
  const mineDataTags = [
    t("mine.tagImportExport"),
    t("mine.tagDataSecurity"),
    t("mine.tagPrivacy"),
  ];

  return (
    <div className="h-full overflow-y-auto bg-bg pb-4">
      <section className="relative overflow-hidden pb-5 pt-10">
        <img
          src="/images/mine/image_mine_page_background.png"
          alt=""
          className="pointer-events-none absolute -right-[52px] -top-11 h-[273px] w-[375px] max-w-none object-cover"
          aria-hidden="true"
        />

        <button
          type="button"
          className="absolute right-0 top-14 z-10 flex w-[98px] items-center rounded-l-[10px] bg-[var(--mine-world-bg)] py-[7px] pl-3 pr-1.5 text-[14px] leading-4 text-text transition active:scale-[0.98]"
        >
          {t("mine.world")}
          <ChevronRightIcon className="ml-0.5 h-4 w-4 shrink-0 text-text" />
        </button>

        <div className="relative z-10 flex items-center pl-4 pr-[112px]">
          <div
            className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border border-border-strong/80 bg-primary text-[23px] font-semibold leading-none text-on-primary shadow-[var(--mine-card-shadow)]"
            aria-label={t("mine.avatarAlt")}
          >
            {mineAvatarLabel}
          </div>
          <div className="ml-3 min-w-0">
            <div className="flex items-center">
              <p className="truncate text-xl leading-5 text-text">{mineUserName}</p>
              <ChevronRightIcon className="ml-1.5 h-4 w-4 shrink-0 text-text-disabled" />
            </div>
            <div className="mt-3 flex h-4 items-center">
              <div className="h-[3px] w-[83px] overflow-hidden rounded-full bg-[rgba(136,136,136,0.2)]">
                <div className="h-full w-[18%] rounded-full bg-primary" />
              </div>
              <p className="ml-2 text-xs leading-4 text-text-tertiary">
                {t("mine.storage")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-2.5 pt-[50px]">
        <button
          type="button"
          className="absolute left-2.5 right-2.5 top-2.5 z-0 flex min-h-[70px] items-start rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-member-bg)] px-2.5 pb-3 pt-3 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center">
              <p className="shrink-0 text-sm font-bold leading-4 text-text">
                {t("mine.memberTitle")}
              </p>
              <p className="ml-1.5 truncate text-xs leading-4 text-text-tertiary">
                {t("mine.memberDesc")}
              </p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center text-sm leading-4 text-primary">
            {t("mine.memberAction")}
            <ChevronRightIcon className="h-4 w-4" />
          </div>
        </button>

        <div className="relative z-10 overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] shadow-[var(--mine-card-shadow)]">
          <img
            src={`${mineImagePrefix}image_mine_page_migong_background.png`}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-[179px] w-[179px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm leading-[22px] text-text-tertiary">
                {t("mine.statsTitle")}
              </p>
              <button
                type="button"
                className="ml-3 flex shrink-0 items-center text-sm leading-[22px] text-text-tertiary transition active:scale-[0.98]"
              >
                {t("mine.statsButton")}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 space-y-0.5">
              {mineStats.map((line) => (
                <p key={line} className="text-base leading-7 text-text">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-2.5 px-2.5">
        <button
          type="button"
          className="relative w-full overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <img
            src={`${mineImagePrefix}image_mine_page_datamanager_protect_background.png`}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-24 w-[106px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <h2 className="text-base font-bold leading-6 text-text">
              {t("mine.dataTitle")}
            </h2>
            <p className="mt-px text-sm leading-5 text-text-tertiary">
              {t("mine.dataDesc")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mineDataTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[8px] bg-[rgba(136,136,136,0.12)] px-2 py-1 text-xs leading-4 text-text-tertiary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <MineActionCard
            title="AI 设置"
            description="配置大模型能力"
            onClick={onOpenAiSettings}
          />
          <MineActionCard
            title="个性化用语"
            description="解释暗号、简称和昵称"
            onClick={onOpenPhraseMemories}
          />
          <MineActionCard
            title={t("mine.settings")}
            description={t("mine.settingsDesc")}
            onClick={onOpenSettings}
          />
          <MineActionCard
            title={t("mine.about")}
            description={t("mine.aboutDesc")}
            onClick={onOpenAbout}
          />
        </div>
      </section>
    </div>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const { t } = usePreferences();
  const legalLinks = [
    {
      title: t("about.userAgreement"),
      url: "https://www.jiwo.cc/article/user-aggrement-v1.html",
    },
    {
      title: t("about.privacyTerms"),
      url: "https://www.jiwo.cc/article/privacy-aggrement-v1.html",
    },
    {
      title: t("about.privacyStatement"),
      url: "https://www.jiwo.cc/article/privacy-protect-v1.html?canReset=true",
    },
  ];
  const runLinks = [
    {
      title: t("about.wechatOfficial"),
      icon: "/images/about/icon_run_weixin_gongzhonghao.svg",
      url: "/images/about/image_wxgongzhonghao_qrcode.png",
    },
    {
      title: t("about.xiaohongshu"),
      icon: "/images/about/icon_run_xiaohongshu.svg",
      url: "https://www.xiaohongshu.com/user/profile/645464ff00000000290168b1?xhsshare=CopyLink&appuid=645464ff00000000290168b1&apptime=1716282708",
    },
    {
      title: t("about.douyin"),
      icon: "/images/about/icon_run_douyin.png",
      url: "https://www.douyin.com/user/MS4wLjABAAAACyK_g4xd0gUVN4ViU4FigeAYc2RFPO-sEp9RjXc6C4OWmDF9cJx9nzXBSEDw2J-C",
    },
    {
      title: t("about.jike"),
      icon: "/images/about/icon_run_jike.svg",
      url: "https://okjk.co/tHwXUq",
    },
    {
      title: t("about.weibo"),
      icon: "/images/about/icon_run_weibo.svg",
      url: "https://weibo.com/u/7960184078",
    },
  ];
  const footerRecords = [
    "ICP备案号：鄂ICP备2024037215号",
    "增值电信业务经营许可证：鄂B2-20240478",
    "模型名称：DeepSeek-R1",
    "互联网信息服务算法备案号：网信算备330110507206401230035号",
    "软著：软著登字第14519261号",
    "森奇思(武汉)科技有限公司",
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("mine.about")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-2.5">
          <section className="flex flex-col items-center pt-[35px]">
            <img
              src="/images/about/icon_logo_jiwo.png"
              alt={t("about.appName")}
              className="h-[72px] w-[72px] rounded-[12px] object-cover"
            />
            <h1 className="mt-[5px] text-[24px] font-medium leading-[34px] text-text">
              {t("about.appName")}
            </h1>
            <p className="text-[14px] leading-[14px] text-text-muted">v0.1.0</p>
          </section>

          <section className="mt-[22px] overflow-hidden rounded-[12px] bg-surface shadow-[var(--mine-card-shadow)]">
            {legalLinks.map((item) => (
              <AboutListItem
                key={item.title}
                title={item.title}
                onClick={() => openExternalLink(item.url)}
              />
            ))}
            <AboutListItem
              title={t("about.appReview")}
              rightLabel={t("about.appReviewTip")}
              onClick={() =>
                openExternalLink(
                  "https://apps.apple.com/app/id6480506979?action=write-review"
                )
              }
            />
            <AboutListItem
              title={t("about.contactAuthor")}
              description={t("about.contactAuthorDesc")}
              external
              onClick={() => openExternalLink("https://jiwo.cc/arkmets")}
            />
          </section>

          <footer className="mt-auto flex flex-col items-center pb-3 pt-10 text-center">
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.appName")}
            </p>
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.socialChannels")}
            </p>
            <div className="mt-[11px] flex items-center justify-center gap-2.5">
              {runLinks.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-[0.96]"
                  onClick={() => openExternalLink(item.url)}
                  aria-label={item.title}
                >
                  <img src={item.icon} alt="" className="h-9 w-9" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-[42px] space-y-0.5">
              {footerRecords.map((record) => (
                <p
                  key={record}
                  className="px-2 text-[10px] leading-4 text-text-disabled"
                >
                  {record}
                </p>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function AboutListItem({
  title,
  description,
  rightLabel,
  external,
  onClick,
}: {
  title: string;
  description?: string;
  rightLabel?: string;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[50px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 text-text">{title}</p>
        {description && (
          <p className="mt-0.5 truncate text-xs leading-4 text-text-tertiary">
            {description}
          </p>
        )}
      </div>
      {rightLabel && (
        <span className="ml-2 max-w-[128px] truncate text-sm leading-5 text-text-tertiary">
          {rightLabel}
        </span>
      )}
      {external ? (
        <ExternalLinkIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      ) : (
        <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      )}
    </button>
  );
}

function MineActionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[74px] rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] px-3 pb-2.5 pt-2.5 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
    >
      <h2 className="text-base font-bold leading-6 text-text">{title}</h2>
      <p className="mt-px text-sm leading-5 text-text-tertiary">{description}</p>
    </button>
  );
}

function AiSettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = React.useState(readAiSettings);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState("");
  const [testingApi, setTestingApi] = React.useState(false);
  const [testMessage, setTestMessage] = React.useState("");
  const [recognitionLogs, setRecognitionLogs] = React.useState(() =>
    getInitialAiRecognitionLogs().slice(0, 5)
  );

  const updateSetting = <TKey extends keyof AiSettings>(
    key: TKey,
    value: AiSettings[TKey]
  ) => {
    setSavedMessage("");
    setTestMessage("");
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveSettings = () => {
    const nextSettings: AiSettings = {
      apiKey: settings.apiKey.trim(),
      baseUrl: settings.baseUrl.trim(),
      model: settings.model.trim(),
      arrangementRecognitionEnabled: settings.arrangementRecognitionEnabled,
    };
    persistAiSettings(nextSettings);
    setSettings(nextSettings);
    setSavedMessage("已保存");
  };

  const refreshRecognitionLogs = () => {
    setRecognitionLogs(getInitialAiRecognitionLogs().slice(0, 5));
  };

  const testApiConnection = async () => {
    const nextSettings: AiSettings = {
      apiKey: settings.apiKey.trim(),
      baseUrl: settings.baseUrl.trim(),
      model: settings.model.trim(),
      arrangementRecognitionEnabled: settings.arrangementRecognitionEnabled,
    };
    const missingFields = [
      !nextSettings.apiKey ? "API Key" : "",
      !nextSettings.baseUrl ? "Base URL" : "",
      !nextSettings.model ? "Model" : "",
    ].filter(Boolean);

    setSavedMessage("");
    setTestMessage("");

    if (missingFields.length > 0) {
      setTestMessage(`缺少配置：${missingFields.join("、")}`);
      return;
    }

    setTestingApi(true);
    try {
      const response = await fetch(getChatCompletionsUrl(nextSettings.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nextSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: nextSettings.model,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: '只返回 JSON：{"ok":true}',
            },
          ],
        }),
      });
      const responseBody = (await response.json().catch(() => null)) as
        | ChatCompletionsResponseBody
        | null;

      if (!response.ok) {
        setTestMessage(
          responseBody?.error?.message || `连接失败：HTTP ${response.status}`
        );
        return;
      }

      const content = responseBody?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        setTestMessage("连接失败：模型没有返回文本结果");
        return;
      }

      const parsedValue = JSON.parse(extractJsonPayload(content)) as { ok?: unknown };
      setTestMessage(parsedValue.ok === true ? "连接成功" : "连接成功，但模型未按 JSON 返回");
    } catch (error) {
      setTestMessage(
        error instanceof Error
          ? `连接失败：${error.message}`
          : "连接失败：可能是网络或 CORS 问题"
      );
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title="AI 设置" onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 pb-4 pt-3 shadow-[var(--mine-card-shadow)]">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            大模型 API
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            这里保存用户自己的 OpenAI-compatible 配置，后续安排识别会使用这些信息。
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                API Key
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(event) => updateSetting("apiKey", event.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="h-10 shrink-0 rounded-[12px] px-3 text-xs font-medium text-primary transition hover:bg-hover-overlay active:scale-[0.98]"
                  onClick={() => setShowApiKey((value) => !value)}
                >
                  {showApiKey ? "隐藏" : "显示"}
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                用户自己的大模型密钥；可以留空。
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                Base URL
              </span>
              <Input
                value={settings.baseUrl}
                onChange={(event) => updateSetting("baseUrl", event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                用于兼容不同 OpenAI-compatible 服务。
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                模型名 Model
              </span>
              <Input
                value={settings.model}
                onChange={(event) => updateSetting("model", event.target.value)}
                placeholder="例如：gpt-4o-mini、deepseek-chat"
              />
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                允许自由填写，后续 AI 调用时再使用。
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-[12px] bg-surface-muted px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-5 text-text">
                  API 连通性
                </h3>
                <p className="mt-0.5 text-[11px] leading-4 text-text-tertiary">
                  使用当前填写内容发送极简请求，不会保存或记录 API Key。
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 shrink-0 rounded-[12px] px-3 text-xs"
                loading={testingApi}
                onClick={testApiConnection}
              >
                测试 API
              </Button>
            </div>
            {testMessage && (
              <p
                className={
                  testMessage === "连接成功"
                    ? "mt-2 text-xs font-medium text-primary"
                    : "mt-2 text-xs font-medium text-danger"
                }
              >
                {testMessage}
              </p>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)]">
          <label className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-5 text-text">
                安排识别
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                开启后，会在发给自己、私聊和群聊中后台识别与我相关的安排。
              </p>
            </div>
            <button
              type="button"
              className={
                settings.arrangementRecognitionEnabled
                  ? "relative h-7 w-12 shrink-0 rounded-full bg-primary transition"
                  : "relative h-7 w-12 shrink-0 rounded-full bg-fill-1 transition"
              }
              onClick={() =>
                updateSetting(
                  "arrangementRecognitionEnabled",
                  !settings.arrangementRecognitionEnabled
                )
              }
              aria-pressed={settings.arrangementRecognitionEnabled}
            >
              <span
                className={
                  settings.arrangementRecognitionEnabled
                    ? "absolute right-1 top-1 h-5 w-5 rounded-full bg-on-primary shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition"
                    : "absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition"
                }
              />
            </button>
          </label>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold leading-5 text-text">
                最近识别记录
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                用于查看是否触发、是否请求、为什么创建、更新或忽略。
              </p>
            </div>
            <button
              type="button"
              className="h-8 shrink-0 rounded-[10px] px-2 text-xs font-medium text-primary transition hover:bg-hover-overlay active:scale-[0.98]"
              onClick={refreshRecognitionLogs}
            >
              刷新
            </button>
          </div>

          {recognitionLogs.length > 0 ? (
            <div className="mt-3 space-y-2">
              {recognitionLogs.map((log) => (
                <AiRecognitionLogCard key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-[10px] bg-surface-muted px-3 py-3 text-xs leading-5 text-text-tertiary">
              暂无识别记录。开启安排识别后，在对话中发送或收到消息即可生成日志。
            </p>
          )}
        </section>

        <div className="mt-4">
          <Button
            type="button"
            className="h-11 w-full rounded-[12px]"
            onClick={saveSettings}
          >
            保存设置
          </Button>
          {savedMessage && (
            <p className="mt-2 text-center text-xs font-medium text-primary">
              {savedMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AiRecognitionLogCard({ log }: { log: AiRecognitionLog }) {
  const createdLabel = new Date(log.createdAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const created =
    log.status === "created" ||
    log.status === "updated" ||
    log.status === "completed" ||
    log.status === "expired";
  const failed = log.status === "failed";
  const statusClass = created
    ? "bg-primary-soft text-primary"
    : failed
      ? "bg-tag-red/15 text-danger"
      : "bg-fill-4 text-text-muted";

  return (
    <article className="rounded-[12px] bg-surface-muted px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 line-clamp-2 break-words text-xs leading-5 text-text">
          {log.sourceText}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium leading-3 ${statusClass}`}
        >
          {getRecognitionStatusLabel(log.status)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-text-tertiary">
        <span>{createdLabel}</span>
        {log.chatType && <span>{getRecognitionChatTypeLabel(log.chatType)}</span>}
        {log.conversationName && <span>{log.conversationName}</span>}
        {log.action && <span>{getRecognitionActionLabel(log.action)}</span>}
        {log.updateIntent && (
          <span>{getRecognitionUpdateIntentLabel(log.updateIntent)}</span>
        )}
        {typeof log.shouldCreate === "boolean" && (
          <span>{log.shouldCreate ? "建议创建" : "不建议创建"}</span>
        )}
        {typeof log.confidence === "number" && (
          <span>置信度 {Math.round(log.confidence * 100)}%</span>
        )}
        {log.createdArrangementId && <span>已创建</span>}
        {log.updatedArrangementId && <span>已更新</span>}
      </div>

      <p className="mt-1 break-words text-[11px] leading-4 text-text-muted">
        {log.error || log.patchReason || log.reason}
      </p>

      {(log.previousScheduledDate ||
        log.nextScheduledDate ||
        log.previousTimeText ||
        log.nextTimeText) && (
        <p className="mt-1 break-words text-[10px] leading-4 text-text-tertiary">
          时间：{log.previousScheduledDate || log.previousTimeText || "未定"} →{" "}
          {log.nextScheduledDate || log.nextTimeText || "未定"}
        </p>
      )}

      {log.requestUrl && (
        <p className="mt-1 truncate text-[10px] leading-4 text-text-tertiary">
          {log.requestUrl}
        </p>
      )}
    </article>
  );
}

function getRecognitionStatusLabel(status: AiRecognitionLog["status"]) {
  if (status === "requesting") return "请求中";
  if (status === "success") return "已解析";
  if (status === "failed") return "失败";
  if (status === "ignored") return "未创建";
  if (status === "created") return "已创建";
  if (status === "updated") return "已更新";
  if (status === "completed") return "已完成";
  if (status === "expired") return "已失效";
  return "跳过";
}

function getRecognitionChatTypeLabel(chatType: NonNullable<AiRecognitionLog["chatType"]>) {
  if (chatType === "private") return "私聊";
  if (chatType === "group") return "群聊";
  return "发给自己";
}

function getRecognitionActionLabel(action: NonNullable<AiRecognitionLog["action"]>) {
  if (action === "create") return "创建";
  if (action === "update") return "更新";
  if (action === "complete") return "完成";
  if (action === "expire") return "失效";
  return "忽略";
}

function getRecognitionUpdateIntentLabel(
  updateIntent: NonNullable<AiRecognitionLog["updateIntent"]>
) {
  if (updateIntent === "correct_time") return "修正时间";
  if (updateIntent === "correct_title") return "修正标题";
  if (updateIntent === "correct_details") return "修正细节";
  if (updateIntent === "merge_details") return "合并细节";
  return "追加上下文";
}

function PhraseMemoryScreen({ onBack }: { onBack: () => void }) {
  const [memories, setMemories] = React.useState(getInitialUserPhraseMemories);
  const [editingMemory, setEditingMemory] = React.useState<UserPhraseMemory | null>(
    null
  );
  const [showEditor, setShowEditor] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditingMemory(null);
    setConfirmDeleteId(null);
    setShowEditor(true);
  };

  const openEdit = (memory: UserPhraseMemory) => {
    setEditingMemory(memory);
    setConfirmDeleteId(null);
    setShowEditor(true);
  };

  const saveMemory = (values: { phrase: string; meaning: string; note: string }) => {
    const phrase = values.phrase.trim();
    const meaning = values.meaning.trim();
    const note = values.note.trim();
    if (!phrase || !meaning) return;

    const timestamp = Date.now();
    const nextMemory: UserPhraseMemory = editingMemory
      ? {
          ...editingMemory,
          phrase,
          meaning,
          updatedAt: timestamp,
          ...(note ? { note } : { note: undefined }),
        }
      : {
          id: createUserPhraseMemoryId(timestamp),
          phrase,
          meaning,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...(note ? { note } : {}),
        };

    setMemories((prev) => {
      const nextItems = editingMemory
        ? prev.map((memory) =>
            memory.id === editingMemory.id ? nextMemory : memory
          )
        : [nextMemory, ...prev];
      persistUserPhraseMemories(nextItems);
      return getInitialUserPhraseMemories();
    });
    setShowEditor(false);
    setEditingMemory(null);
  };

  const removeMemory = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    setMemories((prev) => {
      const nextItems = prev.filter((memory) => memory.id !== id);
      persistUserPhraseMemories(nextItems);
      return getInitialUserPhraseMemories();
    });
    setConfirmDeleteId(null);
  };

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <MobilePageHeader title="个性化用语" onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-5 text-text">
                暗号词典
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                解释只有你自己懂的暗号、简称、昵称或地点别名，AI 识别安排时会优先参考。
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0 rounded-[12px] px-3 text-xs"
              onClick={openCreate}
            >
              新增
            </Button>
          </div>
        </section>

        {memories.length > 0 ? (
          <div className="mt-3 space-y-2.5">
            {memories.map((memory) => (
              <article
                key={memory.id}
                className="rounded-[12px] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)]"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => openEdit(memory)}
                >
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-words text-base font-semibold leading-6 text-text">
                      {memory.phrase}
                    </p>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-[10px] font-medium leading-3 text-primary">
                      用语
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm leading-5 text-text">
                    表示：{memory.meaning}
                  </p>
                  {memory.note && (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-text-muted">
                      {memory.note}
                    </p>
                  )}
                </button>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-fill-4 px-3 py-1.5 text-xs font-medium text-text-muted transition active:scale-[0.97]"
                    onClick={() => openEdit(memory)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-tag-red/15 px-3 py-1.5 text-xs font-medium text-danger transition active:scale-[0.97]"
                    onClick={() => removeMemory(memory.id)}
                  >
                    {confirmDeleteId === memory.id ? "确认删除" : "删除"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="mt-3 flex min-h-[220px] items-center justify-center rounded-[12px] bg-surface px-6 text-center shadow-[var(--mine-card-shadow)]">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-primary">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 6.5h16" />
                  <path d="M4 12h10" />
                  <path d="M4 17.5h7" />
                  <path d="M17 13.5 20 16l-3 2.5" />
                </svg>
              </div>
              <h2 className="mt-4 text-sm font-semibold leading-5 text-text">
                还没有个性化用语
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                你可以把自己常用的暗号、简称、昵称解释给 AI。
              </p>
              <Button
                type="button"
                className="mt-4 h-10 rounded-[12px] px-5 text-sm"
                onClick={openCreate}
              >
                新增用语
              </Button>
            </div>
          </section>
        )}
      </div>

      <PhraseMemoryEditorSheet
        open={showEditor}
        memory={editingMemory}
        onClose={() => {
          setShowEditor(false);
          setEditingMemory(null);
        }}
        onSubmit={saveMemory}
      />
    </div>
  );
}

function PhraseMemoryEditorSheet({
  open,
  memory,
  onClose,
  onSubmit,
}: {
  open: boolean;
  memory: UserPhraseMemory | null;
  onClose: () => void;
  onSubmit: (values: { phrase: string; meaning: string; note: string }) => void;
}) {
  const [phrase, setPhrase] = React.useState("");
  const [meaning, setMeaning] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    setPhrase(memory?.phrase ?? "");
    setMeaning(memory?.meaning ?? "");
    setNote(memory?.note ?? "");
  }, [memory, open]);

  if (!open) return null;

  const canSave = phrase.trim().length > 0 && meaning.trim().length > 0;

  const submit = () => {
    if (!canSave) return;

    onSubmit({ phrase, meaning, note });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label="关闭个性化用语编辑"
      />
      <section className="relative z-10 w-full rounded-t-[22px] bg-surface px-4 pb-5 pt-4 shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold leading-6 text-text">
              {memory ? "编辑用语" : "新增用语"}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              把自己的表达解释给 AI，用于后续安排识别。
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={onClose}
            aria-label="关闭个性化用语编辑"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              原始表达
            </span>
            <Input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder="例如：~~"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              真实含义
            </span>
            <Input
              value={meaning}
              onChange={(event) => setMeaning(event.target.value)}
              placeholder="例如：游泳"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              补充说明
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：通常表示下班后去游泳馆"
              className="min-h-[86px] w-full resize-none rounded-[12px] border border-transparent bg-white/80 px-3 py-2.5 text-sm leading-5 text-text placeholder:text-input-placeholder focus:outline-none focus:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)] focus-visible:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)]"
            />
          </label>

          <Button
            type="button"
            className="h-11 w-full rounded-[12px]"
            disabled={!canSave}
            onClick={submit}
          >
            保存用语
          </Button>
        </div>
      </section>
    </div>
  );
}

function SettingsScreen({
  onBack,
  onOpenAppearance,
  onOpenAiSettings,
  onOpenPhraseMemories,
}: {
  onBack: () => void;
  onOpenAppearance: () => void;
  onOpenAiSettings: () => void;
  onOpenPhraseMemories: () => void;
}) {
  const { localeCode, resolvedLocale, t } = usePreferences();
  const [showLanguageSheet, setShowLanguageSheet] = React.useState(false);

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("settings.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <div className="overflow-hidden rounded-[12px] bg-surface">
          <SettingsListItem
            title={t("settings.appearance")}
            description={t("settings.appearanceDesc")}
            onClick={onOpenAppearance}
          />
          <SettingsListItem
            title="AI 设置"
            description="配置 API Key、模型和安排识别"
            onClick={onOpenAiSettings}
          />
          <SettingsListItem
            title="个性化用语"
            description="解释暗号、简称、昵称和地点别名"
            onClick={onOpenPhraseMemories}
          />
          <SettingsListItem
            title={t("settings.language")}
            description={`${t("settings.current")}：${
              localeCode === ""
                ? t("settings.followSystem")
                : getLocaleDisplayName(localeCode, resolvedLocale)
            }`}
            onClick={() => setShowLanguageSheet(true)}
          />
        </div>
      </div>

      {showLanguageSheet && (
        <LanguageSheet onClose={() => setShowLanguageSheet(false)} />
      )}
    </div>
  );
}

function AppearanceStyleScreen({ onBack }: { onBack: () => void }) {
  const {
    accentColor,
    appIcon,
    isVip,
    resolvedTheme,
    setAccentColor,
    setAppIcon,
    setThemeMode,
    t,
    themeMode,
  } = usePreferences();
  const [limitMessage, setLimitMessage] = React.useState("");
  const themeOptions: Array<{ value: ThemeMode; label: string; preview: ResolvedTheme }> = [
    { value: "system", label: t("appearance.themeSystem"), preview: resolvedTheme },
    { value: "light", label: t("appearance.themeLight"), preview: "light" },
    { value: "dark", label: t("appearance.themeDark"), preview: "dark" },
  ];
  const iconOptions: Array<{ value: AppIcon; label: string; vip?: boolean }> = [
    { value: "classic", label: t("appearance.iconClassic") },
    { value: "bright", label: t("appearance.iconBright"), vip: true },
  ];

  const trySetAccentColor = (value: AccentColor) => {
    setLimitMessage("");
    setAccentColor(value);
  };

  const trySetAppIcon = (value: AppIcon, needsVip?: boolean) => {
    if (needsVip && !isVip) {
      setLimitMessage(t("appearance.freeLimit"));
      return;
    }
    setLimitMessage("");
    setAppIcon(value);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("appearance.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.theme")}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemeMode(option.value)}
                className={cn(
                  "rounded-[10px] border px-2 pb-2 pt-2 text-left transition active:scale-[0.98]",
                  themeMode === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface"
                )}
              >
                <ThemePreview mode={option.preview} />
                <p className="mt-2 truncate text-center text-xs font-medium text-text">
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.accent")}
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {accentColorOptions.map((option) => {
              const active = accentColor === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => trySetAccentColor(option.key)}
                  className={cn(
                    "relative flex min-h-[74px] flex-col items-center justify-center rounded-[10px] border bg-surface transition active:scale-[0.98]",
                    active ? "border-primary" : "border-border"
                  )}
                >
                  <span
                    className="h-7 w-7 rounded-full border-[3px]"
                    style={{
                      backgroundColor: option.color,
                      borderColor: active ? option.border : "transparent",
                    }}
                  />
                  <span className="mt-2 text-xs text-text">
                    {t(`accent.${option.key}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.icon")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {iconOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => trySetAppIcon(option.value, option.vip)}
                className={cn(
                  "relative flex min-h-[74px] items-center rounded-[10px] border bg-surface px-3 text-left transition active:scale-[0.98]",
                  appIcon === option.value ? "border-primary" : "border-border"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
                  <img
                    src={getJiwoLogoSrc(option.value, resolvedTheme)}
                    alt=""
                    className="w-8"
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-text">{option.label}</span>
                {option.vip && !isVip && (
                  <span className="absolute right-2 top-2 rounded-full bg-vip px-1.5 py-0.5 text-[9px] leading-3 text-white">
                    {t("common.vip")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {limitMessage && (
          <p className="mt-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs leading-5 text-primary">
            {limitMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { localeCode, setLocaleCode, t } = usePreferences();

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label={t("common.done")}
      />
      <div className="relative max-h-[76%] overflow-hidden rounded-t-[22px] bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div>
            <h2 className="text-lg font-semibold leading-6 text-text">
              {t("settings.language")}
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              {t("settings.languageSheetDesc")}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 items-center rounded-full px-3 text-sm font-medium text-primary transition hover:bg-hover-overlay active:scale-[0.98]"
            onClick={onClose}
          >
            {t("common.done")}
          </button>
        </div>

        <div className="max-h-[560px] overflow-y-auto px-2 pb-5">
          {supportedLocales.map((option) => {
            const active = option.code === localeCode;
            return (
              <button
                key={option.code || "system"}
                type="button"
                onClick={() => {
                  setLocaleCode(option.code as LocaleCode);
                  onClose();
                }}
                className="flex h-12 w-full items-center justify-between rounded-[10px] px-3 text-left transition hover:bg-bg active:scale-[0.99]"
              >
                <span className="text-[15px] leading-5 text-text">
                  {option.code === "" ? t("settings.followSystem") : option.displayName}
                </span>
                {active && (
                  <span className="text-sm font-semibold text-primary">
                    {t("common.selected")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsListItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[62px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-5 text-text">{title}</p>
        <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
          {description}
        </p>
      </div>
      <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
    </button>
  );
}

function MobilePageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = usePreferences();

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="ml-1 truncate text-[17px] font-semibold leading-5 text-text">
        {title}
      </h1>
    </header>
  );
}

function ThemePreview({ mode }: { mode: ResolvedTheme }) {
  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "h-[58px] overflow-hidden rounded-[8px] border p-1.5",
        isDark ? "border-[#333] bg-[#111]" : "border-[#e6e6e6] bg-[#f6f6f6]"
      )}
    >
      <div
        className={cn(
          "h-2.5 w-10 rounded-full",
          isDark ? "bg-[#2d2d2d]" : "bg-white"
        )}
      />
      <div className="mt-2 flex gap-1">
        <span className="h-7 flex-1 rounded-[5px] bg-primary" />
        <span
          className={cn(
            "h-7 flex-1 rounded-[5px]",
            isDark ? "bg-[#242424]" : "bg-white"
          )}
        />
      </div>
    </div>
  );
}

function getTabLabel(page: PageType, t: ReturnType<typeof usePreferences>["t"]) {
  if (page === "records") return t("tabs.records");
  if (page === "arrangements") return t("tabs.arrangements");
  if (page === "insight") return t("tabs.insight");
  return t("tabs.mine");
}

function getJiwoLogoSrc(appIcon: AppIcon, resolvedTheme: ResolvedTheme) {
  if (appIcon === "bright" || resolvedTheme === "dark") {
    return "/images/logo-jiwo-green.svg";
  }
  return "/images/logo-jiwo.svg";
}

function formatRoundCount(count: number, label: string) {
  return /^[a-zA-Z]/.test(label) ? `${count} ${label}` : `${count}${label}`;
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.5 4.5H4.25A1.75 1.75 0 0 0 2.5 6.25v5.5c0 .97.78 1.75 1.75 1.75h5.5c.97 0 1.75-.78 1.75-1.75V9.5M8.5 2.5h5m0 0v5m0-5-6.25 6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendToSelfIcon({ className }: { className?: string }) {
  const { resolvedTheme } = usePreferences();
  const src =
    resolvedTheme === "dark"
      ? "/images/icon_send_to_self_sidebar_dark.svg"
      : "/images/icon_send_to_self_sidebar.svg";

  return (
    <img src={src} alt="" className={className} aria-hidden="true" />
  );
}

function OverviewEntryTag({ label }: { label: string }) {
  return (
    <span className="ml-1.5 shrink-0 rounded-[10px] bg-[var(--overview-entry-tag-bg)] px-2 py-0.5 text-[10px] font-medium leading-[14px] text-text-tertiary">
      {label}
    </span>
  );
}
