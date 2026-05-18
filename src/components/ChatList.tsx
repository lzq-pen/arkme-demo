import { useEffect, useRef, useCallback, useState } from "react";
import ChatBubble from "./ChatBubble";
import TimeLabel from "./TimeLabel";
import { shouldShowTimeLabel, formatMessageTimeLabel } from "@/lib/time";
import { usePreferences } from "@/settings/preferences";
import type { RecordItem, RecordSourceConversation } from "@/types/record";

type ChatListProps = {
  records: RecordItem[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onOpenSourceConversation?: (source: RecordSourceConversation) => void;
  onOpenRecordDetail?: (record: RecordItem) => void;
  onOpenRecordSnapshot?: (record: RecordItem) => void;
  targetRecordUid?: string | null;
};

// 获取交错动画延迟类名
const getStaggerClass = (index: number): string => {
  const staggerIndex = Math.min(index, 10);
  return staggerIndex > 0 ? `stagger-${staggerIndex}` : "";
};

export default function ChatList({
  records,
  hasMore,
  loading,
  onLoadMore,
  onOpenSourceConversation,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  targetRecordUid,
}: ChatListProps) {
  const { resolvedLocale, t } = usePreferences();
  const topRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recordRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 记录已渲染过的消息 UID，避免重复动画
  const [renderedUids] = useState<Set<string>>(() => new Set());
  // 记录当前批次的起始索引，用于交错动画
  const [batchStartIndex, setBatchStartIndex] = useState(0);

  // 向上滚动加载更多
  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || !hasMore) return;

    const { scrollTop } = containerRef.current;
    // 当滚动到顶部附近时加载更多
    if (scrollTop < 100) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // 当加载新数据时，更新批次起始索引
  useEffect(() => {
    setBatchStartIndex(renderedUids.size);
  }, [records.length, renderedUids.size]);

  const latestRecordKey = records.reduce((latest, record) => {
    if (!latest || record.send_at > latest.send_at) return record;
    return latest;
  }, null as RecordItem | null)?.uid;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || records.length === 0 || targetRecordUid) return;

    window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [latestRecordKey, records.length, targetRecordUid]);

  useEffect(() => {
    if (!targetRecordUid) return;

    window.requestAnimationFrame(() => {
      recordRefs.current.get(targetRecordUid)?.scrollIntoView({
        block: "center",
      });
    });
  }, [records.length, targetRecordUid]);

  // 渲染消息列表（包含时间分组和交错动画）
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];

    // 按时间倒序排列（最新在下面），但渲染时需要正序
    const sortedRecords = [...records].sort((a, b) => a.send_at - b.send_at);

    let lastSendAt = 0;
    let visibleIndex = 0;

    sortedRecords.forEach((record, index) => {
      // 判断是否需要插入时间标签
      if (index === 0 || shouldShowTimeLabel(lastSendAt, record.send_at)) {
        elements.push(
          <TimeLabel
            key={`time-${record.send_at}`}
            label={formatMessageTimeLabel(record.send_at, {
              locale: resolvedLocale,
              yesterday: t("time.yesterday"),
              dayBeforeYesterday: t("time.dayBeforeYesterday"),
              minutesAgo: t("time.minutesAgo"),
              hoursAgo: t("time.hoursAgo"),
            })}
          />
        );
      }

      // 判断是否是新消息（需要动画）
      const isNew = !renderedUids.has(record.uid);
      if (isNew) {
        renderedUids.add(record.uid);
      }

      // 计算当前消息在新批次中的索引，用于交错动画
      const indexInBatch = visibleIndex - batchStartIndex;
      const staggerClass = isNew && indexInBatch >= 0 ? getStaggerClass(indexInBatch) : "";
      const referencedRecord = record.referencedRecord;

      elements.push(
        <div
          key={record.uid}
          ref={(node) => {
            if (node) {
              recordRefs.current.set(record.uid, node);
            } else {
              recordRefs.current.delete(record.uid);
            }
          }}
          className={
            targetRecordUid === record.uid
              ? "scroll-mt-4 rounded-[18px] bg-primary-soft/70 py-1"
              : "scroll-mt-4"
          }
        >
          <ChatBubble
            textContent={record.text_content}
            animationDelay={staggerClass}
            disableAnimation={!isNew}
            onOpenDetail={
              onOpenRecordDetail ? () => onOpenRecordDetail(record) : undefined
            }
            onOpenMemorySnapshot={
              onOpenRecordSnapshot ? () => onOpenRecordSnapshot(record) : undefined
            }
            reference={
              referencedRecord && onOpenRecordDetail
                ? {
                    label: t("recordReference.extendedFrom"),
                    text: referencedRecord.text_content,
                    onClick: () => onOpenRecordDetail(referencedRecord),
                  }
                : undefined
            }
            source={
              record.sourceConversation && onOpenSourceConversation
                ? {
                    label: record.sourceConversation.label,
                    actionLabel: record.sourceConversation.actionLabel,
                    iconLabel: record.sourceConversation.iconLabel,
                    onClick: () =>
                      onOpenSourceConversation(record.sourceConversation!),
                  }
                : undefined
            }
          />
        </div>
      );

      lastSendAt = record.send_at;
      visibleIndex++;
    });

    return elements;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 顶部加载更多指示器 */}
      <div ref={topRef} className="flex-shrink-0">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-xs text-text-muted">{t("chat.loadingMore")}</span>
          </div>
        )}
        {!loading && hasMore && (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={onLoadMore}
              className="text-xs text-text-muted transition-colors duration-[var(--duration)] hover:text-text active:scale-[0.98]"
            >
              {t("chat.loadMore")}
            </button>
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1">{renderMessages()}</div>

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}
