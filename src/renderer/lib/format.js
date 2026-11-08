import {
  addWeeksISO,
  compareWeeks,
  endOfWeekISO,
  formatMonthDay,
  isoWeekInfo,
  startOfWeekISO,
  todayISO,
  weekRangeLabel,
  weekdayCN,
} from '../../shared/domain.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

export function pct(value, digits = 0) {
  const number = Number(value) || 0;
  return `${(number * 100).toFixed(digits)}%`;
}

export function estimateLabel(minutes) {
  const value = Number(minutes) || 0;
  if (value <= 0) return '';
  if (value < 60) return `${value} 分钟`;
  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

export function signedPoints(value) {
  const number = Math.round(Number(value) || 0);
  return number > 0 ? `+${number}` : String(number);
}

export function weekLabel(weekStart, currentWeek = startOfWeekISO(todayISO())) {
  const diff = compareWeeks(weekStart, currentWeek);
  if (diff === 0) return '本周';
  if (diff === 1) return '下周';
  if (diff === -1) return '上周';
  if (diff > 1) return `+${diff} 周`;
  return `${diff} 周`;
}

export function weekHeading(weekStart) {
  const info = isoWeekInfo(weekStart);
  return `第 ${info.week} 周`;
}

export function weekRange(weekStart, withYear = false) {
  return weekRangeLabel(weekStart, { withYear });
}

export function weekDateTile(weekStart) {
  return {
    month: `${Number(weekStart.slice(5, 7))}月`,
    day: Number(weekStart.slice(8, 10)),
    weekday: weekdayCN(weekStart),
    end: formatMonthDay(endOfWeekISO(weekStart)),
  };
}

export function dateLabel(iso) {
  if (!iso) return '';
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return `${month}月${day}日`;
}

export function relativeTaskWeek(weekStart, currentWeek) {
  const diff = compareWeeks(weekStart, currentWeek);
  if (diff < 0) return `逾期 ${Math.abs(diff)} 周`;
  if (diff === 0) return '本周';
  if (diff === 1) return '下周';
  return `${diff} 周后`;
}

export function buildWeekOptions(centerWeek, { before = 4, after = 24 } = {}) {
  const options = [];
  for (let offset = -before; offset <= after; offset += 1) {
    const value = addWeeksISO(centerWeek, offset);
    options.push({
      value,
      label: `${weekLabel(value, centerWeek)} · ${weekRange(value)}`,
    });
  }
  return options;
}

export function sourceLabel(source) {
  return (
    {
      ai: 'AI 拆解',
      template: '离线模板',
      manual: '手动',
      demo: '示例',
    }[source] || '手动'
  );
}

export function countLabel(count, suffix = '件') {
  return `${count} ${suffix}`;
}

export function clampText(text, max = 80) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function todayLabel() {
  return formatMonthDay(todayISO());
}
