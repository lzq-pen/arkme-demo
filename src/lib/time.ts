/**
 * 时间格式化工具
 * 参考 jotmo-frontend 的时间分组逻辑
 */

const TIME_GROUP_INTERVAL_MS = 2 * 60 * 1000; // 2 分钟

/**
 * 判断两个时间戳是否需要插入时间分组标签
 * @param prevSendAt 上一条消息的发送时间（毫秒）
 * @param currentSendAt 当前消息的发送时间（毫秒）
 * @returns 是否需要插入时间标签
 */
export function shouldShowTimeLabel(prevSendAt: number, currentSendAt: number): boolean {
  return Math.abs(currentSendAt - prevSendAt) >= TIME_GROUP_INTERVAL_MS;
}

/**
 * 格式化时间标签
 * @param timestamp 毫秒时间戳
 * @returns 格式化的时间字符串
 */
export function formatTimeLabel(
  timestamp: number,
  options: {
    locale?: string;
    today?: string;
    yesterday?: string;
    dayBeforeYesterday?: string;
  } = {}
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const locale = options.locale ?? "zh-CN";

  const isToday = isSameDay(date, now);
  const isYesterday = isSameDay(date, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const isDayBeforeYesterday = isSameDay(date, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    return options.today ?? "今天";
  } else if (isYesterday) {
    return options.yesterday ?? "昨天";
  } else if (isDayBeforeYesterday) {
    return options.dayBeforeYesterday ?? "前天";
  } else if (isThisYear) {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric",
    }).format(date);
  } else {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(date);
  }
}

/**
 * 格式化气泡内的时间（仅显示时分）
 * @param timestamp 毫秒时间戳
 * @returns 时分格式的时间字符串
 */
export function formatBubbleTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 格式化首页消息列表的时间标签
 */
export function formatMessageTimeLabel(
  timestamp: number,
  options: {
    locale?: string;
    yesterday?: string;
    dayBeforeYesterday?: string;
    minutesAgo?: string;
    hoursAgo?: string;
  } = {}
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - timestamp);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const locale = options.locale ?? "zh-CN";

  if (diff < hourMs) {
    return `${Math.max(1, Math.floor(diff / minuteMs))}${options.minutesAgo ?? "分钟前"}`;
  }

  if (isSameDay(date, now)) {
    return `${Math.max(1, Math.floor(diff / hourMs))}${options.hoursAgo ?? "小时前"}`;
  }

  const time = formatBubbleTime(timestamp);
  const yesterdayDate = new Date(now.getTime() - 24 * hourMs);
  const dayBeforeYesterdayDate = new Date(now.getTime() - 2 * 24 * hourMs);

  if (isSameDay(date, yesterdayDate)) {
    return `${options.yesterday ?? "昨天"} ${time}`;
  }

  if (isSameDay(date, dayBeforeYesterdayDate)) {
    return `${options.dayBeforeYesterday ?? "前天"} ${time}`;
  }

  return `${formatDateLabel(date, now, locale)} ${time}`;
}

/**
 * 判断两个日期是否是同一天
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function formatDateLabel(date: Date, now: Date, locale: string): string {
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

/**
 * 相对时间格式化（用于显示"刚刚"、"x分钟前"等）
 * @param timestamp 毫秒时间戳
 * @returns 相对时间字符串
 */
export function formatRelativeTime(
  timestamp: number,
  options: {
    locale?: string;
    justNow?: string;
    minutesAgo?: string;
    hoursAgo?: string;
    today?: string;
    yesterday?: string;
    dayBeforeYesterday?: string;
  } = {}
): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60 * 1000) {
    return options.justNow ?? "刚刚";
  } else if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}${options.minutesAgo ?? "分钟前"}`;
  } else if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}${options.hoursAgo ?? "小时前"}`;
  } else {
    return formatTimeLabel(timestamp, options);
  }
}
