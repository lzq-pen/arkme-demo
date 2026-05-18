import { useEffect, useState } from "react";
import Button from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import Input from "@/components/ui/input";
import {
  createArrangementId,
  getInitialArrangements,
  isDateKey,
  isTimeValue,
  parseDateKey,
  persistArrangements,
  toDateKey,
  type ArrangementImportance,
  type ArrangementItem,
  type ArrangementReminder,
  type ArrangementSourceType,
  type ArrangementStatus,
  type ArrangementUrgency,
} from "@/data/arrangements";
import { usePreferences } from "@/settings/preferences";

type ArrangementViewMode = "day" | "week" | "month" | "year";

const viewModes: ArrangementViewMode[] = ["day", "week", "month", "year"];

function useArrangementCopy() {
  const { t } = usePreferences();
  const pick = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return {
    title: pick("arrangements.title", "安排"),
    subtitle: pick("arrangements.subtitle", "放下之后需要关注的事"),
    emptyTitle: pick("arrangements.emptyTitle", "还没有安排"),
    emptyDesc: pick(
      "arrangements.emptyDesc",
      "之后需要关注、确认或落地的事，可以先放在这里。"
    ),
    create: pick("arrangements.create", "新建安排"),
    new: pick("arrangements.new", "新建"),
    createTitle: pick("arrangements.createTitle", "新建安排"),
    createSubtitle: pick(
      "arrangements.createSubtitle",
      "先把之后需要关注的事放下来"
    ),
    fieldTitle: pick("arrangements.fieldTitle", "标题"),
    fieldDate: pick("arrangements.fieldDate", "具体日期"),
    fieldTime: pick("arrangements.fieldTime", "时间描述"),
    fieldNote: pick("arrangements.fieldNote", "备注"),
    fieldReminder: pick("arrangements.fieldReminder", "提醒"),
    fieldImportance: pick("arrangements.fieldImportance", "是否重要"),
    fieldUrgency: pick("arrangements.fieldUrgency", "是否紧急"),
    titlePlaceholder: pick(
      "arrangements.titlePlaceholder",
      "例如：周末整理体检报告"
    ),
    timePlaceholder: pick("arrangements.timePlaceholder", "例如：这周六上午"),
    datePlaceholder: pick("arrangements.datePlaceholder", "选择具体日期"),
    notePlaceholder: pick(
      "arrangements.notePlaceholder",
      "补充地点、背景或需要确认的事"
    ),
    save: pick("arrangements.save", "保存安排"),
    cancel: pick("arrangements.cancel", "取消"),
    closeCreate: pick("arrangements.closeCreate", "关闭新建安排"),
    closeReminder: pick("arrangements.closeReminder", "关闭提醒设置"),
    reminderTitle: pick("arrangements.reminderTitle", "提醒"),
    reminderSubtitle: pick("arrangements.reminderSubtitle", "只设置提醒时间，不会触发系统通知"),
    reminderNone: pick("arrangements.reminderNone", "无"),
    reminderNeedDate: pick(
      "arrangements.reminderNeedDate",
      "需要设置具体日期后提醒才有效"
    ),
    reminderCustom: pick("arrangements.reminderCustom", "自定义"),
    reminderOffsetDays: pick("arrangements.reminderOffsetDays", "提前天数"),
    reminderTime: pick("arrangements.reminderTime", "提醒时间"),
    reminderSave: pick("arrangements.reminderSave", "保存提醒"),
    stowed: pick("arrangements.stowed", "已放下"),
    closeStowed: pick("arrangements.closeStowed", "关闭已放下"),
    viewMode: pick("arrangements.viewMode", "查看方式"),
    viewDate: pick("arrangements.viewDate", "查看日期"),
    scopeDay: pick("arrangements.scopeDay", "日"),
    scopeWeek: pick("arrangements.scopeWeek", "周"),
    scopeMonth: pick("arrangements.scopeMonth", "月"),
    scopeYear: pick("arrangements.scopeYear", "年"),
    fieldStartTime: pick("arrangements.fieldStartTime", "开始时间"),
    fieldEndTime: pick("arrangements.fieldEndTime", "结束时间"),
    importanceImportant: pick("arrangements.importanceImportant", "重要"),
    importanceNormal: pick("arrangements.importanceNormal", "普通"),
    urgencyUrgent: pick("arrangements.urgencyUrgent", "紧急"),
    urgencyNormal: pick("arrangements.urgencyNormal", "不紧急"),
    quadrantDoNow: pick("arrangements.quadrantDoNow", "现在最该关注"),
    quadrantUrgent: pick("arrangements.quadrantUrgent", "快到时间了"),
    quadrantImportant: pick("arrangements.quadrantImportant", "值得推进"),
    quadrantNormal: pick("arrangements.quadrantNormal", "可以放一放"),
    dayEmptyTitle: pick("arrangements.dayEmptyTitle", "今天还没有安排"),
    dayEmptyDesc: pick(
      "arrangements.dayEmptyDesc",
      "今天或近期真正要处理的事，可以先放在这里。"
    ),
    weekEmptyTitle: pick("arrangements.weekEmptyTitle", "本周还没有安排"),
    weekEmptyDesc: pick(
      "arrangements.weekEmptyDesc",
      "本周需要留意的安排会出现在这里。"
    ),
    monthEmptyTitle: pick("arrangements.monthEmptyTitle", "本月还没有安排"),
    monthEmptyDesc: pick(
      "arrangements.monthEmptyDesc",
      "本月需要留意的安排会出现在这里。"
    ),
    yearEmptyTitle: pick("arrangements.yearEmptyTitle", "今年还没有安排"),
    yearEmptyDesc: pick(
      "arrangements.yearEmptyDesc",
      "今年或长期需要留意的安排会出现在这里。"
    ),
    weekOverview: pick("arrangements.weekOverview", "本周需要留意的安排"),
    monthOverview: pick("arrangements.monthOverview", "本月需要留意的安排"),
    yearOverview: pick("arrangements.yearOverview", "今年或长期需要留意的安排"),
    calendarNoItems: pick("arrangements.calendarNoItems", "暂无安排"),
    unscheduledTitle: pick("arrangements.unscheduledTitle", "未定时间"),
    unscheduledDesc: pick(
      "arrangements.unscheduledDesc",
      "还没有具体日期的安排先放在这里。"
    ),
    arrangementCount: pick("arrangements.arrangementCount", "{count} 条安排"),
    stowedTitle: pick("arrangements.stowedTitle", "已放下"),
    stowedSubtitle: pick(
      "arrangements.stowedSubtitle",
      "暂时放下或已经完成的安排"
    ),
    stowedEmptyTitle: pick("arrangements.stowedEmptyTitle", "还没有放下的安排"),
    stowedEmptyDesc: pick(
      "arrangements.stowedEmptyDesc",
      "完成或以后再说的安排会收纳在这里。"
    ),
    laterGroupTitle: pick("arrangements.laterGroupTitle", "以后再说"),
    completedGroupTitle: pick("arrangements.completedGroupTitle", "已完成"),
    expiredGroupTitle: pick("arrangements.expiredGroupTitle", "已失效"),
    statusPending: pick("arrangements.statusPending", "待关注"),
    statusCompleted: pick("arrangements.statusCompleted", "已完成"),
    statusLater: pick("arrangements.statusLater", "以后再说"),
    statusExpired: pick("arrangements.statusExpired", "已失效"),
    originalPlan: pick("arrangements.originalPlan", "原计划"),
    complete: pick("arrangements.complete", "完成"),
    moveLater: pick("arrangements.moveLater", "以后再说"),
    refocus: pick("arrangements.refocus", "重新关注"),
    sourceManual: pick("arrangements.sourceManual", "手动创建"),
    detailTitle: pick("arrangements.detailTitle", "安排详情"),
    sourceTitle: pick("arrangements.sourceTitle", "来源"),
    sourceSelfChat: pick("arrangements.sourceSelfChat", "来自发给自己"),
    sourcePrivateChat: pick("arrangements.sourcePrivateChat", "来自私聊"),
    sourceGroupChat: pick("arrangements.sourceGroupChat", "来自群聊"),
    remove: pick("arrangements.remove", "从安排中移除"),
    removeConfirm: pick(
      "arrangements.removeConfirm",
      "要从安排中移除这件事吗？移除后它不会再出现在安排里。"
    ),
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStart(date: Date) {
  return addDays(date, -date.getDay());
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthCalendarDates(date: Date) {
  const start = getWeekStart(getMonthStart(date));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function getItemsByDate(items: ArrangementItem[]) {
  return items.reduce<Record<string, ArrangementItem[]>>((groups, item) => {
    if (!item.scheduledDate) return groups;

    return {
      ...groups,
      [item.scheduledDate]: [...(groups[item.scheduledDate] ?? []), item],
    };
  }, {});
}

function arrangementStatusWeight(status: ArrangementStatus) {
  if (status === "pending") return 0;
  if (status === "later") return 1;
  if (status === "completed") return 2;
  return 3;
}

function sortArrangements(items: ArrangementItem[]) {
  return [...items].sort((left, right) => {
    const statusDiff =
      arrangementStatusWeight(left.status) - arrangementStatusWeight(right.status);
    if (statusDiff !== 0) return statusDiff;
    return right.updatedAt - left.updatedAt;
  });
}

export default function Arrangements() {
  const copy = useArrangementCopy();
  const [arrangements, setArrangements] = useState(getInitialArrangements);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showStowed, setShowStowed] = useState(false);
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | null>(
    null
  );
  const [activeViewMode, setActiveViewMode] = useState<ArrangementViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const selectedDateValue = parseDateKey(selectedDate) ?? new Date();
  const pendingArrangements = sortArrangements(
    arrangements.filter((item) => item.status === "pending")
  );
  const dayArrangements = sortArrangements(
    pendingArrangements.filter((item) => item.scheduledDate === selectedDate)
  );
  const unscheduledArrangements = sortArrangements(
    pendingArrangements.filter((item) => !item.scheduledDate)
  );
  const calendarArrangements = sortArrangements(
    pendingArrangements.filter((item) => item.scheduledDate)
  );
  const stowedArrangements = sortArrangements(
    arrangements.filter((item) => item.status !== "pending")
  );
  const laterArrangements = stowedArrangements.filter(
    (item) => item.status === "later"
  );
  const completedArrangements = stowedArrangements.filter(
    (item) => item.status === "completed"
  );
  const expiredArrangements = stowedArrangements.filter(
    (item) => item.status === "expired"
  );
  const hasAnyArrangements = arrangements.length > 0;
  const selectedArrangement =
    arrangements.find((item) => item.id === selectedArrangementId) ?? null;

  const createArrangement = ({
    title,
    importance,
    urgency,
    scheduledDate,
    startTime,
    endTime,
    timeText,
    note,
  }: {
    title: string;
    importance: ArrangementImportance;
    urgency: ArrangementUrgency;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    timeText: string;
    note: string;
  }) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;

    const timestamp = Date.now();
    const nextArrangement: ArrangementItem = {
      id: createArrangementId(timestamp),
      title: normalizedTitle,
      status: "pending",
      importance,
      urgency,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(isDateKey(scheduledDate) ? { scheduledDate } : {}),
      ...(isTimeValue(startTime) ? { startTime } : {}),
      ...(isTimeValue(endTime) ? { endTime } : {}),
      ...(timeText.trim() ? { timeText: timeText.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      source: {
        type: "manual",
        label: copy.sourceManual,
      },
    };

    setArrangements((prev) => {
      const nextItems = [nextArrangement, ...prev];
      persistArrangements(nextItems);
      return nextItems;
    });
    setShowCreateSheet(false);
  };

  const updateArrangementStatus = (id: string, status: ArrangementStatus) => {
    const timestamp = Date.now();
    setArrangements((prev) => {
      const nextItems = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: timestamp,
              completedAt: status === "completed" ? timestamp : undefined,
              expiredAt: status === "expired" ? timestamp : undefined,
            }
          : item
      );
      persistArrangements(nextItems);
      return nextItems;
    });
  };

  const updateArrangement = (
    id: string,
    values: {
      title: string;
      importance: ArrangementImportance;
      urgency: ArrangementUrgency;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      timeText: string;
      note: string;
      reminder?: ArrangementReminder;
    }
  ) => {
    const normalizedTitle = values.title.trim();
    if (!normalizedTitle) return;

    const timestamp = Date.now();
    setArrangements((prev) => {
      const nextItems = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: normalizedTitle,
              importance: values.importance,
              urgency: values.urgency,
              updatedAt: timestamp,
              scheduledDate: isDateKey(values.scheduledDate)
                ? values.scheduledDate
                : undefined,
              startTime: isTimeValue(values.startTime) ? values.startTime : undefined,
              endTime: isTimeValue(values.endTime) ? values.endTime : undefined,
              timeText: values.timeText.trim() || undefined,
              note: values.note.trim() || undefined,
              reminder: values.reminder?.enabled ? values.reminder : undefined,
            }
          : item
      );
      persistArrangements(nextItems);
      return nextItems;
    });
  };

  const removeArrangement = (id: string) => {
    setArrangements((prev) => {
      const nextItems = prev.filter((item) => item.id !== id);
      persistArrangements(nextItems);
      return nextItems;
    });
    setSelectedArrangementId(null);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center justify-between bg-bg px-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-6 text-text">
            {copy.title}
          </h1>
          <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {copy.subtitle}
          </p>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {hasAnyArrangements && (
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-[12px] px-3 text-xs"
              onClick={() => setShowStowed(true)}
            >
              {copy.stowed}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-[12px] px-3 text-xs"
            onClick={() => setShowCreateSheet(true)}
          >
            {copy.new}
          </Button>
        </div>
      </header>

      <ViewModeSwitcher activeViewMode={activeViewMode} onChange={setActiveViewMode} />
      <ViewDateAnchor selectedDate={selectedDate} onChange={setSelectedDate} />

      {activeViewMode === "day" ? (
        <DayView
          items={dayArrangements}
          unscheduledItems={unscheduledArrangements}
          onCreate={() => setShowCreateSheet(true)}
          onChangeStatus={updateArrangementStatus}
          onOpenDetail={setSelectedArrangementId}
        />
      ) : (
        <CalendarOverview
          viewMode={activeViewMode}
          selectedDate={selectedDateValue}
          items={calendarArrangements}
        />
      )}

      <CreateArrangementSheet
        open={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSubmit={createArrangement}
      />
      <StowedArrangementsSheet
        open={showStowed}
        laterItems={laterArrangements}
        completedItems={completedArrangements}
        expiredItems={expiredArrangements}
        onClose={() => setShowStowed(false)}
        onChangeStatus={updateArrangementStatus}
        onOpenDetail={setSelectedArrangementId}
      />
      <ArrangementDetailSheet
        item={selectedArrangement}
        onClose={() => setSelectedArrangementId(null)}
        onSubmit={updateArrangement}
        onRemove={removeArrangement}
      />
    </div>
  );
}

function DayView({
  items,
  unscheduledItems,
  onCreate,
  onChangeStatus,
  onOpenDetail,
}: {
  items: ArrangementItem[];
  unscheduledItems: ArrangementItem[];
  onCreate: () => void;
  onChangeStatus: (id: string, status: ArrangementStatus) => void;
  onOpenDetail: (id: string) => void;
}) {
  const copy = useArrangementCopy();
  const groups = getDayPriorityGroups(items, copy);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
      {items.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 px-1 text-sm font-semibold text-text">
                {group.title}
              </h2>
              <ArrangementList
                items={group.items}
                onChangeStatus={onChangeStatus}
                onOpenDetail={onOpenDetail}
              />
            </section>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[260px] items-center justify-center px-4 text-center">
          <EmptyState
            icon={<ArrangementFlagIcon />}
            title={copy.dayEmptyTitle}
            description={copy.dayEmptyDesc}
            action={
              <Button
                type="button"
                className="rounded-[12px] px-5"
                onClick={onCreate}
              >
                {copy.create}
              </Button>
            }
          />
        </div>
      )}

      {unscheduledItems.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 px-1">
            <h2 className="text-sm font-semibold text-text">
              {copy.unscheduledTitle}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              {copy.unscheduledDesc}
            </p>
          </div>
          <ArrangementList
            items={unscheduledItems}
            onChangeStatus={onChangeStatus}
            onOpenDetail={onOpenDetail}
          />
        </section>
      )}
    </div>
  );
}

function ArrangementList({
  items,
  onChangeStatus,
  onOpenDetail,
}: {
  items: ArrangementItem[];
  onChangeStatus: (id: string, status: ArrangementStatus) => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ArrangementCard
          key={item.id}
          item={item}
          onChangeStatus={onChangeStatus}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}

function getDayPriorityGroups(
  items: ArrangementItem[],
  copy: ReturnType<typeof useArrangementCopy>
) {
  return [
    {
      key: "important-urgent",
      title: copy.quadrantDoNow,
      items: items.filter(
        (item) => item.importance === "important" && item.urgency === "urgent"
      ),
    },
    {
      key: "normal-urgent",
      title: copy.quadrantUrgent,
      items: items.filter(
        (item) => item.importance === "normal" && item.urgency === "urgent"
      ),
    },
    {
      key: "important-normal",
      title: copy.quadrantImportant,
      items: items.filter(
        (item) => item.importance === "important" && item.urgency === "normal"
      ),
    },
    {
      key: "normal-normal",
      title: copy.quadrantNormal,
      items: items.filter(
        (item) => item.importance === "normal" && item.urgency === "normal"
      ),
    },
  ].filter((group) => group.items.length > 0);
}

function CalendarOverview({
  viewMode,
  selectedDate,
  items,
}: {
  viewMode: Exclude<ArrangementViewMode, "day">;
  selectedDate: Date;
  items: ArrangementItem[];
}) {
  const copy = useArrangementCopy();
  const overviewText = getScopeOverview(viewMode, copy);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
      <p className="mb-3 px-1 text-xs leading-5 text-text-muted">
        {overviewText}
      </p>
      {viewMode === "week" && (
        <WeekCalendarOverview selectedDate={selectedDate} items={items} />
      )}
      {viewMode === "month" && (
        <MonthCalendarOverview selectedDate={selectedDate} items={items} />
      )}
      {viewMode === "year" && (
        <YearCalendarOverview selectedDate={selectedDate} items={items} />
      )}
    </div>
  );
}

function WeekCalendarOverview({
  selectedDate,
  items,
}: {
  selectedDate: Date;
  items: ArrangementItem[];
}) {
  const copy = useArrangementCopy();
  const groupedItems = getItemsByDate(items);
  const weekStart = getWeekStart(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <div className="space-y-2">
      {days.map((date) => {
        const dateKey = toDateKey(date);
        const dayItems = groupedItems[dateKey] ?? [];

        return (
          <section
            key={dateKey}
            className="rounded-[14px] border border-border-light bg-surface px-3 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 shrink-0 text-center">
                <div className="text-[18px] font-semibold leading-6 text-text">
                  {date.getDate()}
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-text-muted">
                  {getWeekdayLabel(date)}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {dayItems.length > 0 ? (
                  dayItems.map((item) => (
                    <CalendarTitlePill key={item.id} title={item.title} />
                  ))
                ) : (
                  <p className="pt-1 text-xs leading-5 text-text-tertiary">
                    {copy.calendarNoItems}
                  </p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthCalendarOverview({
  selectedDate,
  items,
}: {
  selectedDate: Date;
  items: ArrangementItem[];
}) {
  const groupedItems = getItemsByDate(items);
  const currentMonth = selectedDate.getMonth();
  const calendarDates = getMonthCalendarDates(selectedDate);

  return (
    <div className="rounded-[18px] border border-border-light bg-surface p-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-medium text-text-tertiary">
        {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDates.map((date) => {
          const dateKey = toDateKey(date);
          const dayItems = groupedItems[dateKey] ?? [];
          const visibleItems = dayItems.slice(0, 3);
          const hiddenCount = dayItems.length - visibleItems.length;
          const inCurrentMonth = date.getMonth() === currentMonth;

          return (
            <div
              key={dateKey}
              className={
                inCurrentMonth
                  ? "min-h-[76px] rounded-[10px] bg-bg px-1.5 py-1.5"
                  : "min-h-[76px] rounded-[10px] bg-bg/60 px-1.5 py-1.5 opacity-45"
              }
            >
              <div className="mb-1 text-[11px] font-semibold leading-4 text-text">
                {date.getDate()}
              </div>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <CalendarTitlePill key={item.id} title={item.title} compact />
                ))}
                {hiddenCount > 0 && (
                  <div className="truncate rounded-[6px] bg-fill-4 px-1.5 py-0.5 text-[10px] leading-3 text-text-tertiary">
                    +{hiddenCount}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearCalendarOverview({
  selectedDate,
  items,
}: {
  selectedDate: Date;
  items: ArrangementItem[];
}) {
  const copy = useArrangementCopy();
  const currentYear = selectedDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthItems = items.filter((item) => {
      if (!item.scheduledDate) return false;
      const date = parseDateKey(item.scheduledDate);
      return (
        date?.getFullYear() === currentYear && date.getMonth() === index
      );
    });

    return { month: index, items: monthItems };
  });

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {months.map(({ month, items: monthItems }) => (
        <section
          key={month}
          className="min-h-[112px] rounded-[14px] border border-border-light bg-surface px-3 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[16px] font-semibold leading-6 text-text">
              {month + 1}月
            </h3>
            <span className="text-[11px] leading-4 text-text-tertiary">
              {copy.arrangementCount.replace("{count}", `${monthItems.length}`)}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {monthItems.slice(0, 2).map((item) => (
              <p
                key={item.id}
                className="truncate rounded-[8px] bg-primary-soft px-2 py-1 text-[11px] leading-4 text-primary"
              >
                {item.title}
              </p>
            ))}
            {monthItems.length === 0 && (
              <p className="text-xs leading-5 text-text-tertiary">
                {copy.calendarNoItems}
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function CalendarTitlePill({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "truncate rounded-[6px] bg-primary-soft px-1.5 py-0.5 text-[10px] leading-3 text-primary"
          : "truncate rounded-[8px] bg-primary-soft px-2 py-1 text-xs leading-4 text-primary"
      }
    >
      {title}
    </div>
  );
}

function ViewModeSwitcher({
  activeViewMode,
  onChange,
}: {
  activeViewMode: ArrangementViewMode;
  onChange: (viewMode: ArrangementViewMode) => void;
}) {
  const copy = useArrangementCopy();
  const [open, setOpen] = useState(false);

  const changeViewMode = (viewMode: ArrangementViewMode) => {
    onChange(viewMode);
    setOpen(false);
  };

  return (
    <div className="relative shrink-0 bg-bg px-4 pb-2">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label={copy.cancel}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="relative z-20 flex justify-end">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-[12px] border border-border-light bg-surface px-3 text-sm font-semibold text-text shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition active:scale-[0.98]"
          aria-label={copy.viewMode}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{getScopeLabel(activeViewMode, copy)}</span>
          <ChevronDownIcon open={open} />
        </button>
      </div>

      {open && (
        <div className="absolute right-4 top-10 z-30 w-44 overflow-hidden rounded-[22px] border border-border-light bg-surface py-2 shadow-[0_18px_46px_rgba(0,0,0,0.16)]">
          {viewModes.map((viewMode) => {
            const active = activeViewMode === viewMode;
            return (
              <button
                key={viewMode}
                type="button"
                className={
                  active
                    ? "flex h-12 w-full items-center gap-3 px-4 text-[16px] font-semibold text-primary"
                    : "flex h-12 w-full items-center gap-3 px-4 text-[16px] font-medium text-text transition hover:bg-hover-overlay active:bg-fill-4"
                }
                onClick={() => changeViewMode(viewMode)}
              >
                <ViewModeOptionIcon viewMode={viewMode} />
                <span className="flex-1 text-left">
                  {getScopeLabel(viewMode, copy)}
                </span>
                {active && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ViewDateAnchor({
  selectedDate,
  onChange,
}: {
  selectedDate: string;
  onChange: (value: string) => void;
}) {
  const copy = useArrangementCopy();

  return (
    <div className="shrink-0 bg-bg px-4 pb-2">
      <label className="flex items-center gap-2 rounded-[12px] bg-surface px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <span className="shrink-0 text-xs font-medium text-text-muted">
          {copy.viewDate}
        </span>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text outline-none"
        />
      </label>
    </div>
  );
}

function ArrangementCard({
  item,
  onChangeStatus,
  onOpenDetail,
  compact = false,
}: {
  item: ArrangementItem;
  onChangeStatus: (id: string, status: ArrangementStatus) => void;
  onOpenDetail: (id: string) => void;
  compact?: boolean;
}) {
  const copy = useArrangementCopy();
  const isPending = item.status === "pending";
  const statusLabel =
    item.status === "completed"
      ? copy.statusCompleted
      : item.status === "later"
        ? copy.statusLater
        : item.status === "expired"
          ? copy.statusExpired
          : copy.statusPending;
  const timeLabel = getArrangementTimeLabel(item);
  const originalPlanLabel = getOriginalPlanLabel(item, copy);
  const reminderLabel = formatReminderLabel(item.reminder, copy);

  return (
    <article
      role="button"
      tabIndex={0}
      className={
        isPending
          ? "rounded-[14px] border border-[var(--record-card-border)] bg-surface px-4 py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition active:scale-[0.995]"
          : "rounded-[14px] border border-border-light bg-surface-muted/70 px-4 py-3.5 opacity-75 transition active:scale-[0.995]"
      }
      onClick={() => onOpenDetail(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(item.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 break-words text-[16px] font-semibold leading-6 text-text">
          {item.title}
        </h2>
        <span
          className={
            isPending
              ? "shrink-0 rounded-full bg-primary-soft px-2 py-1 text-[10px] font-medium leading-3 text-primary"
              : "shrink-0 rounded-full bg-fill-4 px-2 py-1 text-[10px] font-medium leading-3 text-text-tertiary"
          }
        >
          {statusLabel}
        </span>
      </div>
      {timeLabel && (
        <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
          {timeLabel}
        </p>
      )}

      {originalPlanLabel && (
        <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
          {originalPlanLabel}
        </p>
      )}

      {item.reminder?.enabled && (
        <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
          提醒：{reminderLabel}
        </p>
      )}

      {item.timeText && (
        <p className="mt-2 break-words text-xs leading-5 text-text-muted">
          {item.timeText}
        </p>
      )}

      {item.note && (
        <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-text">
          {item.note}
        </p>
      )}

      <div className={compact ? "mt-2 flex items-center justify-end" : "mt-3 flex items-center justify-end gap-2"}>
        {isPending ? (
          <>
            <button
              type="button"
              className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition active:scale-[0.97]"
              onClick={(event) => {
                event.stopPropagation();
                onChangeStatus(item.id, "completed");
              }}
            >
              {copy.complete}
            </button>
            <button
              type="button"
              className="rounded-full bg-fill-4 px-3 py-1.5 text-xs font-medium text-text-muted transition active:scale-[0.97]"
              onClick={(event) => {
                event.stopPropagation();
                onChangeStatus(item.id, "later");
              }}
            >
              {copy.moveLater}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition active:scale-[0.97]"
            onClick={(event) => {
              event.stopPropagation();
              onChangeStatus(item.id, "pending");
            }}
          >
            {copy.refocus}
          </button>
        )}
      </div>
    </article>
  );
}

function StowedArrangementsSheet({
  open,
  laterItems,
  completedItems,
  expiredItems,
  onClose,
  onChangeStatus,
  onOpenDetail,
}: {
  open: boolean;
  laterItems: ArrangementItem[];
  completedItems: ArrangementItem[];
  expiredItems: ArrangementItem[];
  onClose: () => void;
  onChangeStatus: (id: string, status: ArrangementStatus) => void;
  onOpenDetail: (id: string) => void;
}) {
  const copy = useArrangementCopy();
  const hasItems =
    laterItems.length > 0 || completedItems.length > 0 || expiredItems.length > 0;

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-40 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label={copy.closeStowed}
      />
      <section className="relative z-10 flex max-h-[78%] w-full flex-col rounded-t-[22px] bg-surface px-4 pb-5 pt-4 shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold leading-6 text-text">
              {copy.stowedTitle}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              {copy.stowedSubtitle}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={onClose}
            aria-label={copy.closeStowed}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {hasItems ? (
            <div className="space-y-5">
              <StowedArrangementGroup
                title={copy.laterGroupTitle}
                items={laterItems}
                onChangeStatus={onChangeStatus}
                onOpenDetail={onOpenDetail}
              />
              <StowedArrangementGroup
                title={copy.completedGroupTitle}
                items={completedItems}
                onChangeStatus={onChangeStatus}
                onOpenDetail={onOpenDetail}
              />
              <StowedArrangementGroup
                title={copy.expiredGroupTitle}
                items={expiredItems}
                onChangeStatus={onChangeStatus}
                onOpenDetail={onOpenDetail}
              />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center text-center">
              <EmptyState
                icon={<ArrangementFlagIcon />}
                title={copy.stowedEmptyTitle}
                description={copy.stowedEmptyDesc}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StowedArrangementGroup({
  title,
  items,
  onChangeStatus,
  onOpenDetail,
}: {
  title: string;
  items: ArrangementItem[];
  onChangeStatus: (id: string, status: ArrangementStatus) => void;
  onOpenDetail: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-text-muted">{title}</h3>
      <div className="space-y-2.5">
        {items.map((item) => (
          <ArrangementCard
            key={item.id}
            item={item}
            compact
            onChangeStatus={onChangeStatus}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </section>
  );
}

function ArrangementDetailSheet({
  item,
  onClose,
  onSubmit,
  onRemove,
}: {
  item: ArrangementItem | null;
  onClose: () => void;
  onSubmit: (
    id: string,
    values: {
      title: string;
      importance: ArrangementImportance;
      urgency: ArrangementUrgency;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      timeText: string;
      note: string;
      reminder?: ArrangementReminder;
    }
  ) => void;
  onRemove: (id: string) => void;
}) {
  const copy = useArrangementCopy();
  const [title, setTitle] = useState("");
  const [importance, setImportance] = useState<ArrangementImportance>("normal");
  const [urgency, setUrgency] = useState<ArrangementUrgency>("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeText, setTimeText] = useState("");
  const [note, setNote] = useState("");
  const [reminder, setReminder] = useState<ArrangementReminder | undefined>();
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!item) return;

    setTitle(item.title);
    setImportance(item.importance);
    setUrgency(item.urgency);
    setScheduledDate(item.scheduledDate ?? "");
    setStartTime(item.startTime ?? "");
    setEndTime(item.endTime ?? "");
    setTimeText(item.timeText ?? "");
    setNote(item.note ?? "");
    setReminder(item.reminder);
    setShowReminderSheet(false);
    setConfirmRemove(false);
  }, [item]);

  if (!item) return null;

  const canSave = title.trim().length > 0;

  const resetAndClose = () => {
    setConfirmRemove(false);
    setShowReminderSheet(false);
    onClose();
  };

  const save = () => {
    if (!canSave) return;

    onSubmit(item.id, {
      title,
      importance,
      urgency,
      scheduledDate,
      startTime,
      endTime,
      timeText,
      note,
      reminder,
    });
    resetAndClose();
  };

  const confirmAndRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }

    onRemove(item.id);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={resetAndClose}
        aria-label={copy.detailTitle}
      />
      <section className="relative z-10 flex max-h-[88%] w-full flex-col rounded-t-[22px] bg-surface px-4 pb-5 pt-4 shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold leading-6 text-text">
              {copy.detailTitle}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              {getStatusLabel(item.status, copy)}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={resetAndClose}
            aria-label={copy.cancel}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldTitle}
              </span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={copy.titlePlaceholder}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <BinaryChoice
                label={copy.fieldImportance}
                value={importance}
                options={[
                  { value: "normal", label: copy.importanceNormal },
                  { value: "important", label: copy.importanceImportant },
                ]}
                onChange={setImportance}
              />
              <BinaryChoice
                label={copy.fieldUrgency}
                value={urgency}
                options={[
                  { value: "normal", label: copy.urgencyNormal },
                  { value: "urgent", label: copy.urgencyUrgent },
                ]}
                onChange={setUrgency}
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldDate}
              </span>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-muted">
                  {copy.fieldStartTime}
                </span>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-muted">
                  {copy.fieldEndTime}
                </span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldTime}
              </span>
              <Input
                value={timeText}
                onChange={(event) => setTimeText(event.target.value)}
                placeholder={copy.timePlaceholder}
              />
            </label>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-[12px] bg-white/80 px-3 py-2.5 text-left transition hover:bg-hover-overlay active:scale-[0.99]"
                onClick={() => setShowReminderSheet(true)}
              >
                <span className="text-xs font-medium text-text-muted">
                  {copy.fieldReminder}
                </span>
                <span className="text-sm font-semibold text-text">
                  {formatReminderLabel(reminder, copy)}
                </span>
              </button>
              {reminder?.enabled && !scheduledDate && (
                <p className="mt-1.5 px-1 text-[11px] leading-4 text-text-tertiary">
                  {copy.reminderNeedDate}
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldNote}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={copy.notePlaceholder}
                className="min-h-[86px] w-full resize-none rounded-[12px] border border-transparent bg-white/80 px-3 py-2.5 text-sm leading-5 text-text placeholder:text-input-placeholder focus:outline-none focus:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)] focus-visible:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)]"
              />
            </label>

            <ArrangementSourceBlock item={item} />

            {confirmRemove && (
              <p className="rounded-[12px] bg-surface-muted px-3 py-2 text-xs leading-5 text-danger">
                {copy.removeConfirm}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 shrink-0 space-y-2">
          <Button
            type="button"
            className="h-11 w-full rounded-[12px]"
            disabled={!canSave}
            onClick={save}
          >
            {copy.save}
          </Button>
          <button
            type="button"
            className="h-10 w-full rounded-[12px] text-sm font-medium text-danger transition hover:bg-hover-overlay active:scale-[0.98]"
            onClick={confirmAndRemove}
          >
            {copy.remove}
          </button>
        </div>
      </section>
      <ReminderSheet
        open={showReminderSheet}
        value={reminder}
        hasScheduledDate={Boolean(scheduledDate)}
        onChange={setReminder}
        onClose={() => setShowReminderSheet(false)}
      />
    </div>
  );
}

const reminderQuickOptions: Array<{
  key: string;
  reminder?: ArrangementReminder;
}> = [
  { key: "none" },
  { key: "same-day-0900", reminder: { enabled: true, offsetDays: 0, time: "09:00" } },
  { key: "one-day-0900", reminder: { enabled: true, offsetDays: 1, time: "09:00" } },
  { key: "two-days-0900", reminder: { enabled: true, offsetDays: 2, time: "09:00" } },
  { key: "three-days-0900", reminder: { enabled: true, offsetDays: 3, time: "09:00" } },
  { key: "one-week-0900", reminder: { enabled: true, offsetDays: 7, time: "09:00" } },
];

function ReminderSheet({
  open,
  value,
  hasScheduledDate,
  onChange,
  onClose,
}: {
  open: boolean;
  value?: ArrangementReminder;
  hasScheduledDate: boolean;
  onChange: (value: ArrangementReminder | undefined) => void;
  onClose: () => void;
}) {
  const copy = useArrangementCopy();
  const [customOffsetDays, setCustomOffsetDays] = useState(
    `${value?.offsetDays ?? 1}`
  );
  const [customTime, setCustomTime] = useState(value?.time ?? "09:00");

  useEffect(() => {
    if (!open) return;

    setCustomOffsetDays(`${value?.offsetDays ?? 1}`);
    setCustomTime(value?.time ?? "09:00");
  }, [open, value]);

  if (!open) return null;

  const parsedOffsetDays = Number(customOffsetDays);
  const canSaveCustom =
    Number.isInteger(parsedOffsetDays) &&
    parsedOffsetDays >= 0 &&
    isTimeValue(customTime);

  const isSelected = (reminder?: ArrangementReminder) => {
    if (!reminder?.enabled) return !value?.enabled;
    return (
      value?.enabled === true &&
      value.offsetDays === reminder.offsetDays &&
      value.time === reminder.time
    );
  };

  const saveCustom = () => {
    if (!canSaveCustom) return;

    onChange({
      enabled: true,
      offsetDays: parsedOffsetDays,
      time: customTime,
    });
    onClose();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-[60] flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label={copy.closeReminder}
      />
      <section className="relative z-10 w-full rounded-t-[22px] bg-surface px-4 pb-5 pt-4 shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold leading-6 text-text">
              {copy.reminderTitle}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              {copy.reminderSubtitle}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={onClose}
            aria-label={copy.closeReminder}
          >
            <CloseIcon />
          </button>
        </div>

        {!hasScheduledDate && (
          <p className="mt-3 rounded-[12px] bg-surface-muted px-3 py-2 text-xs leading-5 text-text-muted">
            {copy.reminderNeedDate}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {reminderQuickOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={
                isSelected(option.reminder)
                  ? "rounded-[12px] bg-primary-soft px-3 py-2.5 text-sm font-semibold text-primary"
                  : "rounded-[12px] bg-surface-muted px-3 py-2.5 text-sm font-medium text-text"
              }
              onClick={() => {
                onChange(option.reminder);
                onClose();
              }}
            >
              {formatReminderLabel(option.reminder, copy)}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-[14px] bg-surface-muted px-3 py-3">
          <h3 className="text-sm font-semibold leading-5 text-text">
            {copy.reminderCustom}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.reminderOffsetDays}
              </span>
              <Input
                type="number"
                min={0}
                step={1}
                value={customOffsetDays}
                onChange={(event) => setCustomOffsetDays(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.reminderTime}
              </span>
              <Input
                type="time"
                value={customTime}
                onChange={(event) => setCustomTime(event.target.value)}
              />
            </label>
          </div>
          <Button
            type="button"
            className="mt-3 h-10 w-full rounded-[12px]"
            disabled={!canSaveCustom}
            onClick={saveCustom}
          >
            {copy.reminderSave}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ArrangementSourceBlock({ item }: { item: ArrangementItem }) {
  const copy = useArrangementCopy();
  const source = item.source;
  const contexts = source?.contexts ?? [];
  const hasSource =
    source?.type === "self-chat" ||
    source?.type === "private-chat" ||
    source?.type === "group-chat" ||
    contexts.length > 0 ||
    source?.sourceText ||
    source?.contextText ||
    source?.sourceMessageId ||
    source?.sourceMessageIds?.length ||
    item.createdBy === "ai";

  if (!hasSource) return null;

  return (
    <section className="rounded-[14px] bg-surface-muted px-3 py-3">
      <h3 className="text-sm font-semibold leading-5 text-text">
        {copy.sourceTitle}
      </h3>
      <div className="mt-2 space-y-1 text-xs leading-5 text-text-muted">
        <p>{getSourceLabel(source?.type, copy, source?.label)}</p>
        {source?.conversationName && <p>会话：{source.conversationName}</p>}
        {item.createdBy === "ai" || source?.createdBy === "ai" ? (
          <p>createdBy: ai</p>
        ) : null}
        {source?.relatedPeople && source.relatedPeople.length > 0 && (
          <p>相关人：{source.relatedPeople.join("、")}</p>
        )}
        {contexts.length > 0 ? (
          <div className="mt-2 space-y-2">
            {contexts.map((sourceContext) => (
              <div
                key={`${sourceContext.type}-${sourceContext.triggerMessageId}`}
                className="rounded-[10px] bg-surface px-3 py-2"
              >
                <p className="font-medium text-text">
                  {getSourceLabel(sourceContext.type, copy)} · {sourceContext.conversationName}
                </p>
                {sourceContext.sourceText && (
                  <p className="mt-1 break-words text-text">{sourceContext.sourceText}</p>
                )}
                {sourceContext.contextText && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-text-muted">
                    {sourceContext.contextText}
                  </p>
                )}
                {sourceContext.sourceMessageIds.length > 0 && (
                  <p className="mt-1 break-all text-text-tertiary">
                    sourceMessageIds: {sourceContext.sourceMessageIds.join(", ")}
                  </p>
                )}
                {sourceContext.relatedPeople && sourceContext.relatedPeople.length > 0 && (
                  <p>相关人：{sourceContext.relatedPeople.join("、")}</p>
                )}
                {sourceContext.reason && <p>reason: {sourceContext.reason}</p>}
                {typeof sourceContext.confidence === "number" && (
                  <p>confidence: {Math.round(sourceContext.confidence * 100)}%</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {source?.sourceText && (
              <p className="break-words text-text">{source.sourceText}</p>
            )}
            {source?.sourceMessageId && (
              <p className="break-all text-text-tertiary">
                sourceMessageId: {source.sourceMessageId}
              </p>
            )}
            {source?.sourceMessageIds && source.sourceMessageIds.length > 0 && (
              <p className="break-all text-text-tertiary">
                sourceMessageIds: {source.sourceMessageIds.join(", ")}
              </p>
            )}
            {source?.contextText && (
              <p className="whitespace-pre-wrap break-words text-text">
                {source.contextText}
              </p>
            )}
          </>
        )}
        {source?.reason && <p>reason: {source.reason}</p>}
        {typeof source?.confidence === "number" && (
          <p>confidence: {Math.round(source.confidence * 100)}%</p>
        )}
      </div>
    </section>
  );
}

function getSourceLabel(
  sourceType: ArrangementSourceType | undefined,
  copy: ReturnType<typeof useArrangementCopy>,
  fallback?: string
) {
  if (sourceType === "self-chat") return copy.sourceSelfChat;
  if (sourceType === "private-chat") return copy.sourcePrivateChat;
  if (sourceType === "group-chat") return copy.sourceGroupChat;
  return fallback || copy.sourceManual;
}

function getScopeLabel(
  scope: ArrangementViewMode,
  copy: ReturnType<typeof useArrangementCopy>
) {
  if (scope === "week") return copy.scopeWeek;
  if (scope === "month") return copy.scopeMonth;
  if (scope === "year") return copy.scopeYear;
  return copy.scopeDay;
}

function getStatusLabel(
  status: ArrangementStatus,
  copy: ReturnType<typeof useArrangementCopy>
) {
  if (status === "completed") return copy.statusCompleted;
  if (status === "later") return copy.statusLater;
  if (status === "expired") return copy.statusExpired;
  return copy.statusPending;
}

function getScopeOverview(
  scope: ArrangementViewMode,
  copy: ReturnType<typeof useArrangementCopy>
) {
  if (scope === "week") return copy.weekOverview;
  if (scope === "month") return copy.monthOverview;
  if (scope === "year") return copy.yearOverview;
  return "";
}

function getWeekdayLabel(date: Date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getDay()
  ];
}

function formatDateLabel(value: string) {
  const date = parseDateKey(value);
  if (!date) return value;

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getOriginalPlanLabel(
  item: ArrangementItem,
  copy: ReturnType<typeof useArrangementCopy>
) {
  if (item.status !== "pending" || !item.scheduledDate) return "";

  const todayKey = toDateKey(new Date());
  if (item.scheduledDate >= todayKey) return "";

  const yesterdayKey = toDateKey(addDays(new Date(), -1));
  const dateLabel = item.scheduledDate === yesterdayKey ? "昨天" : formatDateLabel(item.scheduledDate);
  return `${copy.originalPlan} ${dateLabel}`;
}

function getArrangementTimeLabel(item: ArrangementItem) {
  const parts: string[] = [];
  if (item.scheduledDate) parts.push(formatDateLabel(item.scheduledDate));

  if (item.startTime && item.endTime) {
    parts.push(`${item.startTime}-${item.endTime}`);
  } else if (item.startTime) {
    parts.push(item.startTime);
  } else if (item.endTime) {
    parts.push(`截至 ${item.endTime}`);
  }

  if (item.timeText) parts.push(item.timeText);
  return parts.join(" · ");
}

function formatReminderLabel(
  reminder: ArrangementReminder | undefined,
  copy: ReturnType<typeof useArrangementCopy>
) {
  if (!reminder?.enabled) return copy.reminderNone;
  if (reminder.offsetDays === 0) return `当天 ${reminder.time}`;
  if (reminder.offsetDays === 7) return `提前 1 周 ${reminder.time}`;
  if ([1, 2, 3].includes(reminder.offsetDays)) {
    return `提前 ${reminder.offsetDays} 天 ${reminder.time}`;
  }
  return `自定义提前 ${reminder.offsetDays} 天 ${reminder.time}`;
}

function CreateArrangementSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    importance: ArrangementImportance;
    urgency: ArrangementUrgency;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    timeText: string;
    note: string;
  }) => void;
}) {
  const copy = useArrangementCopy();
  const [title, setTitle] = useState("");
  const [importance, setImportance] = useState<ArrangementImportance>("normal");
  const [urgency, setUrgency] = useState<ArrangementUrgency>("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeText, setTimeText] = useState("");
  const [note, setNote] = useState("");
  const canSave = title.trim().length > 0;

  if (!open) return null;

  const resetAndClose = () => {
    setTitle("");
    setImportance("normal");
    setUrgency("normal");
    setScheduledDate("");
    setStartTime("");
    setEndTime("");
    setTimeText("");
    setNote("");
    onClose();
  };

  const submit = () => {
    if (!canSave) return;

    onSubmit({
      title,
      importance,
      urgency,
      scheduledDate,
      startTime,
      endTime,
      timeText,
      note,
    });
    setTitle("");
    setImportance("normal");
    setUrgency("normal");
    setScheduledDate("");
    setStartTime("");
    setEndTime("");
    setTimeText("");
    setNote("");
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-40 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={resetAndClose}
        aria-label={copy.closeCreate}
      />
      <section className="relative z-10 w-full rounded-t-[22px] bg-surface px-4 pb-5 pt-4 shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold leading-6 text-text">
              {copy.createTitle}
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted">
              {copy.createSubtitle}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={resetAndClose}
            aria-label={copy.cancel}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              {copy.fieldTitle}
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.titlePlaceholder}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <BinaryChoice
              label={copy.fieldImportance}
              value={importance}
              options={[
                { value: "normal", label: copy.importanceNormal },
                { value: "important", label: copy.importanceImportant },
              ]}
              onChange={setImportance}
            />
            <BinaryChoice
              label={copy.fieldUrgency}
              value={urgency}
              options={[
                { value: "normal", label: copy.urgencyNormal },
                { value: "urgent", label: copy.urgencyUrgent },
              ]}
              onChange={setUrgency}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              {copy.fieldDate}
            </span>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              aria-label={copy.datePlaceholder}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldStartTime}
              </span>
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {copy.fieldEndTime}
              </span>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              {copy.fieldTime}
            </span>
            <Input
              value={timeText}
              onChange={(event) => setTimeText(event.target.value)}
              placeholder={copy.timePlaceholder}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              {copy.fieldNote}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.notePlaceholder}
              className="min-h-[86px] w-full resize-none rounded-[12px] border border-transparent bg-white/80 px-3 py-2.5 text-sm leading-5 text-text placeholder:text-input-placeholder focus:outline-none focus:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)] focus-visible:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)]"
            />
          </label>
        </div>

        <Button
          type="button"
          className="mt-4 h-11 w-full rounded-[12px]"
          disabled={!canSave}
          onClick={submit}
        >
          {copy.save}
        </Button>
      </section>
    </div>
  );
}

function BinaryChoice<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-muted p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={
                active
                  ? "h-8 rounded-[9px] bg-surface text-xs font-semibold text-text shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  : "h-8 rounded-[9px] text-xs font-medium text-text-muted transition active:scale-[0.98]"
              }
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
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
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? "h-4 w-4 rotate-180 text-text-muted" : "h-4 w-4 text-text-muted"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ViewModeOptionIcon({ viewMode }: { viewMode: ArrangementViewMode }) {
  const linePath =
    viewMode === "year"
      ? "M8 4v16M16 4v16"
      : viewMode === "month"
        ? "M8 4v16M16 4v16M4 10h16M4 16h16"
        : viewMode === "week"
          ? "M9 4v16M15 4v16"
          : "M4 9h16M4 15h16";

  return (
    <svg
      className="h-6 w-6 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d={linePath} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrangementFlagIcon() {
  return (
    <svg
      className="h-7 w-7 text-primary"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 20V5.8M6 5.8C8.9 3.9 11.2 6.8 14.1 5.1C15.2 4.5 16.2 4.2 18 4.6V13.2C16.2 12.8 15.2 13.1 14.1 13.7C11.2 15.4 8.9 12.5 6 14.4V5.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
