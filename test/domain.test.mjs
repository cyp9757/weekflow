import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addBonusTask,
  addHabit,
  addWeeksISO,
  completeBonusTask,
  completeHabit,
  completeTask,
  computeBalance,
  createBlankPlan,
  createDefaultState,
  createManualProject,
  createProject,
  createProjectFromPlan,
  createTask,
  deferSingleTask,
  deferTasks,
  deleteBonusTask,
  deleteHabit,
  drawPool,
  endOfWeekISO,
  habitCompletion,
  habitStats,
  habitStreak,
  habitWeek,
  isoWeekInfo,
  ledgerSummary,
  markRedemptionUsed,
  moveOverdueToWeek,
  normalizePlan,
  normalizeState,
  poolOdds,
  poolStock,
  projectTasks,
  redeemReward,
  resetPool,
  startOfWeekISO,
  uncompleteBonusTask,
  uncompleteHabit,
  uncompleteTask,
  unmarkRedemptionUsed,
  updateBonusTask,
  updateHabit,
  updatePool,
  weekStats,
} from '../src/shared/domain.js';

const NOW = new Date('2026-11-05T04:00:00.000Z');
const CURRENT = '2026-11-02';

function fixture() {
  const state = createDefaultState(NOW);
  const project = createProject(
    state,
    { title: '测试项目', startDate: CURRENT, weeks: 4 },
    NOW,
  );
  const a = createTask(state, { projectId: project.id, title: 'A', weekStart: CURRENT, points: 10 }, NOW);
  const b = createTask(
    state,
    { projectId: project.id, title: 'B', weekStart: addWeeksISO(CURRENT, 1), points: 20 },
    NOW,
  );
  const c = createTask(
    state,
    { projectId: project.id, title: 'C', weekStart: addWeeksISO(CURRENT, 2), points: 30 },
    NOW,
  );
  return { state, project, a, b, c };
}

test('date helpers use Monday-based ISO weeks', () => {
  assert.equal(startOfWeekISO('2026-11-05'), '2026-11-02');
  assert.equal(startOfWeekISO('2026-11-08'), '2026-11-02');
  assert.equal(startOfWeekISO('2026-11-09'), '2026-11-09');
  assert.equal(endOfWeekISO('2026-11-02'), '2026-11-08');
  assert.equal(addWeeksISO('2026-11-02', 12), '2027-01-25');
  assert.deepEqual(isoWeekInfo('2026-11-05'), { year: 2026, week: 45 });
});

test('complete and uncomplete keep the ledger in sync', () => {
  const { state, a } = fixture();
  assert.equal(computeBalance(state), 0);
  const done = completeTask(state, a.id, NOW);
  assert.equal(done.ok, true);
  assert.equal(computeBalance(state), 10);
  assert.equal(state.ledger.filter((entry) => entry.kind === 'task').length, 1);
  completeTask(state, a.id, NOW);
  assert.equal(state.ledger.filter((entry) => entry.kind === 'task').length, 1);

  const undone = uncompleteTask(state, a.id);
  assert.equal(undone.ok, true);
  assert.equal(computeBalance(state), 0);
  assert.equal(state.ledger.filter((entry) => entry.kind === 'task').length, 0);
});

test('uncomplete is blocked after points have been spent', () => {
  const { state, a } = fixture();
  completeTask(state, a.id, NOW);
  const reward = [...state.rewards].sort((left, right) => left.cost - right.cost)[0];
  // Force a cheap reward so the 10 points can be spent.
  reward.cost = 10;
  const redemption = redeemReward(state, reward.id, NOW);
  assert.equal(redemption.ok, true);
  assert.equal(computeBalance(state), 0);
  const result = uncompleteTask(state, a.id);
  assert.equal(result.ok, false);
  assert.match(result.error, /花掉/);
});

test('shift defer moves every unfinished project task and preserves sequence', () => {
  const { state, project, a, b, c } = fixture();
  completeTask(state, a.id, NOW);
  const result = deferTasks(state, { taskId: b.id, fromWeek: CURRENT, mode: 'shift' }, NOW);
  assert.equal(result.ok, true);
  assert.equal(result.moved, 2);
  assert.equal(state.tasks.find((task) => task.id === a.id).weekStart, CURRENT);
  assert.equal(state.tasks.find((task) => task.id === b.id).weekStart, addWeeksISO(CURRENT, 2));
  assert.equal(state.tasks.find((task) => task.id === c.id).weekStart, addWeeksISO(CURRENT, 3));
  assert.equal(state.projects.find((item) => item.id === project.id).shiftCount, 1);
});

test('stack defer moves backlog into next week and marks carry-over', () => {
  const { state, a, b, c } = fixture();
  const overdue = createTask(
    state,
    { projectId: a.projectId, title: 'Overdue', weekStart: addWeeksISO(CURRENT, -1), points: 5 },
    NOW,
  );
  const result = deferTasks(state, { taskId: b.id, fromWeek: CURRENT, mode: 'stack' }, NOW);
  assert.equal(result.ok, true);
  assert.equal(result.moved, 2);
  assert.equal(result.targetWeek, addWeeksISO(CURRENT, 1));
  for (const id of [a.id, overdue.id]) {
    const task = state.tasks.find((item) => item.id === id);
    assert.equal(task.weekStart, addWeeksISO(CURRENT, 1));
    assert.equal(task.carryOver, true);
  }
  const nextWeekOwn = state.tasks.find((item) => item.id === b.id);
  assert.equal(nextWeekOwn.weekStart, addWeeksISO(CURRENT, 1));
  assert.equal(nextWeekOwn.carryOver, false);
  assert.equal(state.tasks.find((task) => task.id === c.id).weekStart, addWeeksISO(CURRENT, 2));
  assert.equal(result.nextWeekLoad, 3);
});

test('move overdue to current week does not touch future tasks', () => {
  const { state, a, b } = fixture();
  const old = createTask(
    state,
    { projectId: a.projectId, title: '旧的', weekStart: addWeeksISO(CURRENT, -2), points: 5 },
    NOW,
  );
  const result = moveOverdueToWeek(state, CURRENT, {}, NOW);
  assert.equal(result.moved, 1);
  assert.equal(state.tasks.find((task) => task.id === old.id).weekStart, CURRENT);
  assert.equal(state.tasks.find((task) => task.id === b.id).weekStart, addWeeksISO(CURRENT, 1));
});

test('pool odds and draw ledger are consistent', () => {
  const state = createDefaultState(NOW);
  state.ledger.push({
    id: 'lg_seed',
    kind: 'adjust',
    amount: 200,
    at: NOW.toISOString(),
    refId: '',
    note: '测试充值',
  });
  const pool = state.pools[0];
  const odds = poolOdds(pool);
  assert.ok(Math.abs(odds.rtp - 0.9014) < 0.01);
  const prize = pool.prizes.find((item) => item.points === 8888);
  const result = drawPool(state, pool.id, NOW, () => 0.99999);
  assert.equal(result.ok, true);
  assert.equal(result.prize.id, prize.id);
  assert.equal(result.draw.points, 8888);
  assert.equal(computeBalance(state), 200 - pool.cost + 8888);
  const summary = ledgerSummary(state);
  assert.equal(summary.prizePoints, 8888);
  assert.equal(summary.spent, pool.cost);
});

test('finite pool stock drains, rejects empty draws, and resets only pool ledger', () => {
  const state = createDefaultState(NOW);
  state.ledger.push({
    id: 'lg_seed',
    kind: 'adjust',
    amount: 20000,
    at: '2026-11-05T03:00:00.000Z',
    refId: 'seed',
    note: 'seed',
  });
  const pool = state.pools[0];
  const stock = poolStock(pool);
  assert.ok(stock.total >= 6);
  assert.equal(stock.remaining, stock.total);
  let draws = 0;
  while (poolStock(pool).remaining > 0 && draws < 200) {
    const result = drawPool(state, pool.id, NOW, () => 0);
    assert.equal(result.ok, true);
    draws += 1;
  }
  assert.equal(poolStock(pool).remaining, 0);
  const empty = drawPool(state, pool.id, NOW, () => 0);
  assert.equal(empty.ok, false);
  assert.match(empty.error, /抽完/);
  const hiddenBefore = state.ledger.filter((entry) => entry.kind === 'lottery' && entry.hiddenAt).length;
  resetPool(state, pool.id, NOW);
  assert.equal(poolStock(pool).remaining, stock.total);
  assert.ok(state.ledger.filter((entry) => entry.kind === 'lottery' && entry.hiddenAt).length > hiddenBefore);
  assert.ok(state.ledger.some((entry) => entry.kind === 'adjust'));
});

test('drawing without enough points is rejected', () => {
  const state = createDefaultState(NOW);
  const result = drawPool(state, state.pools[0].id, NOW);
  assert.equal(result.ok, false);
});

test('plan normalization and project creation map weeks to Mondays', () => {
  const state = createDefaultState(NOW);
  const plan = normalizePlan({
    title: 'C++',
    summary: '路径',
    weeks: [
      {
        week: 1,
        theme: '起步',
        tasks: [
          { title: '装环境', detail: '装好并跑通', points: 10, estimateMin: 60 },
          { title: '写练习', points: 15, estimateMin: 90 },
        ],
      },
      { week: 2, theme: '推进', tasks: [{ title: '小项目', points: 25 }] },
    ],
  });
  assert.equal(plan.weeks.length, 2);
  const project = createProjectFromPlan(state, plan, { startDate: '2026-11-05' }, NOW);
  assert.equal(project.startDate, CURRENT);
  assert.equal(projectTasks(state, project.id).length, 3);
  assert.equal(state.tasks[0].weekStart, CURRENT);
  assert.equal(state.tasks[2].weekStart, addWeeksISO(CURRENT, 1));
  assert.equal(project.weeksMeta[1].theme, '推进');
});

test('manual project creates tasks only in the weeks they were written', () => {
  const state = createDefaultState(NOW);
  const project = createManualProject(
    state,
    {
      title: '手排 8 周',
      goal: '每周只做一点点',
      startDate: '2026-11-05',
      weeks: 8,
      weekPlans: [
        { theme: '起步', tasks: [{ title: '写验收标准', points: 10 }, { title: '做基线', points: 15 }] },
        { theme: '', tasks: [] },
        { theme: '推进', tasks: [{ title: '做出第一版', points: 25 }] },
        ...Array.from({ length: 5 }, () => ({ theme: '', tasks: [] })),
      ],
    },
    NOW,
  );
  const tasks = projectTasks(state, project.id);
  assert.equal(project.weeksMeta.length, 8);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].weekStart, CURRENT);
  assert.equal(tasks[2].weekStart, addWeeksISO(CURRENT, 2));
  assert.equal(tasks[0].points, 10);
  assert.equal(project.source, 'manual');
});

test('manual project refuses an empty plan', () => {
  const state = createDefaultState(NOW);
  assert.throws(
    () =>
      createManualProject(
        state,
        { title: '空计划', weeks: 4, weekPlans: [] },
        NOW,
      ),
    /至少/,
  );
});

test('offline blank plan only places milestone checkpoints', () => {
  const plan = createBlankPlan({ goal: '三个月目标', weeks: 12 });
  assert.equal(plan.weeks.length, 12);
  assert.equal(plan.weeks.filter((week) => week.tasks.length > 0).length, 5);
  assert.equal(plan.weeks.filter((week) => week.tasks.length === 0).length, 7);
  assert.equal(plan.weeks[0].tasks.length, 2);
  assert.ok(plan.weeks[11].tasks.some((task) => task.title.includes('最终')));
});

test('daily habits complete once per day and feed the ledger', () => {
  const state = createDefaultState(NOW);
  const habit = addHabit(state, { title: '锻炼', points: 10, icon: '🏃' }, NOW);
  assert.equal(habit.points, 10);

  const first = completeHabit(state, habit.id, '2026-11-05', NOW);
  assert.equal(first.ok, true);
  assert.equal(first.points, 10);
  assert.equal(computeBalance(state), 10);
  assert.equal(state.ledger.filter((entry) => entry.kind === 'habit').length, 1);

  const duplicate = completeHabit(state, habit.id, '2026-11-05', NOW);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /已经完成/);

  const stats = habitStats(state, '2026-11-05');
  assert.equal(stats.total, 1);
  assert.equal(stats.done, 1);
  assert.equal(stats.points, 10);
  assert.equal(habitStreak(state, habit.id, '2026-11-05'), 1);
  assert.equal(habitWeek(state, habit.id, '2026-11-05').at(-1).done, true);

  const undone = uncompleteHabit(state, habit.id, '2026-11-05');
  assert.equal(undone.ok, true);
  assert.equal(computeBalance(state), 0);
  assert.equal(state.ledger.length, 0);
});

test('habit streak survives a missed today but counts consecutive past days', () => {
  const state = createDefaultState(NOW);
  const habit = addHabit(state, { title: '阅读', points: 5 }, NOW);
  completeHabit(state, habit.id, '2026-11-03', NOW);
  completeHabit(state, habit.id, '2026-11-04', NOW);
  completeHabit(state, habit.id, '2026-11-05', NOW);
  assert.equal(habitStreak(state, habit.id, '2026-11-05'), 3);
  uncompleteHabit(state, habit.id, '2026-11-05');
  assert.equal(habitStreak(state, habit.id, '2026-11-05'), 2);
  assert.equal(habitStats(state, '2026-11-05').done, 0);
});

test('editing a habit does not rewrite past completion points', () => {
  const state = createDefaultState(NOW);
  const habit = addHabit(state, { title: '拉伸', points: 5 }, NOW);
  completeHabit(state, habit.id, '2026-11-05', NOW);
  updateHabit(state, habit.id, { points: 25, title: '认真拉伸' });
  const completion = habitCompletion(state, habit.id, '2026-11-05');
  assert.equal(completion.points, 5);
  assert.equal(computeBalance(state), 5);
  assert.equal(habit.title, '认真拉伸');
});

test('deleting a habit removes its completion ledger and history', () => {
  const state = createDefaultState(NOW);
  const habit = addHabit(state, { title: '喝水', points: 5 }, NOW);
  completeHabit(state, habit.id, '2026-11-05', NOW);
  assert.equal(deleteHabit(state, habit.id), true);
  assert.equal(state.habits.length, 0);
  assert.equal(state.habitCompletions.length, 0);
  assert.equal(computeBalance(state), 0);
});

test('normalizeState keeps valid habits and theme settings', () => {
  const state = createDefaultState(NOW);
  const habit = addHabit(state, { title: '散步', points: 10 }, NOW);
  completeHabit(state, habit.id, '2026-11-05', NOW);
  state.settings.theme = 'paper';
  const normalized = normalizeState(state, NOW);
  assert.equal(normalized.habits.length, 1);
  assert.equal(normalized.habitCompletions.length, 1);
  assert.equal(normalized.settings.theme, 'paper');
  assert.equal(computeBalance(normalized), 10);
});

test('normalizeState repairs duplicates and task ledger entries', () => {
  const { state, a } = fixture();
  completeTask(state, a.id, NOW);
  state.ledger.push({ id: 'dup', kind: 'task', amount: 999, at: NOW.toISOString(), refId: a.id });
  state.tasks.push({ ...a, id: 'broken', weekStart: 'nope' });
  const normalized = normalizeState(state, NOW);
  assert.equal(normalized.tasks.filter((task) => task.id === 'broken').length, 0);
  assert.equal(normalized.ledger.filter((entry) => entry.refId === a.id).length, 1);
  assert.equal(computeBalance(normalized), 10);
});

test('ledger summary reports gross spending rather than net lottery result', () => {
  const state = createDefaultState(NOW);
  const { a } = fixture();
  state.tasks.push(a);
  completeTask(state, a.id, NOW);
  state.ledger.push({
    id: 'lg_bonus',
    kind: 'adjust',
    amount: 200,
    at: NOW.toISOString(),
    refId: '',
    note: '测试充值',
  });
  const pool = state.pools[0];
  drawPool(state, pool.id, NOW, () => 0.99999);
  const summary = ledgerSummary(state);
  assert.equal(summary.taskPoints, 10);
  assert.equal(summary.prizePoints, 8888);
  assert.equal(summary.spent, pool.cost);
  assert.equal(summary.balance, 210 - pool.cost + 8888);
});

test('updatePool edits fields and keeps prize ids', () => {
  const state = createDefaultState(NOW);
  const pool = state.pools[0];
  const firstPrizeId = pool.prizes[0].id;
  const updated = updatePool(state, pool.id, {
    title: '改过的奖池',
    cost: 33,
    subtitle: '只改说明',
    prizes: [
      { label: '空', weight: 80, points: 0 },
      { label: '小奖', weight: 20, points: 50 },
    ],
  });
  assert.equal(updated.title, '改过的奖池');
  assert.equal(updated.cost, 33);
  assert.equal(updated.prizes.length, 2);
  assert.equal(updated.prizes[0].id, firstPrizeId);
  assert.equal(poolOdds(updated).rtp, (50 * 0.2) / 33);
});

test('bonus tasks award points without a week and undo cleanly', () => {
  const state = createDefaultState(NOW);
  const bonus = addBonusTask(state, { title: '整理桌面', points: 200 }, NOW);
  assert.equal(state.tasks.length, 0);
  assert.equal(state.bonusTasks.length, 1);

  const completed = completeBonusTask(state, bonus.id, NOW);
  assert.equal(completed.ok, true);
  assert.equal(computeBalance(state), 200);
  assert.equal(ledgerSummary(state).bonusPoints, 200);
  assert.equal(state.ledger.find((entry) => entry.kind === 'bonus')?.amount, 200);

  const undone = uncompleteBonusTask(state, bonus.id);
  assert.equal(undone.ok, true);
  assert.equal(computeBalance(state), 0);
  assert.equal(ledgerSummary(state).bonusPoints, 0);
});

test('completed bonus points are locked and cannot be deleted after spending', () => {
  const state = createDefaultState(NOW);
  const bonus = addBonusTask(state, { title: '写复盘', points: 200 }, NOW);
  completeBonusTask(state, bonus.id, NOW);
  assert.throws(() => updateBonusTask(state, bonus.id, { points: 300 }), /不能再改/);

  const reward = [...state.rewards].sort((left, right) => left.cost - right.cost)[0];
  reward.cost = 10;
  assert.equal(redeemReward(state, reward.id, NOW).ok, true);
  assert.throws(() => deleteBonusTask(state, bonus.id), /已经花掉/);
  assert.equal(uncompleteBonusTask(state, bonus.id).ok, false);
});

test('weekend and holiday completions award double points', () => {
  const { state, a } = fixture();
  const saturday = new Date('2026-11-07T12:00:00+08:00');
  const weekend = completeTask(state, a.id, saturday);
  assert.equal(weekend.ok, true);
  assert.equal(weekend.points, 20);
  assert.equal(state.tasks.find((task) => task.id === a.id).awardedPoints, 20);
  assert.equal(computeBalance(state), 20);
  assert.equal(weekStats(state, CURRENT).points, 20);
  assert.equal(uncompleteTask(state, a.id).ok, true);

  const holidayState = createDefaultState(NOW);
  holidayState.settings.holidayDates = ['2026-11-09'];
  const holidayTask = createTask(
    holidayState,
    { title: '节假日任务', weekStart: CURRENT, points: 30 },
    NOW,
  );
  const holiday = completeTask(holidayState, holidayTask.id, new Date('2026-11-09T12:00:00+08:00'));
  assert.equal(holiday.ok, true);
  assert.equal(holiday.points, 60);
});

test('redemption records can be marked used and reverted', () => {
  const state = createDefaultState(NOW);
  const reward = [...state.rewards].sort((left, right) => left.cost - right.cost)[0];
  reward.cost = 10;
  state.ledger.push({
    id: 'lg_test_points',
    kind: 'adjust',
    amount: 20,
    at: NOW.toISOString(),
    refId: '',
    note: '测试积分',
  });
  const redeemed = redeemReward(state, reward.id, NOW);
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.redemption.usedAt, null);

  const marked = markRedemptionUsed(state, redeemed.redemption.id, NOW);
  assert.equal(marked.ok, true);
  assert.ok(marked.redemption.usedAt);
  assert.equal(markRedemptionUsed(state, redeemed.redemption.id, NOW).redemption.usedAt, marked.redemption.usedAt);

  const reverted = unmarkRedemptionUsed(state, redeemed.redemption.id);
  assert.equal(reverted.ok, true);
  assert.equal(reverted.redemption.usedAt, null);

  marked.redemption.usedAt = NOW.toISOString();
  const normalized = normalizeState(state, NOW);
  assert.ok(normalized.redemptions[0].usedAt);
});

test('deferSingleTask moves only the selected task and leaves the project flow alone', () => {
  const { state, project, a, b, c } = fixture();
  const before = Object.fromEntries(state.tasks.map((task) => [task.id, task.weekStart]));
  const result = deferSingleTask(
    state,
    { taskId: a.id, fromWeek: CURRENT, mode: 'shift' },
    NOW,
  );
  assert.equal(result.ok, true);
  assert.equal(result.moved, 1);
  assert.equal(state.tasks.find((task) => task.id === a.id).weekStart, addWeeksISO(CURRENT, 1));
  assert.equal(state.tasks.find((task) => task.id === b.id).weekStart, before[b.id]);
  assert.equal(state.tasks.find((task) => task.id === c.id).weekStart, before[c.id]);
  assert.equal(project.shiftCount, 0);

  const stacked = deferSingleTask(
    state,
    { taskId: b.id, fromWeek: CURRENT, mode: 'stack' },
    NOW,
  );
  assert.equal(stacked.ok, true);
  assert.equal(state.tasks.find((task) => task.id === b.id).weekStart, addWeeksISO(CURRENT, 2));
  assert.equal(state.tasks.find((task) => task.id === b.id).carryOver, true);
  assert.equal(state.tasks.find((task) => task.id === c.id).weekStart, before[c.id]);
});
