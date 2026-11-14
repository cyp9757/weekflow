import {
  DEFAULT_SETTINGS,
  PROJECT_COLORS,
  THEMES,
  defaultPools,
  defaultRewards,
  defaultSettings,
} from './defaults.js';

const DAY_MS = 86_400_000;
const MAX_WEEKS = 52;
const MAX_TASKS_PER_WEEK = 8;
const MAX_TASKS = 160;

export const SCHEMA_VERSION = 3;

export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function uid(prefix = 'id') {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${time}_${random}`;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseISODate(value) {
  if (!isValidISODate(value)) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function isoFromDate(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function toISODateLocal(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODateLocal(now);
}

export function nowISO(now = new Date()) {
  return new Date(now).toISOString();
}

export function addDaysISO(iso, days) {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return isoFromDate(date);
}

export function addWeeksISO(iso, weeks) {
  return addDaysISO(iso, Number(weeks || 0) * 7);
}

export function startOfWeekISO(input = todayISO()) {
  const iso = input instanceof Date ? toISODateLocal(input) : input;
  if (!isValidISODate(iso)) throw new Error(`Invalid ISO date: ${iso}`);
  const day = parseISODate(iso).getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return addDaysISO(iso, -offset);
}

export function endOfWeekISO(weekStart) {
  return addDaysISO(weekStart, 6);
}

export function compareWeeks(a, b) {
  return Math.round((parseISODate(a) - parseISODate(b)) / (7 * DAY_MS));
}

export function isoWeekInfo(iso) {
  const date = parseISODate(iso);
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return {
    year: target.getUTCFullYear(),
    week: 1 + Math.round((target - firstThursday) / (7 * DAY_MS)),
  };
}

export function weekdayCN(iso) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseISODate(iso).getUTCDay()];
}

export function formatMonthDay(iso) {
  const date = parseISODate(iso);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

export function formatFullDateCN(iso, withYear = true) {
  const date = parseISODate(iso);
  const year = withYear ? `${date.getUTCFullYear()}年` : '';
  return `${year}${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${weekdayCN(iso)}`;
}

export function weekRangeLabel(weekStart, { withYear = false } = {}) {
  const start = parseISODate(weekStart);
  const end = parseISODate(endOfWeekISO(weekStart));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const yearPrefix = withYear ? `${start.getUTCFullYear()}年` : '';
  if (sameMonth) {
    return `${yearPrefix}${start.getUTCMonth() + 1}月${start.getUTCDate()}日 — ${end.getUTCDate()}日`;
  }
  return `${yearPrefix}${start.getUTCMonth() + 1}月${start.getUTCDate()}日 — ${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
}

export function relativeWeekLabel(weekStart, currentWeek) {
  const diff = compareWeeks(weekStart, currentWeek);
  if (diff === 0) return '本周';
  if (diff === 1) return '下周';
  if (diff === -1) return '上周';
  if (diff > 1) return `${diff} 周后`;
  return `${Math.abs(diff)} 周前`;
}

export function pluralWeeks(count) {
  return `${count} 周`;
}

export function createDefaultState(now = new Date()) {
  const currentWeek = startOfWeekISO(todayISO(now));
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: nowISO(now),
    settings: defaultSettings(),
    projects: [],
    tasks: [],
    habits: [],
    habitCompletions: [],
    bonusTasks: [],
    rewards: defaultRewards(),
    redemptions: [],
    pools: defaultPools(),
    draws: [],
    ledger: [],
    meta: {
      lastSeenWeek: currentWeek,
      activeProjectId: null,
      onboardingDismissed: false,
    },
  };
}

function normalizeString(value, fallback = '', maxLength = 500) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeId(value, prefix) {
  const id = normalizeString(value, '', 120);
  return id || uid(prefix);
}

function uniqueIdFactory() {
  const used = new Set();
  return (value, prefix) => {
    let id = normalizeId(value, prefix);
    while (used.has(id)) id = uid(prefix);
    used.add(id);
    return id;
  };
}

function normalizeWeekOrder(value) {
  const valid = ['daily', 'week', 'bonus'];
  const seen = new Set();
  const order = [];
  for (const id of Array.isArray(value) ? value : []) {
    if (!valid.includes(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of valid) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

function normalizeHolidayDates(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : []).filter((date) => isValidISODate(date)),
    ),
  ].slice(0, 80);
}

export function isDoublePointsDate(settings = {}, date = todayISO()) {
  if (settings.doublePoints === false) return false;
  if (!isValidISODate(date)) return false;
  // Use local weekday, not UTC, so Saturday/Sunday match the user's clock.
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (weekday === 0 || weekday === 6) return true;
  return (settings.holidayDates || []).includes(date);
}

function completionMultiplier(state, now = new Date()) {
  return isDoublePointsDate(state.settings, todayISO(now)) ? 2 : 1;
}

export function normalizeSettings(raw = {}) {
  const base = defaultSettings();
  const input = raw && typeof raw === 'object' ? raw : {};
  const ai = input.ai && typeof input.ai === 'object' ? input.ai : {};
  return {
    ...base,
    ...input,
    theme: THEMES.some((theme) => theme.id === input.theme) ? input.theme : base.theme,
    alwaysOnTop: Boolean(input.alwaysOnTop ?? base.alwaysOnTop),
    autoFade: Boolean(input.autoFade ?? base.autoFade),
    doublePoints: Boolean(input.doublePoints ?? base.doublePoints),
    holidayDates: normalizeHolidayDates(input.holidayDates ?? base.holidayDates),
    fadeOpacity: clamp(input.fadeOpacity ?? base.fadeOpacity, 0.2, 1),
    panelOpacity: clamp(input.panelOpacity ?? base.panelOpacity, 0.45, 1),
    accent: /^#[0-9a-f]{6}$/i.test(input.accent || '') ? input.accent : base.accent,
    launchAtLogin: Boolean(input.launchAtLogin ?? base.launchAtLogin),
    clickThrough: false,
    compact: Boolean(input.compact ?? base.compact),
    reduceMotion: Boolean(input.reduceMotion ?? base.reduceMotion),
    weekOrder: normalizeWeekOrder(input.weekOrder),
    ai: {
      ...base.ai,
      ...ai,
      provider: normalizeString(ai.provider, base.ai.provider, 30) || base.ai.provider,
      baseUrl: normalizeString(ai.baseUrl, base.ai.baseUrl, 500).replace(/\/+$/, ''),
      apiKey: typeof ai.apiKey === 'string' ? ai.apiKey.slice(0, 400) : '',
      model: normalizeString(ai.model, base.ai.model, 120),
      temperature: clamp(ai.temperature ?? base.ai.temperature, 0, 1.5),
      jsonMode: Boolean(ai.jsonMode ?? base.ai.jsonMode),
    },
  };
}

export function normalizeState(raw = {}, now = new Date()) {
  const base = createDefaultState(now);
  const input = raw && typeof raw === 'object' ? raw : {};
  const idForProject = uniqueIdFactory();
  const projectIds = new Set();

  const projects = (Array.isArray(input.projects) ? input.projects : [])
    .slice(0, 80)
    .map((project) => {
      if (!project || typeof project !== 'object') return null;
      const title = normalizeString(project.title, '', 120);
      if (!title) return null;
      const id = idForProject(project.id, 'pj');
      projectIds.add(id);
      const startDate = isValidISODate(project.startDate)
        ? startOfWeekISO(project.startDate)
        : startOfWeekISO(todayISO(now));
      const plannedWeeks = Math.round(clamp(project.plannedWeeks ?? 12, 1, MAX_WEEKS));
      return {
        id,
        title,
        goal: normalizeString(project.goal, '', 1200),
        startDate,
        plannedWeeks,
        color: /^#[0-9a-f]{6}$/i.test(project.color || '')
          ? project.color
          : PROJECT_COLORS[projectIds.size % PROJECT_COLORS.length],
        source: ['ai', 'manual', 'template', 'demo'].includes(project.source)
          ? project.source
          : 'manual',
        createdAt: normalizeString(project.createdAt, nowISO(now), 40),
        shiftCount: Math.max(0, Math.round(Number(project.shiftCount) || 0)),
        lastShiftedAt: normalizeString(project.lastShiftedAt, '', 40) || null,
        weeksMeta: Array.isArray(project.weeksMeta)
          ? project.weeksMeta.slice(0, MAX_WEEKS).map((week, index) => ({
              week: Math.round(clamp(week?.week ?? index + 1, 1, MAX_WEEKS)),
              theme: normalizeString(week?.theme, '', 120),
              outcome: normalizeString(week?.outcome, '', 300),
            }))
          : [],
      };
    })
    .filter(Boolean);

  const idForTask = uniqueIdFactory();
  let taskCount = 0;
  const tasks = (Array.isArray(input.tasks) ? input.tasks : [])
    .slice(0, MAX_TASKS)
    .map((task) => {
      if (!task || typeof task !== 'object') return null;
      const title = normalizeString(task.title, '', 200);
      if (!title || !isValidISODate(task.weekStart)) return null;
      taskCount += 1;
      const status = task.status === 'done' ? 'done' : 'todo';
      const projectId = projectIds.has(task.projectId) ? task.projectId : null;
      return {
        id: idForTask(task.id, 'tk'),
        projectId,
        title,
        detail: normalizeString(task.detail, '', 1200),
        weekStart: startOfWeekISO(task.weekStart),
        points: Math.round(clamp(task.points ?? 15, 1, 500)),
        estimateMin: Math.round(clamp(task.estimateMin ?? 0, 0, 1440)),
        awardedPoints:
          status === 'done'
            ? Math.round(clamp(task.awardedPoints ?? task.points ?? 15, 1, 1000))
            : null,
        status,
        doneAt: status === 'done' ? normalizeString(task.doneAt, nowISO(now), 40) : null,
        createdAt: normalizeString(task.createdAt, nowISO(now), 40),
        updatedAt: normalizeString(task.updatedAt, nowISO(now), 40),
        order: Number.isFinite(Number(task.order)) ? Number(task.order) : taskCount,
        carryOver: Boolean(task.carryOver),
        lastDeferredAt: normalizeString(task.lastDeferredAt, '', 40) || null,
        seriesId: normalizeString(task.seriesId, '', 120) || null,
        recurring: Boolean(task.recurring),
        source: ['ai', 'manual', 'template', 'demo'].includes(task.source)
          ? task.source
          : 'manual',
      };
    })
    .filter(Boolean);

  const idForHabit = uniqueIdFactory();
  const habitIds = new Set();
  let habitCount = 0;
  const habits = (Array.isArray(input.habits) ? input.habits : [])
    .slice(0, 60)
    .map((habit) => {
      if (!habit || typeof habit !== 'object') return null;
      const title = normalizeString(habit.title, '', 120);
      if (!title) return null;
      habitCount += 1;
      const id = idForHabit(habit.id, 'hb');
      habitIds.add(id);
      return {
        id,
        title,
        detail: normalizeString(habit.detail, '', 400),
        icon: normalizeString(habit.icon, '', 8),
        points: Math.round(clamp(habit.points ?? 10, 1, 100)),
        active: habit.active === undefined ? true : Boolean(habit.active),
        createdAt: normalizeString(habit.createdAt, nowISO(now), 40),
        order: Number.isFinite(Number(habit.order)) ? Number(habit.order) : habitCount,
      };
    })
    .filter(Boolean);

  const idForCompletion = uniqueIdFactory();
  const seenHabitDates = new Set();
  const habitPointMap = new Map(habits.map((habit) => [habit.id, habit.points]));
  const habitCompletions = (Array.isArray(input.habitCompletions) ? input.habitCompletions : [])
    .slice(0, 5000)
    .map((completion) => {
      if (!completion || typeof completion !== 'object') return null;
      if (!habitIds.has(completion.habitId) || !isValidISODate(completion.date)) return null;
      const key = `${completion.habitId}|${completion.date}`;
      if (seenHabitDates.has(key)) return null;
      seenHabitDates.add(key);
      const habitPoints = habitPointMap.get(completion.habitId) ?? 10;
      return {
        id: idForCompletion(completion.id, 'hc'),
        habitId: completion.habitId,
        date: completion.date,
        points: Math.round(clamp(completion.points ?? habitPoints, 1, habitPoints)),
        at: normalizeString(completion.at, `${completion.date}T12:00:00.000Z`, 40),
      };
    })
    .filter(Boolean);

  const idForBonus = uniqueIdFactory();
  const bonusTasks = (Array.isArray(input.bonusTasks) ? input.bonusTasks : [])
    .slice(0, 200)
    .map((bonus, index) => {
      if (!bonus || typeof bonus !== 'object') return null;
      const title = normalizeString(bonus.title, '', 200);
      if (!title) return null;
      const status = bonus.status === 'done' ? 'done' : 'todo';
      return {
        id: idForBonus(bonus.id, 'bn'),
        title,
        detail: normalizeString(bonus.detail, '', 1200),
        icon: normalizeString(bonus.icon, '✨', 8) || '✨',
        points: Math.round(clamp(bonus.points ?? 100, 1, 10_000)),
        awardedPoints:
          status === 'done'
            ? Math.round(clamp(bonus.awardedPoints ?? bonus.points ?? 100, 1, 20_000))
            : null,
        status,
        doneAt: status === 'done' ? normalizeString(bonus.doneAt, nowISO(now), 40) : null,
        createdAt: normalizeString(bonus.createdAt, nowISO(now), 40),
        updatedAt: normalizeString(bonus.updatedAt, nowISO(now), 40),
        order: Number.isFinite(Number(bonus.order)) ? Number(bonus.order) : index + 1,
      };
    })
    .filter(Boolean);

  const idForReward = uniqueIdFactory();
  const rewardsInput = Array.isArray(input.rewards) ? input.rewards : base.rewards;
  const rewards = rewardsInput
    .slice(0, 80)
    .map((reward) => {
      if (!reward || typeof reward !== 'object') return null;
      const title = normalizeString(reward.title, '', 120);
      if (!title) return null;
      return {
        id: idForReward(reward.id, 'rw'),
        title,
        cost: Math.round(clamp(reward.cost ?? 50, 1, 100_000)),
        icon: normalizeString(reward.icon, '🎁', 8) || '🎁',
        note: normalizeString(reward.note, '', 300),
        archived: Boolean(reward.archived),
      };
    })
    .filter(Boolean);

  const idForPool = uniqueIdFactory();
  const idForPrize = uniqueIdFactory();
  const poolsInput = Array.isArray(input.pools) ? input.pools : base.pools;
  const pools = poolsInput
    .slice(0, 24)
    .map((pool) => {
      if (!pool || typeof pool !== 'object') return null;
      const title = normalizeString(pool.title, '', 80);
      const prizes = (Array.isArray(pool.prizes) ? pool.prizes : [])
        .slice(0, 12)
        .map((prize) => {
          if (!prize || typeof prize !== 'object') return null;
          return {
            id: idForPrize(prize.id, 'pz'),
            label: normalizeString(prize.label, '未命名', 80) || '未命名',
            weight: clamp(prize.weight ?? 1, 0.0001, 100),
            points: Math.round(clamp(prize.points ?? 0, 0, 1_000_000)),
          };
        })
        .filter(Boolean);
      if (!title || prizes.length === 0) return null;
      const size = Math.max(
        prizes.length,
        Math.round(clamp(pool.size ?? 100, prizes.length, 5000)),
      );
      const prizeCounts = allocatePrizeCounts(prizes, size);
      const savedRemaining =
        pool.remainingCounts && typeof pool.remainingCounts === 'object'
          ? pool.remainingCounts
          : null;
      const remainingCounts = {};
      for (const prize of prizes) {
        remainingCounts[prize.id] = savedRemaining
          ? Math.round(clamp(savedRemaining[prize.id] ?? prizeCounts[prize.id], 0, prizeCounts[prize.id]))
          : prizeCounts[prize.id];
      }
      return {
        id: idForPool(pool.id, 'pool'),
        title,
        subtitle: normalizeString(pool.subtitle, '', 200),
        cost: Math.round(clamp(pool.cost ?? 50, 1, 100_000)),
        icon: normalizeString(pool.icon, '🌌', 8) || '🌌',
        size,
        prizeCounts,
        remainingCounts,
        resetAt: normalizeString(pool.resetAt, '', 40) || null,
        prizes,
      };
    })
    .filter(Boolean);

  const redemptions = (Array.isArray(input.redemptions) ? input.redemptions : [])
    .slice(0, 300)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        id: normalizeId(item.id, 'rd'),
        rewardId: normalizeString(item.rewardId, '', 120),
        title: normalizeString(item.title, '奖励', 120) || '奖励',
        cost: Math.round(clamp(item.cost ?? 0, 0, 100_000)),
        at: normalizeString(item.at, nowISO(now), 40),
        usedAt: normalizeString(item.usedAt, '', 40) || null,
      };
    })
    .filter(Boolean);

  const draws = (Array.isArray(input.draws) ? input.draws : [])
    .slice(0, 300)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        id: normalizeId(item.id, 'dr'),
        poolId: normalizeString(item.poolId, '', 120),
        poolTitle: normalizeString(item.poolTitle, '奖池', 80) || '奖池',
        cost: Math.round(clamp(item.cost ?? 0, 0, 100_000)),
        prizeLabel: normalizeString(item.prizeLabel, '空手而归', 80) || '空手而归',
        points: Math.round(clamp(item.points ?? 0, 0, 1_000_000)),
        at: normalizeString(item.at, nowISO(now), 40),
      };
    })
    .filter(Boolean);

  const ledger = (Array.isArray(input.ledger) ? input.ledger : [])
    .slice(0, 2000)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const amount = Math.round(Number(entry.amount));
      if (!Number.isFinite(amount)) return null;
      return {
        id: normalizeId(entry.id, 'lg'),
        kind: ['task', 'habit', 'bonus', 'redeem', 'lottery', 'adjust'].includes(entry.kind)
          ? entry.kind
          : 'adjust',
        amount,
        at: normalizeString(entry.at, nowISO(now), 40),
        refId: normalizeString(entry.refId, '', 120),
        poolId: normalizeString(entry.poolId, '', 120) || null,
        hiddenAt: normalizeString(entry.hiddenAt, '', 40) || null,
        note: normalizeString(entry.note, '', 300),
      };
    })
    .filter(Boolean);

  const state = {
    ...base,
    ...input,
    schemaVersion: SCHEMA_VERSION,
    createdAt: normalizeString(input.createdAt, base.createdAt, 40),
    settings: normalizeSettings(input.settings),
    projects,
    tasks,
    habits,
    habitCompletions,
    bonusTasks,
    rewards,
    redemptions,
    pools,
    draws,
    ledger,
    meta: {
      ...base.meta,
      ...(input.meta && typeof input.meta === 'object' ? input.meta : {}),
      lastSeenWeek: isValidISODate(input.meta?.lastSeenWeek)
        ? startOfWeekISO(input.meta.lastSeenWeek)
        : base.meta.lastSeenWeek,
      activeProjectId: projectIds.has(input.meta?.activeProjectId)
        ? input.meta.activeProjectId
        : null,
      onboardingDismissed: Boolean(input.meta?.onboardingDismissed),
    },
  };

  repairLedger(state);
  return state;
}

export function repairLedger(state) {
  const independentEntries = (state.ledger || []).filter(
    (entry) => entry.kind !== 'task' && entry.kind !== 'habit' && entry.kind !== 'bonus',
  );
  const taskEntries = [];
  const seenTasks = new Set();
  for (const task of state.tasks || []) {
    if (task.status !== 'done') continue;
    if (seenTasks.has(task.id)) continue;
    seenTasks.add(task.id);
    taskEntries.push({
      id: `lg_task_${task.id}`,
      kind: 'task',
      amount: Math.max(1, Math.round(task.awardedPoints ?? task.points)),
      at: task.doneAt || task.updatedAt || state.createdAt,
      refId: task.id,
      note: `完成「${task.title}」`,
    });
  }

  const habitMap = new Map((state.habits || []).map((habit) => [habit.id, habit]));
  const habitEntries = [];
  for (const completion of state.habitCompletions || []) {
    const habit = habitMap.get(completion.habitId);
    if (!habit) continue;
    habitEntries.push({
      id: `lg_habit_${completion.id}`,
      kind: 'habit',
      amount: Math.max(1, Math.round(completion.points)),
      at: completion.at || `${completion.date}T12:00:00.000Z`,
      refId: completion.id,
      note: `每日「${habit.title}」`,
    });
  }

  const bonusEntries = [];
  for (const bonus of state.bonusTasks || []) {
    if (bonus.status !== 'done') continue;
    bonusEntries.push({
      id: `lg_bonus_${bonus.id}`,
      kind: 'bonus',
      amount: Math.max(1, Math.round(bonus.awardedPoints ?? bonus.points)),
      at: bonus.doneAt || bonus.updatedAt || state.createdAt,
      refId: bonus.id,
      note: `待办完成「${bonus.title}」`,
    });
  }

  state.ledger = [...independentEntries, ...taskEntries, ...habitEntries, ...bonusEntries].sort(
    (a, b) => String(a.at).localeCompare(String(b.at)),
  );
  return state;
}

export function computeBalance(state) {
  return (state.ledger || []).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
}

export function ledgerSummary(state) {
  const taskPoints = (state.tasks || [])
    .filter((task) => task.status === 'done')
    .reduce((sum, task) => sum + (Number(task.awardedPoints ?? task.points) || 0), 0);
  const habitPoints = (state.habitCompletions || []).reduce(
    (sum, completion) => sum + (Number(completion.points) || 0),
    0,
  );
  const bonusPoints = (state.bonusTasks || [])
    .filter((bonus) => bonus.status === 'done')
    .reduce((sum, bonus) => sum + (Number(bonus.awardedPoints ?? bonus.points) || 0), 0);
  const prizePoints = (state.draws || []).reduce((sum, draw) => sum + (Number(draw.points) || 0), 0);
  const spent =
    (state.redemptions || []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0) +
    (state.draws || []).reduce((sum, draw) => sum + (Number(draw.cost) || 0), 0);
  return {
    earned: taskPoints + habitPoints + bonusPoints + prizePoints,
    spent,
    balance: computeBalance(state),
    taskPoints,
    habitPoints,
    bonusPoints,
    prizePoints,
    drawCount: state.draws?.length || 0,
    redemptionCount: state.redemptions?.length || 0,
  };
}

function taskComparator(a, b) {
  const orderA = Number.isFinite(a.order) ? a.order : 0;
  const orderB = Number.isFinite(b.order) ? b.order : 0;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

export function tasksForWeek(state, weekStart, { includeDone = true } = {}) {
  return (state.tasks || [])
    .filter((task) => task.weekStart === weekStart && (includeDone || task.status !== 'done'))
    .sort(taskComparator);
}

export function getHabit(state, habitId) {
  return (state.habits || []).find((habit) => habit.id === habitId) || null;
}

export function activeHabits(state) {
  return (state.habits || [])
    .filter((habit) => habit.active)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export function habitCompletion(state, habitId, date = todayISO()) {
  return (
    (state.habitCompletions || []).find(
      (completion) => completion.habitId === habitId && completion.date === date,
    ) || null
  );
}

export function addHabit(state, input = {}, now = new Date()) {
  const title = normalizeString(input.title, '', 120);
  if (!title) throw new Error('每日任务名称不能为空');
  const habit = {
    id: uid('hb'),
    title,
    detail: normalizeString(input.detail, '', 400),
    icon: normalizeString(input.icon, '', 8),
    points: Math.round(clamp(input.points ?? 10, 1, 100)),
    active: true,
    createdAt: nowISO(now),
    order: Date.now() + Math.random(),
  };
  state.habits.push(habit);
  return habit;
}

export function updateHabit(state, habitId, patch = {}) {
  const habit = getHabit(state, habitId);
  if (!habit) throw new Error('每日任务不存在');
  if (typeof patch.title === 'string') {
    const title = normalizeString(patch.title, '', 120);
    if (!title) throw new Error('每日任务名称不能为空');
    habit.title = title;
  }
  if (patch.detail !== undefined) habit.detail = normalizeString(patch.detail, '', 400);
  if (patch.icon !== undefined) habit.icon = normalizeString(patch.icon, '', 8);
  if (patch.points !== undefined) habit.points = Math.round(clamp(patch.points, 1, 100));
  if (patch.active !== undefined) habit.active = Boolean(patch.active);
  return habit;
}

export function deleteHabit(state, habitId) {
  const before = state.habits.length;
  const earned = (state.habitCompletions || [])
    .filter((completion) => completion.habitId === habitId)
    .reduce((sum, completion) => sum + (Number(completion.points) || 0), 0);
  if (computeBalance(state) - earned < 0) {
    throw new Error('这个每日任务赚的积分已经花掉了，暂时不能删除');
  }
  state.habits = state.habits.filter((habit) => habit.id !== habitId);
  state.habitCompletions = state.habitCompletions.filter(
    (completion) => completion.habitId !== habitId,
  );
  repairLedger(state);
  return before !== state.habits.length;
}

export function completeHabit(state, habitId, date = todayISO(), now = new Date()) {
  const habit = getHabit(state, habitId);
  if (!habit) return { ok: false, error: '每日任务不存在' };
  if (!habit.active) return { ok: false, error: '这个每日任务已经暂停' };
  if (habitCompletion(state, habitId, date)) {
    return { ok: false, error: '今天已经完成过了' };
  }
  // Daily tasks use their configured points. Weekend/holiday double applies to
  // weekly tasks and bonus tasks, not the daily habit list.
  const points = habit.points;
  const completion = {
    id: uid('hc'),
    habitId,
    date,
    points,
    at: nowISO(now),
  };
  state.habitCompletions.push(completion);
  repairLedger(state);
  return { ok: true, points, completion, habit };
}

export function uncompleteHabit(state, habitId, date = todayISO(), now = new Date()) {
  const completion = habitCompletion(state, habitId, date);
  if (!completion) return { ok: false, error: '今天还没有完成' };
  const balance = computeBalance(state);
  if (balance - completion.points < 0) {
    return {
      ok: false,
      error: `这 ${completion.points} 积分已经花掉了，先保留完成状态吧`,
    };
  }
  state.habitCompletions = state.habitCompletions.filter(
    (item) => !(item.habitId === habitId && item.date === date),
  );
  repairLedger(state);
  return { ok: true, points: completion.points, habit: getHabit(state, habitId) };
}

export function habitStats(state, date = todayISO()) {
  const habits = activeHabits(state);
  const done = habits.filter((habit) => habitCompletion(state, habit.id, date)).length;
  const points = habits.reduce((sum, habit) => {
    const completion = habitCompletion(state, habit.id, date);
    return sum + (completion ? completion.points : 0);
  }, 0);
  return {
    total: habits.length,
    done,
    remaining: habits.length - done,
    points,
    progress: habits.length ? done / habits.length : 0,
  };
}

export function habitStreak(state, habitId, date = todayISO()) {
  const dates = new Set(
    (state.habitCompletions || [])
      .filter((completion) => completion.habitId === habitId)
      .map((completion) => completion.date),
  );
  let cursor = date;
  if (!dates.has(cursor)) {
    cursor = addDaysISO(cursor, -1);
    if (!dates.has(cursor)) return 0;
  }
  let count = 0;
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return count;
}

export function habitWeek(state, habitId, date = todayISO(), days = 7) {
  const dates = new Set(
    (state.habitCompletions || [])
      .filter((completion) => completion.habitId === habitId)
      .map((completion) => completion.date),
  );
  return Array.from({ length: days }, (_, index) => {
    const day = addDaysISO(date, index - (days - 1));
    return { date: day, done: dates.has(day), today: day === date };
  });
}

export function overdueTasks(state, beforeWeek, { projectId = null } = {}) {
  return (state.tasks || [])
    .filter(
      (task) =>
        task.status !== 'done' &&
        task.weekStart < beforeWeek &&
        (!projectId || task.projectId === projectId),
    )
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || taskComparator(a, b));
}

export function projectTasks(state, projectId) {
  return (state.tasks || [])
    .filter((task) => task.projectId === projectId)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || taskComparator(a, b));
}

export function projectStats(state, projectId) {
  const tasks = projectTasks(state, projectId);
  const done = tasks.filter((task) => task.status === 'done').length;
  const total = tasks.length;
  const points = tasks
    .filter((task) => task.status === 'done')
    .reduce((sum, task) => sum + (Number(task.awardedPoints ?? task.points) || 0), 0);
  const remaining = tasks.filter((task) => task.status !== 'done');
  const lastWeek = tasks.reduce((max, task) => (task.weekStart > max ? task.weekStart : max), '');
  return {
    done,
    total,
    remaining: total - done,
    points,
    progress: total ? done / total : 0,
    lastWeek: lastWeek || null,
  };
}

export function getBonusTask(state, bonusId) {
  return (state.bonusTasks || []).find((bonus) => bonus.id === bonusId) || null;
}

export function activeBonusTasks(state) {
  return (state.bonusTasks || [])
    .filter((bonus) => bonus.status !== 'done')
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export function doneBonusTasks(state) {
  return (state.bonusTasks || [])
    .filter((bonus) => bonus.status === 'done')
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
}

export function addBonusTask(state, input = {}, now = new Date()) {
  const title = normalizeString(input.title, '', 200);
  if (!title) throw new Error('待办名称不能为空');
  const bonus = {
    id: uid('bn'),
    title,
    detail: normalizeString(input.detail, '', 1200),
    icon: normalizeString(input.icon, '✨', 8) || '✨',
    points: Math.round(clamp(input.points ?? 100, 1, 10_000)),
    status: 'todo',
    doneAt: null,
    createdAt: nowISO(now),
    updatedAt: nowISO(now),
    order: Date.now() + Math.random(),
  };
  state.bonusTasks.push(bonus);
  return bonus;
}

export function updateBonusTask(state, bonusId, patch = {}, now = new Date()) {
  const bonus = getBonusTask(state, bonusId);
  if (!bonus) throw new Error('待办不存在');
  if (typeof patch.title === 'string') {
    const title = normalizeString(patch.title, '', 200);
    if (!title) throw new Error('待办名称不能为空');
    bonus.title = title;
  }
  if (patch.detail !== undefined) bonus.detail = normalizeString(patch.detail, '', 1200);
  if (patch.icon !== undefined) bonus.icon = normalizeString(patch.icon, '✨', 8) || '✨';
  if (patch.points !== undefined) {
    if (bonus.status === 'done') throw new Error('已完成任务的积分已经记账，不能再改');
    bonus.points = Math.round(clamp(patch.points, 1, 10_000));
  }
  bonus.updatedAt = nowISO(now);
  if (bonus.status === 'done') repairLedger(state);
  return bonus;
}

export function deleteBonusTask(state, bonusId) {
  const bonus = getBonusTask(state, bonusId);
  if (!bonus) return false;
  const earned = bonus.status === 'done' ? (bonus.awardedPoints ?? bonus.points) : 0;
  if (computeBalance(state) - earned < 0) {
    throw new Error('这个待办赚的积分已经花掉了，暂时不能删除');
  }
  state.bonusTasks = state.bonusTasks.filter((item) => item.id !== bonusId);
  repairLedger(state);
  return true;
}

export function completeBonusTask(state, bonusId, now = new Date()) {
  const bonus = getBonusTask(state, bonusId);
  if (!bonus) return { ok: false, error: '待办不存在' };
  if (bonus.status === 'done') return { ok: false, error: '这个任务已经完成了' };
  const points = bonus.points * completionMultiplier(state, now);
  bonus.status = 'done';
  bonus.awardedPoints = points;
  bonus.doneAt = nowISO(now);
  bonus.updatedAt = bonus.doneAt;
  repairLedger(state);
  return { ok: true, points, bonus };
}

export function uncompleteBonusTask(state, bonusId) {
  const bonus = getBonusTask(state, bonusId);
  if (!bonus) return { ok: false, error: '待办不存在' };
  if (bonus.status !== 'done') return { ok: false, error: '这个任务还没完成' };
  const awarded = bonus.awardedPoints ?? bonus.points;
  const balance = computeBalance(state);
  if (balance - awarded < 0) {
    return {
      ok: false,
      error: `这 ${awarded} 积分已经花掉了，先保留完成状态吧`,
    };
  }
  bonus.status = 'todo';
  bonus.awardedPoints = null;
  bonus.doneAt = null;
  bonus.updatedAt = nowISO();
  repairLedger(state);
  return { ok: true, bonus };
}

export function weekStats(state, weekStart) {
  const tasks = tasksForWeek(state, weekStart);
  const done = tasks.filter((task) => task.status === 'done').length;
  const points = tasks
    .filter((task) => task.status === 'done')
    .reduce((sum, task) => sum + (Number(task.awardedPoints ?? task.points) || 0), 0);
  return {
    total: tasks.length,
    done,
    remaining: tasks.length - done,
    points,
    progress: tasks.length ? done / tasks.length : 0,
  };
}

export function getProject(state, projectId) {
  return (state.projects || []).find((project) => project.id === projectId) || null;
}

export function getTask(state, taskId) {
  return (state.tasks || []).find((task) => task.id === taskId) || null;
}

export function getReward(state, rewardId) {
  return (state.rewards || []).find((reward) => reward.id === rewardId) || null;
}

export function getPool(state, poolId) {
  return (state.pools || []).find((pool) => pool.id === poolId) || null;
}

export function createProject(state, input = {}, now = new Date()) {
  const title = normalizeString(input.title, '', 120);
  if (!title) throw new Error('项目名称不能为空');
  const startDate = isValidISODate(input.startDate)
    ? startOfWeekISO(input.startDate)
    : startOfWeekISO(todayISO(now));
  const project = {
    id: uid('pj'),
    title,
    goal: normalizeString(input.goal, '', 1200),
    startDate,
    plannedWeeks: Math.round(clamp(input.weeks ?? 12, 1, MAX_WEEKS)),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '')
      ? input.color
      : PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length],
    source: input.source || 'manual',
    createdAt: nowISO(now),
    shiftCount: 0,
    lastShiftedAt: null,
    weeksMeta: [],
  };
  state.projects.push(project);
  state.meta.activeProjectId = project.id;
  return project;
}

export function createTask(state, input = {}, now = new Date()) {
  const title = normalizeString(input.title, '', 200);
  if (!title) throw new Error('任务内容不能为空');
  const projectId = getProject(state, input.projectId) ? input.projectId : null;
  const weekStart = isValidISODate(input.weekStart)
    ? startOfWeekISO(input.weekStart)
    : startOfWeekISO(todayISO(now));
  const task = {
    id: uid('tk'),
    projectId,
    title,
    detail: normalizeString(input.detail, '', 1200),
    weekStart,
    points: Math.round(clamp(input.points ?? 15, 1, 500)),
    estimateMin: Math.round(clamp(input.estimateMin ?? 0, 0, 1440)),
    status: 'todo',
    doneAt: null,
    createdAt: nowISO(now),
    updatedAt: nowISO(now),
    order: Date.now() + Math.random(),
    carryOver: false,
    lastDeferredAt: null,
    source: input.source || 'manual',
  };
  state.tasks.push(task);
  return task;
}

export function updateTask(state, taskId, patch = {}, now = new Date()) {
  const task = getTask(state, taskId);
  if (!task) throw new Error('任务不存在');
  if (typeof patch.title === 'string') {
    const title = normalizeString(patch.title, '', 200);
    if (!title) throw new Error('任务内容不能为空');
    task.title = title;
  }
  if (typeof patch.detail === 'string') task.detail = normalizeString(patch.detail, '', 1200);
  if (patch.projectId !== undefined) {
    task.projectId = getProject(state, patch.projectId) ? patch.projectId : null;
  }
  if (isValidISODate(patch.weekStart)) task.weekStart = startOfWeekISO(patch.weekStart);
  if (task.status !== 'done' && patch.points !== undefined) {
    task.points = Math.round(clamp(patch.points, 1, 500));
  }
  if (patch.estimateMin !== undefined) {
    task.estimateMin = Math.round(clamp(patch.estimateMin, 0, 1440));
  }
  task.updatedAt = nowISO(now);
  if (task.status === 'done') {
    const entry = state.ledger.find((item) => item.kind === 'task' && item.refId === task.id);
    if (entry) entry.amount = task.points;
  }
  return task;
}

export function deleteTask(state, taskId) {
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  state.ledger = state.ledger.filter(
    (entry) => !(entry.kind === 'task' && entry.refId === taskId),
  );
  return before !== state.tasks.length;
}

export function deleteProject(state, projectId) {
  const taskIds = new Set(
    state.tasks.filter((task) => task.projectId === projectId).map((task) => task.id),
  );
  state.projects = state.projects.filter((project) => project.id !== projectId);
  state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
  state.ledger = state.ledger.filter(
    (entry) => !(entry.kind === 'task' && taskIds.has(entry.refId)),
  );
  if (state.meta.activeProjectId === projectId) {
    state.meta.activeProjectId = state.projects[0]?.id || null;
  }
  return taskIds.size;
}

export function completeTask(state, taskId, now = new Date()) {
  const task = getTask(state, taskId);
  if (!task) return { ok: false, error: '任务不存在' };
  if (task.status === 'done') return { ok: false, error: '任务已经完成' };
  const points = task.points * completionMultiplier(state, now);
  task.status = 'done';
  task.awardedPoints = points;
  task.doneAt = nowISO(now);
  task.updatedAt = task.doneAt;
  repairLedger(state);
  return { ok: true, points, task };
}

export function uncompleteTask(state, taskId) {
  const task = getTask(state, taskId);
  if (!task) return { ok: false, error: '任务不存在' };
  if (task.status !== 'done') return { ok: false, error: '任务还未完成' };
  const awarded = task.awardedPoints ?? task.points;
  const balance = computeBalance(state);
  if (balance - awarded < 0) {
    return {
      ok: false,
      error: `这 ${awarded} 积分已经花掉了，先保留完成状态吧`,
    };
  }
  task.status = 'todo';
  task.awardedPoints = null;
  task.doneAt = null;
  task.updatedAt = nowISO();
  repairLedger(state);
  return { ok: true, task };
}

export function deferTasks(state, { taskId, fromWeek, mode }, now = new Date()) {
  const task = getTask(state, taskId);
  if (!task) return { ok: false, error: '任务不存在' };
  if (!['shift', 'stack'].includes(mode)) return { ok: false, error: '未知的推迟方式' };
  const sourceWeek = isValidISODate(fromWeek) ? startOfWeekISO(fromWeek) : task.weekStart;
  const project = task.projectId ? getProject(state, task.projectId) : null;
  const candidates = state.tasks.filter((item) => {
    if (item.status === 'done') return false;
    if (project) return item.projectId === project.id;
    return item.id === task.id;
  });

  if (mode === 'shift') {
    // The whole project's unfinished flow moves one week; the sequence is preserved.
    for (const item of candidates) {
      item.weekStart = addWeeksISO(item.weekStart, 1);
      item.updatedAt = nowISO(now);
      item.lastDeferredAt = nowISO(now);
    }
    if (project) {
      project.shiftCount += 1;
      project.lastShiftedAt = nowISO(now);
    }
    return {
      ok: true,
      mode,
      moved: candidates.length,
      targetWeek: addWeeksISO(sourceWeek, 1),
      projectId: project?.id || null,
    };
  }

  // "Delay completion" stacks all backlog up to this week into next week.
  const targetWeek = addWeeksISO(sourceWeek, 1);
  const scope = candidates.filter((item) => item.weekStart <= sourceWeek);
  for (const item of scope) {
    item.weekStart = targetWeek;
    item.carryOver = true;
    item.lastDeferredAt = nowISO(now);
    item.updatedAt = nowISO(now);
  }
  const existingNext = state.tasks.filter(
    (item) =>
      item.status !== 'done' &&
      item.weekStart === targetWeek &&
      (project ? item.projectId === project.id : item.id === task.id) &&
      !scope.some((moved) => moved.id === item.id),
  ).length;
  return {
    ok: true,
    mode,
    moved: scope.length,
    targetWeek,
    projectId: project?.id || null,
    nextWeekLoad: existingNext + scope.length,
  };
}

export function deferSingleTask(state, { taskId, fromWeek, mode }, now = new Date()) {
  const task = getTask(state, taskId);
  if (!task) return { ok: false, error: '任务不存在' };
  if (task.status === 'done') return { ok: false, error: '已完成的任务不用推迟' };
  if (!['shift', 'stack'].includes(mode)) return { ok: false, error: '未知的推迟方式' };
  const sourceWeek = isValidISODate(fromWeek) ? startOfWeekISO(fromWeek) : task.weekStart;

  if (mode === 'shift') {
    const targetWeek = addWeeksISO(task.weekStart, 1);
    task.weekStart = targetWeek;
    task.updatedAt = nowISO(now);
    task.lastDeferredAt = nowISO(now);
    return { ok: true, mode, moved: 1, targetWeek, projectId: task.projectId || null };
  }

  const targetWeek = addWeeksISO(task.weekStart > sourceWeek ? task.weekStart : sourceWeek, 1);
  task.weekStart = targetWeek;
  task.carryOver = true;
  task.updatedAt = nowISO(now);
  task.lastDeferredAt = nowISO(now);
  const nextWeekLoad =
    state.tasks.filter(
      (item) =>
        item.id !== task.id &&
        item.status !== 'done' &&
        item.projectId === task.projectId &&
        item.weekStart === targetWeek,
    ).length + 1;
  return {
    ok: true,
    mode,
    moved: 1,
    targetWeek,
    projectId: task.projectId || null,
    nextWeekLoad,
  };
}

export function moveOverdueToWeek(state, weekStart, { projectId = null } = {}, now = new Date()) {
  if (!isValidISODate(weekStart)) return { ok: false, error: '日期无效' };
  const target = startOfWeekISO(weekStart);
  const scope = state.tasks.filter(
    (task) =>
      task.status !== 'done' &&
      task.weekStart < target &&
      (!projectId || task.projectId === projectId),
  );
  for (const task of scope) {
    task.weekStart = target;
    task.carryOver = true;
    task.updatedAt = nowISO(now);
  }
  return { ok: true, moved: scope.length, targetWeek: target };
}

export function addReward(state, input = {}) {
  const title = normalizeString(input.title, '', 120);
  if (!title) throw new Error('奖励名称不能为空');
  const reward = {
    id: uid('rw'),
    title,
    cost: Math.round(clamp(input.cost ?? 50, 1, 100_000)),
    icon: normalizeString(input.icon, '🎁', 8) || '🎁',
    note: normalizeString(input.note, '', 300),
    archived: false,
  };
  state.rewards.push(reward);
  return reward;
}

export function updateReward(state, rewardId, patch = {}) {
  const reward = getReward(state, rewardId);
  if (!reward) throw new Error('奖励不存在');
  if (typeof patch.title === 'string') {
    const title = normalizeString(patch.title, '', 120);
    if (!title) throw new Error('奖励名称不能为空');
    reward.title = title;
  }
  if (patch.cost !== undefined) reward.cost = Math.round(clamp(patch.cost, 1, 100_000));
  if (patch.icon !== undefined) reward.icon = normalizeString(patch.icon, '🎁', 8) || '🎁';
  if (patch.note !== undefined) reward.note = normalizeString(patch.note, '', 300);
  if (patch.archived !== undefined) reward.archived = Boolean(patch.archived);
  return reward;
}

export function deleteReward(state, rewardId) {
  const before = state.rewards.length;
  state.rewards = state.rewards.filter((reward) => reward.id !== rewardId);
  return before !== state.rewards.length;
}

export function redeemReward(state, rewardId, now = new Date()) {
  const reward = getReward(state, rewardId);
  if (!reward) return { ok: false, error: '奖励不存在' };
  const balance = computeBalance(state);
  if (balance < reward.cost) {
    return { ok: false, error: `还差 ${reward.cost - balance} 积分` };
  }
  const redemption = {
    id: uid('rd'),
    rewardId: reward.id,
    title: reward.title,
    cost: reward.cost,
    at: nowISO(now),
    usedAt: null,
  };
  state.redemptions.unshift(redemption);
  state.redemptions = state.redemptions.slice(0, 300);
  state.ledger.push({
    id: uid('lg'),
    kind: 'redeem',
    amount: -reward.cost,
    at: redemption.at,
    refId: redemption.id,
    note: `兑换「${reward.title}」`,
  });
  return { ok: true, redemption, balance: balance - reward.cost };
}

export function getRedemption(state, redemptionId) {
  return (state.redemptions || []).find((item) => item.id === redemptionId) || null;
}

export function markRedemptionUsed(state, redemptionId, now = new Date()) {
  const redemption = getRedemption(state, redemptionId);
  if (!redemption) return { ok: false, error: '兑换记录不存在' };
  redemption.usedAt = redemption.usedAt || nowISO(now);
  return { ok: true, redemption };
}

export function unmarkRedemptionUsed(state, redemptionId) {
  const redemption = getRedemption(state, redemptionId);
  if (!redemption) return { ok: false, error: '兑换记录不存在' };
  redemption.usedAt = null;
  return { ok: true, redemption };
}

function clampPoolSize(value, prizeCount) {
  return Math.max(prizeCount, Math.round(clamp(value ?? 100, prizeCount, 5000)));
}

export function allocatePrizeCounts(prizes, size) {
  const list = Array.isArray(prizes) ? prizes : [];
  if (!list.length) return {};
  const total = Math.max(list.length, Math.round(Number(size) || 100));
  const counts = {};
  const base = 1;
  let remaining = total - list.length * base;
  const totalWeight = list.reduce((sum, prize) => sum + (Number(prize.weight) || 0), 0) || 1;
  const quotas = list.map((prize) => ({
    prize,
    exact: (remaining * (Number(prize.weight) || 0)) / totalWeight,
  }));
  let used = list.length * base;
  for (const item of quotas) {
    const count = base + Math.floor(item.exact);
    counts[item.prize.id] = count;
    used += Math.floor(item.exact);
  }
  const leftover = total - used;
  quotas
    .sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
    .slice(0, Math.max(0, leftover))
    .forEach((item) => {
      counts[item.prize.id] += 1;
    });
  return counts;
}

export function poolStock(pool) {
  const counts = pool.prizeCounts || allocatePrizeCounts(pool.prizes || [], pool.size || 100);
  const remaining = (pool.prizes || []).reduce(
    (sum, prize) => sum + Math.max(0, Number(pool.remainingCounts?.[prize.id] ?? counts[prize.id]) || 0),
    0,
  );
  return { total: Object.values(counts).reduce((sum, count) => sum + count, 0), remaining };
}

export function resetPool(state, poolId, now = new Date()) {
  const pool = getPool(state, poolId);
  if (!pool) throw new Error('奖池不存在');
  pool.size = clampPoolSize(pool.size, pool.prizes.length);
  pool.prizeCounts = allocatePrizeCounts(pool.prizes, pool.size);
  pool.remainingCounts = { ...pool.prizeCounts };
  pool.resetAt = nowISO(now);
  const drawPoolIds = new Map((state.draws || []).map((draw) => [draw.id, draw.poolId]));
  for (const entry of state.ledger || []) {
    if (entry.kind !== 'lottery') continue;
    const belongs = entry.poolId ? entry.poolId === poolId : drawPoolIds.get(entry.refId) === poolId;
    if (belongs) entry.hiddenAt = pool.resetAt;
  }
  return pool;
}

export function addPool(state, input = {}) {
  const title = normalizeString(input.title, '', 80);
  if (!title) throw new Error('奖池名称不能为空');
  const prizes = (Array.isArray(input.prizes) ? input.prizes : [])
    .map((prize) => ({
      id: uid('pz'),
      label: normalizeString(prize?.label, '未命名', 80) || '未命名',
      weight: clamp(prize?.weight ?? 1, 0.0001, 100),
      points: Math.round(clamp(prize?.points ?? 0, 0, 1_000_000)),
    }))
    .filter(Boolean);
  if (prizes.length < 2) throw new Error('奖池至少需要两个结果');
  const size = clampPoolSize(input.size, prizes.length);
  const prizeCounts = allocatePrizeCounts(prizes, size);
  const pool = {
    id: uid('pool'),
    title,
    subtitle: normalizeString(input.subtitle, '', 200),
    cost: Math.round(clamp(input.cost ?? 50, 1, 100_000)),
    icon: normalizeString(input.icon, '🌌', 8) || '🌌',
    size,
    prizeCounts,
    remainingCounts: { ...prizeCounts },
    resetAt: null,
    prizes,
  };
  state.pools.push(pool);
  return pool;
}

export function updatePool(state, poolId, patch = {}) {
  const pool = getPool(state, poolId);
  if (!pool) throw new Error('奖池不存在');
  if (typeof patch.title === 'string') {
    const title = normalizeString(patch.title, '', 80);
    if (!title) throw new Error('奖池名称不能为空');
    pool.title = title;
  }
  if (patch.subtitle !== undefined) pool.subtitle = normalizeString(patch.subtitle, '', 200);
  if (patch.icon !== undefined) pool.icon = normalizeString(patch.icon, '🌌', 8) || '🌌';
  if (patch.cost !== undefined) pool.cost = Math.round(clamp(patch.cost, 1, 100_000));
  if (Array.isArray(patch.prizes)) {
    const prizes = patch.prizes
      .map((prize, index) => ({
        id: pool.prizes[index]?.id || uid('pz'),
        label: normalizeString(prize?.label, '未命名', 80) || '未命名',
        weight: clamp(prize?.weight ?? 1, 0.0001, 100),
        points: Math.round(clamp(prize?.points ?? 0, 0, 1_000_000)),
      }))
      .filter(Boolean);
    if (prizes.length < 2) throw new Error('奖池至少需要两个结果');
    pool.prizes = prizes;
  }
  if (patch.size !== undefined || Array.isArray(patch.prizes)) {
    pool.size = clampPoolSize(patch.size ?? pool.size, pool.prizes.length);
    pool.prizeCounts = allocatePrizeCounts(pool.prizes, pool.size);
    pool.remainingCounts = { ...pool.prizeCounts };
    pool.resetAt = null;
  }
  return pool;
}

export function deletePool(state, poolId) {
  const before = state.pools.length;
  state.pools = state.pools.filter((pool) => pool.id !== poolId);
  return before !== state.pools.length;
}

export function poolOdds(pool) {
  const total = pool.prizes.reduce((sum, prize) => sum + prize.weight, 0) || 1;
  const expected = pool.prizes.reduce(
    (sum, prize) => sum + (prize.weight / total) * prize.points,
    0,
  );
  return {
    total,
    expected,
    rtp: pool.cost > 0 ? expected / pool.cost : 0,
    prizes: pool.prizes.map((prize) => ({
      ...prize,
      probability: prize.weight / total,
    })),
  };
}

export function pickPrize(pool, random = Math.random) {
  const odds = poolOdds(pool);
  let roll = random() * odds.total;
  for (const prize of pool.prizes) {
    roll -= prize.weight;
    if (roll < 0) return prize;
  }
  return pool.prizes[pool.prizes.length - 1];
}

export function drawPool(state, poolId, now = new Date(), random = Math.random) {
  const pool = getPool(state, poolId);
  if (!pool) return { ok: false, error: '奖池不存在' };
  const balanceBefore = computeBalance(state);
  if (balanceBefore < pool.cost) {
    return { ok: false, error: `还差 ${pool.cost - balanceBefore} 积分` };
  }
  const configuredCounts = pool.prizeCounts || allocatePrizeCounts(pool.prizes, pool.size || 100);
  const counts = { ...configuredCounts, ...(pool.remainingCounts || {}) };
  const stock = poolStock(pool);
  if (stock.remaining <= 0) {
    return { ok: false, error: '这个奖池已经抽完了，重置后再抽' };
  }
  let roll = random() * stock.remaining;
  let prize = null;
  for (const candidate of pool.prizes) {
    const count = Math.max(0, Number(counts[candidate.id]) || 0);
    if (roll < count) {
      prize = candidate;
      break;
    }
    roll -= count;
  }
  prize = prize || pool.prizes.find((candidate) => counts[candidate.id] > 0);
  if (!prize) return { ok: false, error: '这个奖池已经抽完了，重置后再抽' };
  counts[prize.id] = Math.max(0, (Number(counts[prize.id]) || 0) - 1);
  pool.remainingCounts = counts;
  const draw = {
    id: uid('dr'),
    poolId: pool.id,
    poolTitle: pool.title,
    cost: pool.cost,
    prizeId: prize.id,
    prizeLabel: prize.label,
    points: prize.points,
    at: nowISO(now),
  };
  state.draws.unshift(draw);
  state.draws = state.draws.slice(0, 1000);
  state.ledger.push({
    id: uid('lg'),
    kind: 'lottery',
    amount: prize.points - pool.cost,
    at: draw.at,
    refId: draw.id,
    poolId: pool.id,
    hiddenAt: null,
    note: `${pool.title} · ${prize.label}`,
  });
  return {
    ok: true,
    draw,
    prize,
    remaining: stock.remaining - 1,
    balance: balanceBefore - pool.cost + prize.points,
  };
}

export function normalizePlan(raw, fallbackTitle = '新目标') {
  if (!raw || typeof raw !== 'object') throw new Error('AI 没有返回可用的计划');
  const inputWeeks = Array.isArray(raw.weeks) ? raw.weeks : [];
  if (inputWeeks.length === 0) throw new Error('AI 计划里没有周安排');
  let totalTasks = 0;
  const weeks = inputWeeks.slice(0, MAX_WEEKS).map((week, index) => {
    const tasks = (Array.isArray(week?.tasks) ? week.tasks : [])
      .slice(0, MAX_TASKS_PER_WEEK)
      .map((task) => {
        const title = normalizeString(task?.title, '', 200);
        if (!title) return null;
        totalTasks += 1;
        return {
          title,
          detail: normalizeString(task?.detail, '', 600),
          points: Math.round(clamp(task?.points ?? 15, 1, 200)),
          estimateMin: Math.round(clamp(task?.estimateMin ?? 60, 0, 1440)),
        };
      })
      .filter(Boolean);
    return {
      week: index + 1,
      theme: normalizeString(week?.theme, `第 ${index + 1} 周`, 120),
      outcome: normalizeString(week?.outcome, '', 300),
      tasks,
    };
  });
  if (totalTasks === 0) throw new Error('AI 计划里没有可用的任务');
  return {
    title: normalizeString(raw.title, fallbackTitle, 120) || fallbackTitle,
    summary: normalizeString(raw.summary, '', 1200),
    weeks,
  };
}

export function createProjectFromPlan(state, plan, options = {}, now = new Date()) {
  const normalized = normalizePlan(plan, options.title || options.goal || '新目标');
  const startWeek = startOfWeekISO(options.startDate || todayISO(now));
  const project = createProject(
    state,
    {
      title: options.title || normalized.title,
      goal: normalized.summary || options.goal || '',
      startDate: startWeek,
      weeks: normalized.weeks.length,
      color: options.color,
      source: options.source || 'ai',
    },
    now,
  );
  project.weeksMeta = normalized.weeks.map((week) => ({
    week: week.week,
    theme: week.theme,
    outcome: week.outcome,
  }));
  let order = 0;
  for (const week of normalized.weeks) {
    const weekStart = addWeeksISO(startWeek, week.week - 1);
    for (const task of week.tasks) {
      createTask(
        state,
        {
          projectId: project.id,
          title: task.title,
          detail: task.detail,
          weekStart,
          points: task.points,
          estimateMin: task.estimateMin,
          source: options.source || 'ai',
        },
        now,
      );
      state.tasks[state.tasks.length - 1].order = order++;
    }
  }
  return project;
}

export function createManualProject(state, input = {}, now = new Date()) {
  const title = normalizeString(input.title, '', 120);
  if (!title) throw new Error('项目名称不能为空');
  const plannedWeeks = Math.round(clamp(input.weeks ?? 8, 1, MAX_WEEKS));
  const weekPlans = Array.from({ length: plannedWeeks }, (_, index) => {
    const week = input.weekPlans?.[index] || {};
    const tasks = (Array.isArray(week.tasks) ? week.tasks : [])
      .map((task) => {
        const taskTitle = normalizeString(task?.title, '', 200);
        if (!taskTitle) return null;
        return {
          title: taskTitle,
          detail: normalizeString(task?.detail, '', 600),
          points: Math.round(clamp(task?.points ?? 15, 1, 500)),
          estimateMin: Math.round(clamp(task?.estimateMin ?? 60, 0, 1440)),
        };
      })
      .filter(Boolean);
    return {
      theme: normalizeString(week.theme, '', 120),
      tasks,
    };
  });
  const totalTasks = weekPlans.reduce((sum, week) => sum + week.tasks.length, 0);
  if (totalTasks === 0) throw new Error('至少为某一周写一件任务');

  const project = createProject(
    state,
    {
      title,
      goal: normalizeString(input.goal, '', 1200),
      startDate: input.startDate,
      weeks: plannedWeeks,
      color: input.color,
      source: 'manual',
    },
    now,
  );
  project.weeksMeta = weekPlans.map((week, index) => ({
    week: index + 1,
    theme: week.theme,
    outcome: '',
  }));

  let order = 0;
  for (let index = 0; index < weekPlans.length; index += 1) {
    const weekStart = addWeeksISO(project.startDate, index);
    for (const task of weekPlans[index].tasks) {
      const created = createTask(
        state,
        {
          projectId: project.id,
          title: task.title,
          detail: task.detail,
          weekStart,
          points: task.points,
          estimateMin: task.estimateMin,
          source: 'manual',
        },
        now,
      );
      created.order = order++;
    }
  }
  return project;
}

export function createBlankPlan({ goal = '新目标', weeks = 12, startDate = todayISO() } = {}) {
  const safeWeeks = Math.round(clamp(weeks, 1, MAX_WEEKS));
  const quarter = Math.max(1, Math.round(safeWeeks * 0.25));
  const middle = Math.max(1, Math.round(safeWeeks * 0.5));
  const threeQuarter = Math.max(1, Math.round(safeWeeks * 0.75));
  const milestones = new Map();
  const addMilestone = (week, milestone) => {
    const safeWeek = Math.round(clamp(week, 1, safeWeeks));
    if (!milestones.has(safeWeek)) milestones.set(safeWeek, milestone);
  };

  addMilestone(1, {
    theme: '校准起点',
    outcome: '知道终点长什么样，也知道自己现在在哪里。',
    tasks: [
      ['写下最终验收标准', '用一句话描述“做完是什么样”，越具体越好。', 15, 45],
      ['做一次基线测试', '记录当前水平，之后用同一种方式复测。', 15, 60],
    ],
  });
  addMilestone(quarter, {
    theme: '第一阶段复盘',
    outcome: '有一个可以被别人看到的小成果。',
    tasks: [
      ['整理第一阶段笔记', '把零散记录收成一份能复用的清单。', 15, 60],
      ['做出第一版小成果', '不追求完整，先让东西能跑起来。', 25, 120],
    ],
  });
  addMilestone(middle, {
    theme: '中期实战',
    outcome: '把学过的东西放进一个真实场景。',
    tasks: [
      ['完成一次完整演练', '从开始到结束走一遍，并记录卡点。', 25, 150],
      ['找一个人给你反馈', '请对方指出最影响体验的一个问题。', 15, 45],
    ],
  });
  addMilestone(threeQuarter, {
    theme: '补齐缺口',
    outcome: '知道最后阶段只差哪几件事。',
    tasks: [
      ['列出剩余缺口', '只保留真正影响最终成果的三件事。', 15, 45],
      ['修掉最关键的缺口', '集中一段时间处理最影响结果的部分。', 25, 120],
    ],
  });
  addMilestone(safeWeeks, {
    theme: '收尾与交付',
    outcome: '完成、交付、复盘，给这段时间一个句号。',
    tasks: [
      ['完成最终成果', '按第一周写下的验收标准逐条检查。', 30, 180],
      ['写一份复盘', '保留有效的方法，也写下下次不再犯的错。', 20, 90],
    ],
  });

  const planWeeks = [];
  for (let index = 0; index < safeWeeks; index += 1) {
    const week = index + 1;
    const milestone = milestones.get(week);
    planWeeks.push({
      week,
      theme: milestone?.theme || `留白 · 第 ${week} 周`,
      outcome: milestone?.outcome || '',
      tasks: milestone
        ? milestone.tasks.map(([title, detail, points, estimateMin]) => ({
            title,
            detail: `离线骨架：${detail}`,
            points,
            estimateMin,
          }))
        : [],
    });
  }
  return {
    title: goal,
    summary:
      '离线骨架：只在起步、四分之一、中点、四分之三和收尾周放了检查点，其余周留白。确认后请按实际情况补任务。',
    weeks: planWeeks,
  };
}

export { DAY_MS, MAX_WEEKS, MAX_TASKS_PER_WEEK, MAX_TASKS, PROJECT_COLORS, DEFAULT_SETTINGS };
