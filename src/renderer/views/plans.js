import {
  addWeeksISO,
  compareWeeks,
  projectStats,
  projectTasks,
} from '../../shared/domain.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, pct, sourceLabel, weekRange } from '../lib/format.js';

function timeline(ctx, project) {
  const tasks = projectTasks(ctx.state, project.id);
  const firstTask = tasks[0]?.weekStart || project.startDate;
  const lastTask = tasks[tasks.length - 1]?.weekStart || project.startDate;
  const start =
    firstTask < project.startDate ? firstTask : project.startDate;
  const plannedEnd = addWeeksISO(project.startDate, project.plannedWeeks - 1);
  const end = lastTask > plannedEnd ? lastTask : plannedEnd;
  const weekCount = Math.max(1, compareWeeks(end, start) + 1);
  const total = Math.min(30, weekCount);
  const segments = [];
  for (let index = 0; index < total; index += 1) {
    const weekStart = addWeeksISO(start, index);
    const weekTasks = tasks.filter((task) => task.weekStart === weekStart);
    const done = weekTasks.filter((task) => task.status === 'done').length;
    const isNow = weekStart === ctx.currentWeek;
    const isDone = weekTasks.length > 0 && done === weekTasks.length;
    segments.push(
      `<span class="project-seg ${isDone ? 'done' : ''} ${isNow ? 'now' : ''}" title="${weekRange(weekStart)}"></span>`,
    );
  }
  return { segments: segments.join(''), total, weekCount, start, end };
}

function renderWeekRows(ctx, project) {
  const tasks = projectTasks(ctx.state, project.id);
  if (!tasks.length) {
    return '<div class="project-weeks"><div class="hint">还没有任务。按周添加，或者让 AI 重新拆解这个目标。</div></div>';
  }
  const weeks = new Map();
  for (const task of tasks) {
    if (!weeks.has(task.weekStart)) weeks.set(task.weekStart, []);
    weeks.get(task.weekStart).push(task);
  }
  const metaByWeek = new Map((project.weeksMeta || []).map((item) => [item.week, item]));
  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const startWeek = project.startDate;
  return `
    <div class="project-weeks">
      ${sorted
        .map(([weekStart, weekTasks]) => {
          const index = compareWeeks(weekStart, startWeek) + 1;
          const meta = metaByWeek.get(index);
          const current = weekStart === ctx.currentWeek;
          return `
            <div class="project-week-row ${current ? 'current' : ''}">
              <div class="project-week-label">${current ? 'NOW' : `W${index}`}</div>
              <div>
                <div class="project-week-theme">${escapeHtml(meta?.theme || `第 ${index} 周`)}</div>
                ${meta?.outcome ? `<div class="project-week-outcome">${escapeHtml(meta.outcome)}</div>` : ''}
                ${weekTasks
                  .map(
                    (task) => `
                  <div class="mini-task ${task.status === 'done' ? 'done' : ''}" data-action="task-actions" data-id="${task.id}" role="button" tabindex="0">
                    <span class="dot"></span>
                    <span>${escapeHtml(task.title)}</span>
                    ${task.carryOver ? '<span class="carry-badge">补</span>' : ''}
                  </div>`,
                  )
                  .join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderProject(ctx, project) {
  const stats = projectStats(ctx.state, project.id);
  const line = timeline(ctx, project);
  const expanded = ctx.ui.expandedProjects.has(project.id);
  const weeksSinceStart = compareWeeks(ctx.currentWeek, line.start);
  const weeksLeft = weeksSinceStart < 0 ? line.weekCount : Math.max(0, line.weekCount - weeksSinceStart);
  return `
    <article class="project-card" style="--project-color:${project.color}">
      <div class="project-main" data-action="toggle-project" data-id="${project.id}" role="button" tabindex="0" aria-expanded="${expanded}">
        <div class="project-top">
          <div class="project-name">${escapeHtml(project.title)}</div>
          <span class="project-source">${sourceLabel(project.source)}</span>
        </div>
        ${project.goal ? `<div class="project-goal">${escapeHtml(project.goal)}</div>` : ''}
        <div class="project-timeline">${line.segments}</div>
        <div class="project-foot">
          <span>${stats.done}/${stats.total} 件</span>
          <span class="dot"></span>
          <span>${weekRange(project.startDate)} → ${weekRange(line.end)}</span>
          <span class="spacer"></span>
          <span class="project-percent">${pct(stats.progress)}</span>
        </div>
        <div class="project-foot" style="margin-top:4px">
          <span>${weeksLeft > 0 ? `还剩 ${weeksLeft} 周` : '已过计划周期'}</span>
          ${project.shiftCount ? `<span>· 已顺延 ${project.shiftCount} 次</span>` : ''}
          <span class="spacer"></span>
          <span>${expanded ? '收起' : '展开每周'}</span>
          ${icon(expanded ? 'chevronUp' : 'chevronDown', 12)}
        </div>
      </div>
      ${expanded ? renderWeekRows(ctx, project) : ''}
      <div class="project-actions">
        <button class="btn btn-secondary btn-sm" data-action="shift-project" data-id="${project.id}">
          ${icon('clock', 12)} 整体顺延一周
        </button>
        <button class="btn btn-ghost btn-sm" data-action="project-actions" data-id="${project.id}">
          ${icon('more', 14)} 更多
        </button>
      </div>
    </article>
  `;
}

export function renderPlans(ctx) {
  const projects = [...ctx.state.projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Blueprint</div>
          <h1 class="page-title">蓝图</h1>
          <div class="page-sub">长期目标先在这里铺开，再落到每一周。</div>
        </div>
        <button class="icon-btn accent" data-action="open-plan-wizard" aria-label="AI 规划">${icon('sparkles', 16)}</button>
      </div>

      <div class="plan-banner">
        <div class="plan-banner-icon">${icon('wand', 17)}</div>
        <div class="plan-banner-copy">
          <div class="plan-banner-title">把“三个月学会 C++”拆成 12 周</div>
          <div class="plan-banner-sub">AI 按阶段铺路，你只需要完成这一周。</div>
        </div>
        <button class="icon-btn" data-action="open-manual-plan" aria-label="手动规划" title="手动规划">${icon('edit', 15)}</button>
        <button class="btn btn-secondary btn-sm" data-action="open-plan-wizard">拆解</button>
      </div>

      ${projects.length ? projects.map((project) => renderProject(ctx, project)).join('') : `
        <div class="empty">
          <div class="empty-orbit">${icon('layers', 21)}</div>
          <div class="empty-title">蓝图还是空的</div>
          <div class="empty-copy">先放下一个真正想完成的目标。可以让 AI 拆，也可以自己一周一周地排。</div>
          <div class="empty-actions">
            <button class="btn btn-primary btn-sm" data-action="open-plan-wizard">${icon('sparkles', 13)} AI 拆解</button>
            <button class="btn btn-secondary btn-sm" data-action="open-manual-plan">${icon('edit', 13)} 手动规划</button>
          </div>
        </div>
      `}

      <div class="section stack">
        <button class="btn btn-secondary btn-block" data-action="open-manual-plan">${icon('edit', 13)} 手动规划未来几周</button>
        <button class="btn btn-ghost btn-block" data-action="new-project">${icon('plus', 13)} 只建一个空项目</button>
      </div>
      <div class="hint" style="text-align:center;margin-top:6px">项目是长期路径，本周页只负责眼前这一步。</div>
    </div>
  `;
}
