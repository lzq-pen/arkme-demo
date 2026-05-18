import type React from "react";
import { formatBubbleTime } from "@/lib/time";
import { usePreferences } from "@/settings/preferences";
import type { RecordItem, RecordSourceConversation } from "@/types/record";

type RecordDetailSheetProps = {
  record: RecordItem | null;
  onClose: () => void;
  onOpenSource?: (source: RecordSourceConversation) => void;
};

function formatFullDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function countTextLength(value: string) {
  return Array.from(value.trim()).length;
}

export default function RecordDetailSheet({
  record,
  onClose,
  onOpenSource,
}: RecordDetailSheetProps) {
  const { t } = usePreferences();

  if (!record) return null;

  const textLength = countTextLength(record.text_content);
  const durationSeconds = Math.max(
    0,
    Math.round((record.send_at - record.create_at) / 1000)
  );
  const sourceLabel =
    record.sourceConversation?.label ?? t("recordSnapshot.quickNoteSource");
  const canOpenSource = Boolean(record.sourceConversation && onOpenSource);

  const handleOpenSource = () => {
    if (!record.sourceConversation || !onOpenSource) return;
    onOpenSource(record.sourceConversation);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-label={t("recordSnapshot.close")}
      />
      <section
        className="relative z-10 flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[16px] border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("recordSnapshot.title")}
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-5 text-text">
              {t("recordSnapshot.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label={t("recordSnapshot.close")}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="truncate border-b border-border-light pb-2 pt-3 text-left text-[14px] leading-5 text-text">
            {record.text_content || t("recordSnapshot.untitled")}
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-border-light py-4 text-center">
            <DetailMetric
              label={t("recordDetail.wordCount")}
              value={String(textLength)}
            />
            <DetailMetric
              label={t("recordDetail.duration")}
              value={`${durationSeconds}${t("recordDetail.secondsSuffix")}`}
            />
            <DetailMetric
              label={t("recordDetail.review")}
              value={`0${t("recordDetail.timesSuffix")}`}
            />
            <DetailMetric
              label={t("recordDetail.share")}
              value={`0${t("recordDetail.timesSuffix")}`}
            />
          </div>

          <section className="border-b border-border-light py-3">
            <div className="rounded-[12px] bg-[var(--record-detail-muted-bg)] px-3 py-5 text-center text-[13px] leading-5 text-text-tertiary">
              {t("recordDetail.noLocation")}
            </div>
          </section>

          <div className="space-y-3 py-4">
            <DetailRow
              label={t("recordDetail.sourceLocation")}
              value={
                canOpenSource ? (
                  <button
                    type="button"
                    onClick={handleOpenSource}
                    className="inline-flex max-w-full items-center rounded-[8px] border border-[var(--record-topic-border)] px-2 py-1 text-left text-[12px] leading-4 text-text-tertiary transition hover:text-text-muted active:scale-[0.99]"
                  >
                    <span className="min-w-0 truncate">{sourceLabel}</span>
                    <svg
                      className="ml-1 h-3.5 w-3.5 shrink-0"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>
                ) : (
                  sourceLabel
                )
              }
            />
            <DetailRow
              label={t("recordDetail.createdAt")}
              value={formatFullDateTime(record.create_at)}
            />
            <DetailRow
              label={t("recordDetail.completedAt")}
              value={formatFullDateTime(record.send_at)}
            />
            <DetailRow
              label={t("recordDetail.syncStatus")}
              value={`${t("recordDetail.localSynced")} ${formatBubbleTime(record.update_at)}`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] leading-5 text-text-tertiary">{label}</p>
      <p className="mt-0.5 truncate text-[14px] leading-5 text-text">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fill-3 text-[10px] font-semibold text-text-tertiary">
        i
      </span>
      <p className="w-[88px] shrink-0 text-[14px] leading-6 text-text-tertiary">
        {label}
      </p>
      <div className="min-w-0 flex-1 text-[14px] leading-6 text-text">{value}</div>
    </div>
  );
}
