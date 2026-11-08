import {
  activeBonusTasks,
  activeHabits,
  compareWeeks,
  doneBonusTasks,
  formatFullDateCN,
  habitCompletion,
  isDoublePointsDate,
  habitStats,
  habitStreak,
  habitWeek,
  overdueTasks,
  tasksForWeek,
  todayISO,
} from '../../shared/domain.js';
import { icon } from '../lib/icons.js';
import {
  dateLabel,
  escapeHtml,
  estimateLabel,
  relativeTaskWeek,
  weekLabel,
} from '../lib/format.js';

function pointsBadge(points) {
  return `<span class="points-chip">+${points}</span>`;
}

function panelGrip(section, label) {
  return `<button class="panel-grip" draggable="true" data-drag-section="${section}" title="拖动调整${label}的位置" aria-label="拖动调整${label}的位置">${icon('grip', 14)}</button>`;
}

function renderHabitRow(ctx, habit, date) {
  const completion = habitCompletion(ctx.state, habit.id, date);
  const done = Boolean(completion);
  const streak = habitStreak(ctx.state, habit.id, date);
  const days = habitWeek(ctx.state, habit.id, date);
  const justDone = ctx.ui.justHabit === habit.id;
  return `
    <article class="habit ${done ? 'done' : ''} ${justDone ? 'just-done' : ''}" data-habit-id="${habit.id}">
      <button class="check" data-action="toggle-habit" data-id="${habit.id}" aria-label="${done ? '撤销今日完成' : '完成今日任务'}：${escapeHtml(habit.title)}" title="${done ? '撤销今日完成' : '完成今日任务'}">
        ${icon('check', 13)}
      </button>
      <div class="habit-body" data-action="habit-actions" data-id="${habit.id}" role="button" tabindex="0" aria-label="打开每日任务操作：${escapeHtml(habit.title)}">
        <div class="habit-title">${habit.icon ? `<span class="habit-emoji">${escapeHtml(habit.icon)}</span>` : ''}${escapeHtml(habit.title)}</div>
        <div class="habit-meta">
          <span>每日</span>
          ${streak ? `<span class="habit-streak">连续 ${streak} 天</span>` : '<span>今天开始</span>'}
          <span class="habit-dots" aria-hidden="true">
            ${days
              .map(
                (day) =>
                  `<i class="habit-dot ${day.done ? 'done' : ''} ${day.today ? 'today' : ''}" title="${day.date}"></i>`,
              )
              .join('')}
          </span>
        </div>
        <div class="habit-foot">
          ${pointsBadge(completion?.points ?? habit.points)}
          <span>每天一次</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="icon-btn small" data-action="edit-habit" data-id="${habit.id}" title="编辑每日任务" aria-label="编辑每日任务：${escapeHtml(habit.title)}">${icon('edit', 12)}</button>
        <button class="icon-btn small row-delete" data-action="delete-habit" data-id="${habit.id}" title="删除每日任务" aria-label="删除每日任务：${escapeHtml(habit.title)}">${icon('trash', 12)}</button>
      </div>
    </article>
  `;
}

function renderDaily(ctx) {
  const today = todayISO();
  const habits = activeHabits(ctx.state);
  const stats = habitStats(ctx.state, today);
  if (!habits.length) {
    return `
      <section class="daily-empty" data-week-section="daily">
        <div class="daily-empty-head">
          ${panelGrip('daily', '每日')}
          <span class="daily-kicker">DAILY · 每日</span>
          <span class="daily-empty-copy">还没有每日任务。下面只是建议，点一行才会真正添加。</span>
        </div>
        <div class="daily-suggestions">
          <button class="habit-suggestion" data-action="quick-habit" data-title="锻炼身体" data-points="10" data-icon="🏃">
            <span><span class="suggestion-emoji">🏃</span> 锻炼</span>
            <span class="suggestion-points">+ 添加 · 每天 10 分</span>
          </button>
          <button class="habit-suggestion" data-action="quick-habit" data-title="读一会儿书" data-points="10" data-icon="📖">
            <span><span class="suggestion-emoji">📖</span> 阅读</span>
            <span class="suggestion-points">+ 添加 · 每天 10 分</span>
          </button>
          <button class="habit-suggestion" data-action="quick-habit" data-title="拉伸" data-points="5" data-icon="🧘">
            <span><span class="suggestion-emoji">🧘</span> 拉伸</span>
            <span class="suggestion-points">+ 添加 · 每天 5 分</span>
          </button>
          <button class="habit-suggestion add" data-action="new-habit">
            <span>+ 自定义每日任务</span>
            <span class="suggestion-points">自己设积分</span>
          </button>
        </div>
        <div class="daily-empty-hint">添加之后，每行右上角会出现铅笔（编辑）和垃圾桶（删除）。</div>
        <button class="text-button daily-manage" data-action="manage-habits">管理每日任务</button>
      </section>
    `;
  }
  return `
    <section class="daily-card" data-week-section="daily">
      <div class="daily-head">
        ${panelGrip('daily', '每日')}
        <div>
          <div class="daily-kicker">DAILY · 每日</div>
          <div class="daily-title">今日 <span class="daily-date">${formatFullDateCN(today, false)}</span></div>
        </div>
        <div class="daily-progress">
          <strong>${stats.done}/${stats.total}</strong>
          <span>${stats.points ? `+${stats.points} 分` : '还没开始'}</span>
        </div>
        <button class="icon-btn small" data-action="new-habit" aria-label="添加每日任务">${icon('plus', 14)}</button>
      </div>
      <div class="daily-list habit-list">${habits.map((habit) => renderHabitRow(ctx, habit, today)).join('')}</div>
      <div class="daily-foot">
        ${stats.remaining === 0 ? '<span class="daily-done-note">今天都做到了。</span>' : `<span>还有 ${stats.remaining} 件，做完就加分。</span>`}
        <span class="spacer"></span>
        <button class="text-button" data-action="manage-habits">管理</button>
        <span>每天重置</span>
      </div>
    </section>
  `;
}

function renderBonusRow(ctx, bonus) {
  const done = bonus.status === 'done';
  return `
    <article class="bonus ${done ? 'done' : ''}" data-bonus-id="${bonus.id}">
      <button class="check" data-action="toggle-bonus" data-id="${bonus.id}" aria-label="${done ? '撤销完成' : '完成待办'}：${escapeHtml(bonus.title)}" title="${done ? '撤销完成' : '完成待办'}">
        ${icon('check', 13)}
      </button>
      <div class="bonus-body">
        <div class="bonus-title">${bonus.icon ? `<span class="bonus-emoji">${escapeHtml(bonus.icon)}</span>` : ''}${escapeHtml(bonus.title)}</div>
        ${bonus.detail ? `<div class="bonus-detail">${escapeHtml(bonus.detail)}</div>` : ''}
        <div class="bonus-meta">
          <span class="bonus-tag">${done ? '已完成' : '无截止'}</span>
          ${pointsBadge(done ? (bonus.awardedPoints ?? bonus.points) : bonus.points)}
        </div>
      </div>
      <div class="row-actions">
        <button class="icon-btn small" data-action="edit-bonus" data-id="${bonus.id}" title="编辑待办" aria-label="编辑待办：${escapeHtml(bonus.title)}">${icon('edit', 12)}</button>
        <button class="icon-btn small row-delete" data-action="delete-bonus" data-id="${bonus.id}" title="删除待办" aria-label="删除待办：${escapeHtml(bonus.title)}">${icon('trash', 12)}</button>
      </div>
    </article>
  `;
}

function renderBonus(ctx) {
  const active = activeBonusTasks(ctx.state);
  const done = doneBonusTasks(ctx.state);
  const pendingPoints = active.reduce((sum, bonus) => sum + bonus.points, 0);
  return `
    <section class="bonus-section" data-week-section="bonus">
      <div class="bonus-head">
        ${panelGrip('bonus', '待办')}
        <div>
          <div class="daily-kicker">TODO · 待办</div>
          <div class="bonus-title-main">待办 <span class="bonus-count">${active.length}</span></div>
        </div>
        <div class="bonus-head-side">
          ${active.length ? `<span class="bonus-pending">待拿 +${pendingPoints}</span>` : ''}
          <button class="icon-btn small" data-action="new-bonus" aria-label="添加待办" title="添加待办">${icon('plus', 14)}</button>
        </div>
      </div>
      <div class="bonus-sub">高积分，不排周次，也不催你。想做了再打勾。</div>
      ${
        active.length
          ? `<div class="bonus-list">${active.map((bonus) => renderBonusRow(ctx, bonus)).join('')}</div>`
          : `<button class="bonus-empty" data-action="new-bonus">
              <span class="bonus-empty-icon">${icon('sparkles', 16)}</span>
              <span><b>放一件“早晚要做”的事</b><small>自己定积分，完成时一次入账。</small></span>
              <span class="bonus-empty-plus">+</span>
            </button>`
      }
      ${
        done.length
          ? `<div class="bonus-done-head">已完成 ${done.length}</div>
             <div class="bonus-list done">${done.map((bonus) => renderBonusRow(ctx, bonus)).join('')}</div>`
          : ''
      }
    </section>
  `;
}

export function renderTaskRow(ctx, task, { showProject = false } = {}) {
  const { state, ui } = ctx;
  const project = task.projectId ? state.projects.find((item) => item.id === task.projectId) : null;
  const done = task.status === 'done';
  const justDone = ui.justDone === task.id;
  const meta = [];
  if (task.seriesId) meta.push('<span class="recurring-badge">每周</span>');
  if (task.carryOver && !done) meta.push('<span class="carry-badge">补</span>');
  if (task.estimateMin) meta.push(`<span>${icon('clock', 11)}${estimateLabel(task.estimateMin)}</span>`);
  if (showProject && project) meta.push(`<span>${escapeHtml(project.title)}</span>`);
  if (!project && !showProject) meta.push('<span>单件小事</span>');

  return `
    <article class="task ${done ? 'done' : ''} ${justDone ? 'just-done' : ''}" data-task-id="${task.id}">
      <button class="check" data-action="toggle-task" data-id="${task.id}" aria-label="${done ? '撤销完成' : '标记完成'}：${escapeHtml(task.title)}" title="${done ? '撤销完成' : '标记完成'}">
        ${icon('check', 13)}
      </button>
      <div class="task-body" data-action="task-actions" data-id="${task.id}" role="button" tabindex="0" aria-label="打开任务操作：${escapeHtml(task.title)}">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.detail ? `<div class="task-detail">${escapeHtml(task.detail)}</div>` : ''}
        <div class="task-meta">
          ${meta.join('')}
          ${pointsBadge(done ? (task.awardedPoints ?? task.points) : task.points)}
        </div>
      </div>
      <div class="row-actions">
        <button class="icon-btn small" data-action="edit-task" data-id="${task.id}" title="编辑任务" aria-label="编辑任务：${escapeHtml(task.title)}">${icon('edit', 12)}</button>
        <button class="icon-btn small row-delete" data-action="delete-task" data-id="${task.id}" title="删除任务" aria-label="删除任务：${escapeHtml(task.title)}">${icon('trash', 12)}</button>
      </div>
    </article>
  `;
}

function groupTasks(ctx, tasks) {
  const open = tasks.filter((task) => task.status !== 'done');
  const groups = new Map();
  for (const task of open) {
    const key = task.projectId || '__solo';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  return [...groups.entries()].map(([projectId, items]) => {
    const project =
      projectId === '__solo' ? null : ctx.state.projects.find((item) => item.id === projectId);
    const weekTasks = tasksForWeek(ctx.state, ctx.selectedWeek).filter((task) =>
      project ? task.projectId === project.id : !task.projectId,
    );
    const weekDone = weekTasks.filter((task) => task.status === 'done').length;
    return `
      <section class="task-group" style="--project-color:${project?.color || 'var(--accent)'}">
        <div class="group-head">
          <span class="group-dot"></span>
          <span class="group-title">${escapeHtml(project?.title || '单件小事')}</span>
          <span class="group-count">${weekDone}/${weekTasks.length}</span>
          ${project?.shiftCount ? `<span class="shift-note">顺延 ${project.shiftCount} 次</span>` : ''}
          <span class="group-spacer"></span>
          ${
            project
              ? `<button class="group-more" data-action="project-actions" data-id="${project.id}" aria-label="项目操作">${icon('more', 15)}</button>`
              : ''
          }
        </div>
        <div class="task-list">${items.map((task) => renderTaskRow(ctx, task)).join('')}</div>
      </section>
    `;
  });
}

function renderOverdue(ctx) {
  const { state } = ctx;
  if (ctx.ui.rollover) return '';
  const overdue = overdueTasks(state, ctx.selectedWeek);
  if (!overdue.length) return '';
  const visible = overdue.slice(0, 4);
  return `
    <section class="overdue-card">
      <div class="overdue-head">${icon('clock', 13)} 还欠着的 <span class="section-rule"></span> ${overdue.length}</div>
      <div class="overdue-sub">它们排在更早的周里。可以补进本周，也可以打开任务选择顺延。</div>
      ${visible
        .map(
          (task) => `
          <button class="overdue-task" data-action="task-actions" data-id="${task.id}">
            <span class="dot"></span>
            <span>${escapeHtml(task.title)}</span>
            <span class="when">${relativeTaskWeek(task.weekStart, ctx.currentWeek)}</span>
          </button>`,
        )
        .join('')}
      ${overdue.length > visible.length ? `<div class="hint">还有 ${overdue.length - visible.length} 件，点开对应项目可一起处理。</div>` : ''}
      <div class="overdue-actions">
        <button class="btn btn-secondary btn-sm" data-action="catch-up-overdue">${icon('calendar', 12)} 全部并入本周</button>
      </div>
    </section>
  `;
}

function renderRollover(ctx) {
  if (!ctx.ui.rollover || ctx.ui.rollover.count <= 0) return '';
  return `
    <section class="overdue-card" style="border-color:color-mix(in srgb, var(--accent) 20%, transparent)">
      <div class="overdue-head" style="color:var(--accent)">${icon('sparkles', 13)} 新的一周 <span class="section-rule"></span></div>
      <div class="overdue-sub">上周还有 ${ctx.ui.rollover.count} 件没完成。要把它们并进这一周吗？</div>
      <div class="overdue-actions">
        <button class="btn btn-primary btn-sm" data-action="rollover-catchup">并入本周</button>
        <button class="btn btn-ghost btn-sm" data-action="dismiss-rollover">先留在上周</button>
      </div>
    </section>
  `;
}

function renderDone(ctx, doneTasks) {
  if (!doneTasks.length) return '';
  return `
    <div class="section">
      <button class="done-toggle ${ctx.ui.showDone ? 'open' : ''}" data-action="toggle-done">
        ${icon('check', 12)} 已完成 ${doneTasks.length}
        <span class="spacer"></span>
        ${icon(ctx.ui.showDone ? 'chevronUp' : 'chevronDown', 13)}
      </button>
      ${
        ctx.ui.showDone
          ? `<div class="done-list task-list">${doneTasks.map((task) => renderTaskRow(ctx, task, { showProject: true })).join('')}</div>`
          : ''
      }
    </div>
  `;
}

function renderEmpty(ctx) {
  const hasProjects = ctx.state.projects.length > 0;
  const hasFuture = ctx.state.tasks.some(
    (task) => task.status !== 'done' && compareWeeks(task.weekStart, ctx.currentWeek) > 0,
  );
  if (hasFuture) {
    return `
      <div class="empty">
        <div class="empty-orbit">${icon('calendar', 21)}</div>
        <div class="empty-title">这一周先留白</div>
        <div class="empty-copy">后面的周里已经有安排。留白也是一种节奏，或者现在塞进一件小事。</div>
        <div class="empty-actions">
          <button class="btn btn-secondary btn-sm" data-action="new-task">${icon('plus', 13)} 加一件小事</button>
          <button class="btn btn-ghost btn-sm" data-action="go-plans">看蓝图</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="empty">
      <div class="empty-orbit">${icon('wand', 21)}</div>
      <div class="empty-title">把一个大目标，折成这一周</div>
      <div class="empty-copy">告诉 AI 你想在几个月内完成什么，它会拆成每周任务；也可以自己一周一周地排。</div>
      <div class="empty-actions">
        <button class="btn btn-primary btn-sm" data-action="open-plan-wizard">${icon('sparkles', 13)} AI 规划</button>
        <button class="btn btn-secondary btn-sm" data-action="open-manual-plan">${icon('edit', 13)} 手动规划</button>
      </div>
      <div class="how-steps">
        <div class="how-step"><b>01</b><span>拆成每周<br />能完成的小步</span></div>
        <div class="how-step"><b>02</b><span>做完打勾<br />攒下积分</span></div>
        <div class="how-step"><b>03</b><span>兑换奖励<br />或试一次奖池</span></div>
      </div>
      ${hasProjects ? '<div class="hint">你已经有项目了，这一周暂时没有任务。</div>' : ''}
    </div>
  `;
}

function renderWeekly(ctx) {
  const tasks = tasksForWeek(ctx.state, ctx.selectedWeek);
  const doneTasks = tasks.filter((task) => task.status === 'done');
  const openTasks = tasks.filter((task) => task.status !== 'done');
  const groups = groupTasks(ctx, tasks);
  const hasAny = tasks.length > 0;
  const pendingPoints = openTasks.reduce((sum, task) => sum + task.points, 0);

  return `
    <section class="week-panel" data-week-section="week">
      <div class="week-panel-head">
        ${panelGrip('week', '每周')}
        <div>
          <div class="daily-kicker">WEEK · 每周</div>
          <div class="week-panel-title">每周 <span class="bonus-count">${openTasks.length}</span></div>
        </div>
        <div class="week-panel-side">
          ${hasAny ? `<span class="bonus-pending">待拿 +${pendingPoints}</span>` : ''}
          <button class="icon-btn small" data-action="new-task" aria-label="添加每周任务" title="添加每周任务">${icon('plus', 14)}</button>
        </div>
      </div>
      <div class="week-panel-sub">按项目分组；没做完可以顺延或压到下周。</div>
      <div class="week-panel-body">
        ${ctx.selectedWeek === ctx.currentWeek ? renderRollover(ctx) : ''}
        ${renderOverdue(ctx)}
        ${hasAny ? groups.join('') : ''}
        ${hasAny && openTasks.length === 0 ? `
          <div class="empty" style="margin-top:6px">
            <div class="empty-orbit">${icon('check', 22)}</div>
            <div class="empty-title">这一周，收好了</div>
            <div class="empty-copy">${doneTasks.length} 件都完成了。去兑换一个小奖励，或者把下一周往前挪一点。</div>
            <div class="empty-actions">
              <button class="btn btn-secondary btn-sm" data-action="go-rewards">${icon('gift', 13)} 去奖励页</button>
            </div>
          </div>
        ` : ''}
        ${!hasAny ? renderEmpty(ctx) : ''}
        ${renderDone(ctx, doneTasks)}
        ${hasAny ? `
          <div class="section" style="margin-top:20px">
            <button class="btn btn-secondary btn-block" data-action="new-task">${icon('plus', 14)} 给这一周加一件事</button>
          </div>
        ` : ''}
        <div class="hint" style="text-align:center;margin-top:16px">${weekLabel(ctx.selectedWeek, ctx.currentWeek)} · ${dateLabel(ctx.selectedWeek)} 起</div>
      </div>
    </section>
  `;
}

export function renderWeek(ctx) {
  const order = ctx.state.settings.weekOrder || ['daily', 'week', 'bonus'];
  const sections = {
    daily: () => renderDaily(ctx),
    week: () => renderWeekly(ctx),
    bonus: () => renderBonus(ctx),
  };
  const doubleDay = isDoublePointsDate(ctx.state.settings, todayISO());
  return `
    <div class="page">
      ${doubleDay ? `<div class="double-day-hint">${icon('sparkles', 12)} 今天是双倍日 · 完成任务积分 ×2</div>` : ''}
      ${order.map((id) => sections[id]?.() || '').join('')}
    </div>
  `;
}
