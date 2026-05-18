import { useMemo, useState } from "react";
import ChatInput from "@/components/ChatInput";
import ChatList from "@/components/ChatList";
import EmptyState from "@/components/EmptyState";
import { usePreferences } from "@/settings/preferences";
import type { RecordItem, RecordSourceConversation } from "@/types/record";

const now = Date.now();

type AiConversationEntry = {
  timestamp: string;
  userInput: string;
};

type RecordsProps = {
  searchQuery?: string;
  compactHeader?: boolean;
  showComposer?: boolean;
  demoRecords?: RecordItem[];
  aiConversationEntries?: AiConversationEntry[];
  selfRecords?: RecordItem[];
  onCreateSelfRecord?: (content: string) => void;
  onOpenSourceConversation?: (source: RecordSourceConversation) => void;
  onOpenRecordDetail?: (record: RecordItem) => void;
  onOpenRecordSnapshot?: (record: RecordItem) => void;
};

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

export default function Records({
  searchQuery = "",
  compactHeader = false,
  showComposer = true,
  demoRecords,
  aiConversationEntries = [],
  selfRecords = [],
  onCreateSelfRecord,
  onOpenSourceConversation,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: RecordsProps) {
  const { t } = usePreferences();
  const fallbackDemoRecords = useMemo<RecordItem[]>(
    () => [
      {
        uid: "demo-1",
        text_content: t("records.demo1"),
        send_at: now - 1000 * 60 * 60 * 5,
        create_at: now - 1000 * 60 * 60 * 5,
        update_at: now - 1000 * 60 * 60 * 5,
      },
      {
        uid: "demo-2",
        text_content: t("records.demo2"),
        send_at: now - 1000 * 60 * 45,
        create_at: now - 1000 * 60 * 45,
        update_at: now - 1000 * 60 * 45,
      },
      {
        uid: "demo-3",
        text_content: t("records.demo3"),
        send_at: now - 1000 * 60 * 12,
        create_at: now - 1000 * 60 * 12,
        update_at: now - 1000 * 60 * 12,
      },
    ],
    [t]
  );
  const aiConversationRecords = useMemo<RecordItem[]>(
    () =>
      aiConversationEntries.map((entry, index) => {
        const timestamp = parseAiConversationTimestamp(entry.timestamp, now + index);
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
    [aiConversationEntries, t]
  );
  const [fallbackLocalRecords, setFallbackLocalRecords] = useState<RecordItem[]>([]);
  const effectiveDemoRecords = demoRecords ?? fallbackDemoRecords;
  const records = useMemo(
    () => [
      ...effectiveDemoRecords,
      ...aiConversationRecords,
      ...selfRecords,
      ...fallbackLocalRecords,
    ],
    [aiConversationRecords, effectiveDemoRecords, fallbackLocalRecords, selfRecords]
  );

  const visibleRecords = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) =>
      record.text_content.toLowerCase().includes(keyword)
    );
  }, [records, searchQuery]);

  const handleCreateRecord = (content: string) => {
    if (onCreateSelfRecord) {
      onCreateSelfRecord(content);
      return;
    }

    const timestamp = Date.now();
    setFallbackLocalRecords((prev) => [
      ...prev,
      {
        uid: `local-${timestamp}`,
        text_content: content,
        send_at: timestamp,
        create_at: timestamp,
        update_at: timestamp,
      },
    ]);
  };

  const handleCreateVoiceRecord = () => {
    handleCreateRecord(t("records.voiceRecord"));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compactHeader && (
        <header className="flex items-center justify-between bg-bg px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold text-text">{t("records.title")}</h1>
            <p className="text-xs text-text-muted">{t("records.subtitle")}</p>
          </div>
        </header>
      )}

      {visibleRecords.length > 0 ? (
        <ChatList
          records={visibleRecords}
          hasMore={false}
          loading={false}
          onLoadMore={() => undefined}
          onOpenSourceConversation={onOpenSourceConversation}
          onOpenRecordDetail={onOpenRecordDetail}
          onOpenRecordSnapshot={onOpenRecordSnapshot}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={
              <svg
                className="h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            }
            title={searchQuery ? t("records.noMatches") : t("records.emptyTitle")}
            description={
              searchQuery
                ? t("records.noMatchDesc")
                : t("records.emptyDesc")
            }
          />
        </div>
      )}

      {showComposer && (
        <ChatInput
          onSubmit={handleCreateRecord}
          onVoiceSubmit={handleCreateVoiceRecord}
        />
      )}

    </div>
  );
}
