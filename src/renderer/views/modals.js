import {
  addWeeksISO,
  habitStreak,
  poolOdds,
  projectStats,
  projectTasks,
  startOfWeekISO,
  todayISO,
} from '../../shared/domain.js';
import { AI_PRESETS } from '../../shared/defaults.js';
import { icon } from '../lib/icons.js';
import {
  escapeHtml,
  estimateLabel,
  pct,
  sourceLabel,
  weekLabel,
  weekRange,
} from '../lib/format.js';

function sheet({ eyebrow = '', title, sub = '', body, footer = '', tall = false, close = true }) {
  return `
    <div class="overlay open" data-overlay>
      <div class="scrim" data-action="close-modal"></div>
      <section class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="sheet-head">
          <div class="sheet-heading">
            ${eyebrow ? `<div class="sheet-eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
            <div class="sheet-title">${escapeHtml(title)}</div>
            ${sub ? `<div class="sheet-sub">${escapeHtml(sub)}</div>` : ''}
          </div>
          ${close ? `<button class="sheet-close" data-action="close-modal" aria-label="关闭">${icon('x', 16)}</button>` : ''}
        </div>
        <div class="sheet-body">${body}</div>
        ${footer ? `<div class="sheet-footer">${footer}</div>` : ''}
      </section>
    </div>
  `;
}

function field({ label, html, hint = '' }) {
  return `<div class="field"><label>${escapeHtml(label)}</label>${html}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}

function errorBox(error) {
  return error ? `<div class="error-box">${escapeHtml(error)}</div>` : '';
}

function projectOptions(state, selected) {
  return [
    `<option value="" ${!selected ? 'selected' : ''}>不归属项目（单件小事）</option>`,
    ...state.projects.map(
      (project) =>
        `<option value="${project.id}" ${selected === project.id ? 'selected' : ''}>${escapeHtml(project.title)}</option>`,
    ),
    `<option value="__new__" ${selected === '__new__' ? 'selected' : ''}>＋ 新建项目…</option>`,
  ].join('');
}

function weekOptions(ctx, selected) {
  const options = [];
  const base = ctx.selectedWeek;
  for (let offset = -8; offset <= 30; offset += 1) {
    const value = addWeeksISO(base, offset);
    options.push(
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${weekLabel(value, ctx.currentWeek)} · ${weekRange(value)}</option>`,
    );
  }
  if (selected && !options.some((option) => option.includes(`value="${selected}"`))) {
    options.unshift(
      `<option value="${selected}" selected>${weekLabel(selected, ctx.currentWeek)} · ${weekRange(selected)}</option>`,
    );
  }
  return options.join('');
}

export function renderTaskActions(ctx) {
  const modal = ctx.ui.modal;
  const task = ctx.state.tasks.find((item) => item.id === modal.taskId);
  if (!task) return '';
  const project = task.projectId ? ctx.state.projects.find((item) => item.id === task.projectId) : null;
  const done = task.status === 'done';

  return sheet({
    eyebrow: project ? project.title : '单件小事',
    title: task.title,
    sub: `${weekRange(task.weekStart)} · ${task.points} 积分${task.estimateMin ? ` · 约 ${estimateLabel(task.estimateMin)}` : ''}`,
    body: `
      ${task.detail ? `<div class="info-box" style="margin-bottom:8px">${escapeHtml(task.detail)}</div>` : ''}
      ${task.carryOver ? '<div class="hint" style="margin:0 0 8px">这件是从更早的一周并过来的。</div>' : ''}
      <div class="action-list">
        <button class="action-item ${done ? '' : 'primary'}" data-action="toggle-task" data-id="${task.id}">
          <span class="action-icon">${icon(done ? 'undo' : 'check', 15)}</span>
          <span class="action-copy">
            <span class="action-title">${done ? '撤销完成' : '标记完成'}${done ? '' : ` · +${task.points} 分`}</span>
            <span class="action-sub">${done ? '只有在积分还没花掉时才能撤销。' : '完成后积分立刻到账。'}</span>
          </span>
        </button>
        ${
          !done
            ? `
          <button class="action-item" data-action="defer-single-task" data-id="${task.id}" data-mode="shift">
            <span class="action-icon">${icon('clock', 15)}</span>
            <span class="action-copy">
              <span class="action-title">这件任务顺延一周</span>
              <span class="action-sub">只移动这一件，同项目其他任务不动。</span>
            </span>
          </button>
          <button class="action-item" data-action="defer-single-task" data-id="${task.id}" data-mode="stack">
            <span class="action-icon">${icon('layers', 15)}</span>
            <span class="action-copy">
              <span class="action-title">这件任务压到下周</span>
              <span class="action-sub">只把这一件挪到下周，并标记为“补”。</span>
            </span>
          </button>
          ${project ? '<div class="hint" style="margin:2px 0 6px">要整体顺延项目，请打开项目标题旁的“...”菜单。</div>' : ''}
          <div class="action-divider"></div>
        `
            : ''
        }
        <button class="action-item" data-action="edit-task" data-id="${task.id}">
          <span class="action-icon">${icon('edit', 15)}</span>
          <span class="action-copy"><span class="action-title">编辑内容与安排</span><span class="action-sub">改标题、细节、周次或积分。</span></span>
        </button>
        <button class="action-item danger" data-action="delete-task" data-id="${task.id}">
          <span class="action-icon">${icon('trash', 15)}</span>
          <span class="action-copy"><span class="action-title">删除这件任务</span><span class="action-sub">删除后不可恢复，但可以在提示里撤销。</span></span>
        </button>
      </div>
    `,
  });
}

export function renderTaskEditor(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const editing = Boolean(modal.taskId);
  const task = editing ? ctx.state.tasks.find((item) => item.id === modal.taskId) : null;
  return sheet({
    eyebrow: editing ? 'Edit task' : 'New task',
    title: editing ? '编辑任务' : '加一件事',
    sub: '不用写得漂亮，只要写清楚“做完是什么样”。',
    body: `
      <form id="task-form">
        ${field({
          label: '任务',
          html: `<input class="input" data-task-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：写完动态数组的 push / resize" maxlength="200" data-autofocus />`,
        })}
        ${field({
          label: '完成标准 / 细节',
          html: `<textarea class="textarea" data-task-field="detail" placeholder="做到什么程度算完成？有什么参考？" maxlength="1200">${escapeHtml(draft.detail)}</textarea>`,
        })}
        <div class="field-row">
          ${field({
            label: '归属项目',
            html: `<div class="project-field-control"><select class="select" data-task-field="projectId">${projectOptions(ctx.state, draft.projectId)}</select><button type="button" class="text-button task-new-project-trigger" data-action="task-new-project">＋ 新建</button></div>`,
          })}
          ${field({
            label: '安排到哪一周',
            html: `<select class="select" data-task-field="weekStart">${weekOptions(ctx, draft.weekStart)}</select>`,
          })}
        </div>
        <div class="task-new-project" data-new-project-box ${draft.projectId === '__new__' ? '' : 'hidden'}>
          <div class="field-row">
            ${field({
              label: '新项目名称',
              html: `<input class="input" data-new-project-field="title" value="${escapeHtml(draft.newProject?.title || '')}" placeholder="例如：三个月学会 C++" maxlength="120" />`,
            })}
            ${field({
              label: '项目周数',
              html: `<input class="input" type="number" min="1" max="52" step="1" data-new-project-field="weeks" value="${draft.newProject?.weeks || 12}" />`,
            })}
          </div>
          <div class="hint">会先创建项目，再把这条任务归进去；项目之后可以在蓝图页继续加任务。</div>
        </div>
        <div class="field-row">
          ${field({
            label: '奖励积分',
            html: `<input class="input" type="number" min="1" max="500" step="1" data-task-field="points" value="${draft.points}" ${task?.status === 'done' ? 'disabled' : ''} />`,
            hint: task?.status === 'done' ? '已完成任务的积分已记账，不能再改。' : '10 分≈随手小事，30 分≈一次硬仗。',
          })}
          ${field({
            label: '预计分钟',
            html: `<input class="input" type="number" min="0" max="1440" step="5" data-task-field="estimateMin" value="${draft.estimateMin}" />`,
          })}
        </div>
        ${
          editing
            ? ''
            : `<label class="check-line">
                <input type="checkbox" data-task-field="repeatWeekly" ${draft.repeatWeekly ? 'checked' : ''} />
                <span><b>每一周都要完成</b><small>为项目剩余周生成同名任务；没有项目时生成 12 周。每周单独完成、单独计分。</small></span>
              </label>`
        }
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="task-form">${editing ? '保存' : '加入任务'}</button>
    `,
  });
}

export function renderProjectEditor(ctx) {
  const draft = ctx.ui.modal.draft;
  return sheet({
    eyebrow: 'New project',
    title: '新建项目',
    sub: '先留一个位置，任务可以之后按周慢慢加。',
    body: `
      <form id="project-form">
        ${field({
          label: '项目名称',
          html: `<input class="input" data-project-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：三个月学会 C++" maxlength="120" data-autofocus />`,
        })}
        ${field({
          label: '想做成什么',
          html: `<textarea class="textarea" data-project-field="goal" placeholder="最终可验收的成果是什么？" maxlength="1200">${escapeHtml(draft.goal)}</textarea>`,
        })}
        <div class="field-row">
          ${field({
            label: '开始周',
            html: `<input class="input" type="date" data-project-field="startDate" value="${escapeHtml(draft.startDate)}" />`,
          })}
          ${field({
            label: '计划几周',
            html: `<select class="select" data-project-field="weeks">${[4, 6, 8, 12, 16, 20, 26].map((weeks) => `<option value="${weeks}" ${Number(draft.weeks) === weeks ? 'selected' : ''}>${weeks} 周</option>`).join('')}</select>`,
          })}
        </div>
        ${errorBox(ctx.ui.modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="project-form">创建项目</button>
    `,
  });
}

function planForm(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const config = ctx.state.settings.ai;
  const preset = AI_PRESETS[config.provider] || AI_PRESETS.custom;
  return `
    <form id="plan-form">
      ${field({
        label: '你想完成什么',
        html: `<textarea class="textarea" data-plan-field="goal" placeholder="例如：未来三个月从零学 C++，做出一个可玩的小引擎。" maxlength="2000" data-autofocus>${escapeHtml(draft.goal)}</textarea>`,
      })}
      <div class="field-row">
        ${field({
          label: '总周数',
          html: `<select class="select" data-plan-field="weeks">${[4, 6, 8, 12, 16, 20, 26].map((weeks) => `<option value="${weeks}" ${Number(draft.weeks) === weeks ? 'selected' : ''}>${weeks} 周</option>`).join('')}</select>`,
        })}
        ${field({
          label: '每周可投入',
          html: `<div style="position:relative"><input class="input" type="number" min="0.5" max="60" step="0.5" data-plan-field="hoursPerWeek" value="${draft.hoursPerWeek}" style="padding-right:34px" /><span style="position:absolute;right:10px;top:9px;font-size:9px;color:var(--faint)">小时</span></div>`,
        })}
      </div>
      <div class="field-row">
        ${field({
          label: '当前水平',
          html: `<select class="select" data-plan-field="level">${['零基础', '入门', '有基础', '进阶'].map((level) => `<option ${draft.level === level ? 'selected' : ''}>${level}</option>`).join('')}</select>`,
        })}
        ${field({
          label: '开始日期',
          html: `<input class="input" type="date" data-plan-field="startDate" value="${escapeHtml(draft.startDate)}" />`,
        })}
      </div>
      ${field({
        label: '额外约束（可选）',
        html: `<input class="input" data-plan-field="notes" value="${escapeHtml(draft.notes)}" placeholder="例如：只有周末有整块时间；想以项目为主" maxlength="1000" />`,
      })}
      <div class="info-box" style="margin-top:12px">
        ${icon('robot', 13)} 当前 AI：${escapeHtml(preset.label)} · ${escapeHtml(config.model || '未设置模型')}
        ${config.baseUrl ? `<br /><span class="faint" style="word-break:break-all">${escapeHtml(config.baseUrl)}</span>` : ''}
        <br /><button type="button" class="text-button" data-action="go-ai-settings">去设置里换一个接口</button>
        <span class="faint"> · </span>
        <button type="button" class="text-button" data-action="open-manual-plan">不接 AI，自己排周计划</button>
      </div>
      ${errorBox(modal.error)}
    </form>
  `;
}

function planPreview(ctx) {
  const modal = ctx.ui.modal;
  const plan = modal.plan;
  const tasks = plan.weeks.reduce((sum, week) => sum + week.tasks.length, 0);
  const points = plan.weeks.reduce(
    (sum, week) => sum + week.tasks.reduce((weekSum, task) => weekSum + task.points, 0),
    0,
  );
  const minutes = plan.weeks.reduce(
    (sum, week) => sum + week.tasks.reduce((weekSum, task) => weekSum + task.estimateMin, 0),
    0,
  );
  const visibleWeeks = plan.weeks.filter((week) => week.tasks.length > 0);
  const blankWeeks = plan.weeks.length - visibleWeeks.length;
  return `
    <div class="plan-preview-head">
      <div class="plan-preview-title">${escapeHtml(plan.title)}</div>
      <div class="plan-preview-summary">${escapeHtml(plan.summary || '')}</div>
      <div class="plan-stats">
        <span><b>${plan.weeks.length}</b> 周</span>
        <span><b>${tasks}</b> 件</span>
        <span><b>${points}</b> 积分</span>
        <span>约 <b>${Math.round(minutes / 60)}</b> 小时</span>
        <span>${sourceLabel(modal.source)}</span>
      </div>
    </div>
    ${visibleWeeks
      .map(
        (week) => `
      <div class="week-preview">
        <div class="week-preview-head">
          <span class="week-preview-no">W${String(week.week).padStart(2, '0')}</span>
          <span class="week-preview-theme">${escapeHtml(week.theme)}</span>
        </div>
        ${week.outcome ? `<div class="week-preview-outcome">${escapeHtml(week.outcome)}</div>` : ''}
        <div class="week-preview-tasks">
          ${week.tasks
            .map(
              (task) => `
            <div class="week-preview-task">
              <span class="dot"></span>
              <span>${escapeHtml(task.title)}</span>
              <span class="pts">+${task.points}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>
    `,
      )
      .join('')}
    ${blankWeeks ? `<div class="hint" style="margin-top:10px">还有 ${blankWeeks} 周留白，没有塞填充任务。加入后可以按实际情况补。</div>` : ''}
    <div class="hint" style="margin-top:8px">确认后会写到蓝图里，从 ${weekRange(modal.draft.startDate || todayISO())} 开始。之后每周都能单独改。</div>
    ${errorBox(modal.error)}
  `;
}

export function renderManualPlan(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const start = startOfWeekISO(draft.startDate || todayISO());
  return sheet({
    eyebrow: 'Manual planner',
    title: '自己排未来几周',
    sub: '不需要 AI。给每周一个主题，一行写一件任务；留白的周也没关系。',
    tall: true,
    body: `
      <form id="manual-plan-form">
        ${field({
          label: '项目名称',
          html: `<input class="input" data-manual-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：三个月学会 C++" maxlength="120" data-autofocus />`,
        })}
        ${field({
          label: '想做成什么（可选）',
          html: `<textarea class="textarea" data-manual-field="goal" placeholder="最终可验收的成果，或这一路想守住的东西。" maxlength="1200">${escapeHtml(draft.goal)}</textarea>`,
        })}
        <div class="field-row">
          ${field({
            label: '开始周',
            html: `<input class="input" type="date" data-manual-field="startDate" value="${escapeHtml(draft.startDate)}" />`,
          })}
          ${field({
            label: '计划几周',
            html: `<select class="select" data-manual-weeks>${[4, 6, 8, 12, 16, 20, 26].map((weeks) => `<option value="${weeks}" ${Number(draft.weeks) === weeks ? 'selected' : ''}>${weeks} 周</option>`).join('')}</select>`,
          })}
        </div>
        <div class="info-box" style="margin-top:12px">
          每周的文本框里，<b>一行就是一件任务</b>。默认 15 分、预计 60 分钟；想改积分就写
          <code>写完练习 | 25</code>。创建后仍可逐件编辑。
        </div>
        <div class="manual-weeks">
          ${draft.weekPlans
            .map((week, index) => {
              const weekStart = addWeeksISO(start, index);
              return `
                <div class="manual-week">
                  <div class="manual-week-head">
                    <span class="manual-week-no">W${String(index + 1).padStart(2, '0')}</span>
                    <span class="manual-week-date">${weekRange(weekStart)}</span>
                    <input class="manual-week-theme" data-manual-week="${index}" data-manual-key="theme" value="${escapeHtml(week.theme)}" placeholder="这周的主题（可选）" maxlength="120" />
                  </div>
                  <textarea class="textarea manual-week-tasks" data-manual-week="${index}" data-manual-key="tasks" maxlength="2000" placeholder="一行一件任务，例如：\n装好编译器并跑通 Hello World\n读完指针章节 | 15">${escapeHtml(week.text)}</textarea>
                </div>
              `;
            })
            .join('')}
        </div>
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="manual-plan-form">${icon('check', 13)} 创建计划</button>
    `,
  });
}

export function renderPlanWizard(ctx) {
  const modal = ctx.ui.modal;
  const loading = modal.step === 'loading';
  const preview = modal.step === 'preview';
  if (preview) {
    return sheet({
      eyebrow: 'Review the path',
      title: `这份 ${modal.plan.weeks.length} 周，够具体吗？`,
      sub: '先看一遍节奏。加入蓝图后，可以逐周改。',
      tall: true,
      body: planPreview(ctx),
      footer: `
        <button class="btn btn-ghost" data-action="plan-back">返回修改</button>
        <button class="btn btn-primary" data-action="plan-confirm">${icon('check', 13)} 加入蓝图</button>
      `,
    });
  }
  return sheet({
    eyebrow: 'AI planner',
    title: '把目标折成周',
    sub: '三个月太长，先看这一周。AI 会按阶段铺出每周动作。',
    body: loading
      ? `
        <div class="empty" style="padding:34px 18px">
          <div class="empty-orbit">${icon('sparkles', 22)}</div>
          <div class="empty-title">正在拆解目标…</div>
          <div class="empty-copy">本机模型可能需要几十秒。可以先去倒杯水，窗口不会关。</div>
        </div>
      `
      : planForm(ctx),
    footer: loading
      ? `<button class="btn btn-ghost btn-block" data-action="cancel-plan">取消</button>`
      : `
        <button class="btn btn-ghost" data-action="offline-plan">${icon('layers', 13)} 离线模板</button>
        <button class="btn btn-primary" type="submit" form="plan-form">${icon('sparkles', 13)} 生成计划</button>
      `,
  });
}

export function renderHabitEditor(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const editing = Boolean(modal.habitId);
  const templates = [
    { title: '锻炼身体', icon: '🏃', points: 10 },
    { title: '读一会儿书', icon: '📖', points: 10 },
    { title: '拉伸', icon: '🧘', points: 5 },
    { title: '喝够水', icon: '💧', points: 5 },
    { title: '早睡', icon: '🌙', points: 10 },
  ];
  return sheet({
    eyebrow: editing ? 'Edit daily' : 'New daily',
    title: editing ? '编辑每日任务' : '加一个每日任务',
    sub: '每天都会出现，完成一次记一次分，第二天自动重置。',
    body: `
      <form id="habit-form">
        <div class="field-row">
          ${field({
            label: '图标',
            html: `<input class="input" data-habit-field="icon" value="${escapeHtml(draft.icon)}" maxlength="8" placeholder="🏃" />`,
          })}
          ${field({
            label: '每天积分',
            html: `<input class="input" type="number" min="1" max="100" step="1" data-habit-field="points" value="${draft.points}" />`,
          })}
        </div>
        <div class="chip-row" style="margin-top:-2px">
          ${templates
            .map(
              (item) =>
                `<button type="button" class="chip" data-action="pick-habit-template" data-title="${escapeHtml(item.title)}" data-icon="${item.icon}" data-points="${item.points}">${item.icon} ${escapeHtml(item.title)}</button>`,
            )
            .join('')}
        </div>
        ${field({
          label: '每天要做的事',
          html: `<input class="input" data-habit-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：锻炼 20 分钟" maxlength="120" data-autofocus />`,
        })}
        ${field({
          label: '备注（可选）',
          html: `<input class="input" data-habit-field="detail" value="${escapeHtml(draft.detail)}" placeholder="做到什么程度算完成？" maxlength="400" />`,
        })}
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="habit-form">${editing ? '保存' : '加入每日'}</button>
    `,
  });
}

export function renderBonusEditor(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const editing = Boolean(modal.bonusId);
  const bonus = editing ? ctx.state.bonusTasks.find((item) => item.id === modal.bonusId) : null;
  const done = bonus?.status === 'done';
  return sheet({
    eyebrow: editing ? 'Edit todo' : 'Anytime todo',
    title: editing ? '编辑待办' : '加一件待办',
    sub: '不占周次，也没有截止时间；完成时一次拿分。',
    body: `
      <form id="bonus-form">
        <div class="field-row">
          ${field({
            label: '图标',
            html: `<input class="input" data-bonus-field="icon" value="${escapeHtml(draft.icon)}" maxlength="8" placeholder="✨" />`,
          })}
          ${field({
            label: '完成积分',
            html: `<input class="input" type="number" min="1" max="10000" step="1" data-bonus-field="points" value="${draft.points}" ${done ? 'disabled' : ''} />`,
            hint: done ? '已完成任务的积分已经记账，不能再改。' : '这是高积分任务，建议 50–500 分。',
          })}
        </div>
        <div class="chip-row" style="margin-top:-2px">
          ${[50, 100, 200, 500]
            .map(
              (points) =>
                `<button type="button" class="chip" data-action="pick-bonus-template" data-points="${points}">${points} 分</button>`,
            )
            .join('')}
        </div>
        ${field({
          label: '要做的事',
          html: `<input class="input" data-bonus-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：整理一次桌面 / 写一篇复盘" maxlength="200" data-autofocus />`,
        })}
        ${field({
          label: '说明（可选）',
          html: `<textarea class="textarea" data-bonus-field="detail" placeholder="做到什么程度算完成？" maxlength="1200">${escapeHtml(draft.detail)}</textarea>`,
        })}
        ${done ? '<div class="info-box">这项已经完成，积分已入账；你仍然可以改名称和说明。</div>' : ''}
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="bonus-form">${editing ? '保存' : '加入待办'}</button>
    `,
  });
}

export function renderHabitActions(ctx) {
  const modal = ctx.ui.modal;
  const habit = ctx.state.habits.find((item) => item.id === modal.habitId);
  if (!habit) return '';
  const streak = habitStreak(ctx.state, habit.id);
  const total = (ctx.state.habitCompletions || []).filter(
    (completion) => completion.habitId === habit.id,
  ).length;
  return sheet({
    eyebrow: 'Daily',
    title: habit.title,
    sub: `每天 ${habit.points} 分 · 连续 ${streak} 天 · 累计 ${total} 次`,
    body: `
      ${habit.detail ? `<div class="info-box" style="margin-bottom:9px">${escapeHtml(habit.detail)}</div>` : ''}
      <div class="action-list">
        <button class="action-item" data-action="edit-habit" data-id="${habit.id}">
          <span class="action-icon">${icon('edit', 15)}</span>
          <span class="action-copy"><span class="action-title">编辑名称、图标与积分</span><span class="action-sub">已经完成的历史积分不会改变。</span></span>
        </button>
        <button class="action-item danger" data-action="delete-habit" data-id="${habit.id}">
          <span class="action-icon">${icon('trash', 15)}</span>
          <span class="action-copy"><span class="action-title">删除这个每日任务</span><span class="action-sub">会连同 ${total} 条完成记录一起删除，可在提示里撤销。</span></span>
        </button>
      </div>
    `,
  });
}

export function renderHabitManager(ctx) {
  const habits = (ctx.state.habits || []).filter((habit) => habit.active !== false);
  const rows = habits
    .map((habit) => {
      const streak = habitStreak(ctx.state, habit.id);
      return `
        <div class="manage-row">
          <span class="manage-emoji">${habit.icon ? escapeHtml(habit.icon) : icon('calendar', 14)}</span>
          <div class="manage-copy">
            <div class="manage-title">${escapeHtml(habit.title)}</div>
            <div class="manage-sub">每天 ${habit.points} 分 · 连续 ${streak} 天</div>
          </div>
          <button class="icon-btn small" data-action="edit-habit" data-id="${habit.id}" title="编辑" aria-label="编辑每日任务：${escapeHtml(habit.title)}">${icon('edit', 13)}</button>
          <button class="icon-btn small row-delete" data-action="delete-habit" data-id="${habit.id}" title="删除" aria-label="删除每日任务：${escapeHtml(habit.title)}">${icon('trash', 13)}</button>
        </div>
      `;
    })
    .join('');

  return sheet({
    eyebrow: 'Daily',
    title: '每日任务管理',
    sub: habits.length ? '编辑或删除已经添加的每日任务。' : '还没有添加每日任务。',
    body: habits.length
      ? `<div class="manage-list">${rows}</div>`
      : `
        <div class="manage-empty">
          <div class="manage-empty-icon">${icon('calendar', 22)}</div>
          <div>每日任务会每天自动出现，不需要排到某一周。</div>
          <div class="manage-empty-hint">先用下面的按钮添加一个。</div>
        </div>
      `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">关闭</button>
      <button class="btn btn-primary" data-action="new-habit">${icon('plus', 14)} 添加每日任务</button>
    `,
  });
}

export function renderProjectActions(ctx) {
  const modal = ctx.ui.modal;
  const project = ctx.state.projects.find((item) => item.id === modal.projectId);
  if (!project) return '';
  const stats = projectStats(ctx.state, project.id);
  const remaining = projectTasks(ctx.state, project.id).filter((task) => task.status !== 'done');
  return sheet({
    eyebrow: 'Project',
    title: project.title,
    sub: `${stats.done}/${stats.total} 件完成 · 剩余 ${stats.remaining} 件`,
    body: `
      ${project.goal ? `<div class="info-box" style="margin-bottom:9px">${escapeHtml(project.goal)}</div>` : ''}
      <div class="action-list">
        <button class="action-item" data-action="shift-project" data-id="${project.id}">
          <span class="action-icon">${icon('clock', 15)}</span>
          <span class="action-copy">
            <span class="action-title">整体顺延一周</span>
            <span class="action-sub">${remaining.length} 件未完成任务全部后移 7 天，每周节奏不变。</span>
          </span>
        </button>
        <button class="action-item" data-action="new-task" data-project-id="${project.id}">
          <span class="action-icon">${icon('plus', 15)}</span>
          <span class="action-copy"><span class="action-title">给这个项目加任务</span><span class="action-sub">手动指定周次与积分。</span></span>
        </button>
        <button class="action-item" data-action="open-plan-wizard-for-project" data-id="${project.id}">
          <span class="action-icon">${icon('sparkles', 15)}</span>
          <span class="action-copy"><span class="action-title">用 AI 重新拆解</span><span class="action-sub">会新建一个项目，不会覆盖这一个。</span></span>
        </button>
        <div class="action-divider"></div>
        <button class="action-item danger" data-action="delete-project" data-id="${project.id}">
          <span class="action-icon">${icon('trash', 15)}</span>
          <span class="action-copy"><span class="action-title">删除项目</span><span class="action-sub">连同 ${stats.total} 件任务一起删除，可在提示里撤销。</span></span>
        </button>
      </div>
    `,
  });
}

export function renderRewardEditor(ctx) {
  const modal = ctx.ui.modal;
  const draft = modal.draft;
  const editing = Boolean(modal.rewardId);
  const emojis = ['🎬', '🧋', '🎮', '🛌', '🚞', '☕', '🍜', '📚', '🎧', '🏔️', '🎨', '🕹️'];
  return sheet({
    eyebrow: editing ? 'Edit reward' : 'New reward',
    title: editing ? '编辑奖励' : '给自己一个奖励',
    sub: '奖励要具体、能兑现，最好和这一周的努力不在同一个维度。',
    body: `
      <form id="reward-form">
        <div class="field-row">
          ${field({
            label: '图标',
            html: `<input class="input" data-reward-field="icon" value="${escapeHtml(draft.icon)}" maxlength="8" placeholder="🎁" />`,
          })}
          ${field({
            label: '需要多少积分',
            html: `<input class="input" type="number" min="1" max="100000" step="1" data-reward-field="cost" value="${draft.cost}" />`,
          })}
        </div>
        <div class="chip-row" style="margin-top:-2px">
          ${emojis.map((emoji) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${emoji}">${emoji}</button>`).join('')}
        </div>
        ${field({
          label: '奖励名称',
          html: `<input class="input" data-reward-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：周五晚上看一部电影" maxlength="120" data-autofocus />`,
        })}
        ${field({
          label: '备注（可选）',
          html: `<input class="input" data-reward-field="note" value="${escapeHtml(draft.note)}" placeholder="怎么兑现？和谁一起？" maxlength="300" />`,
        })}
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      ${editing ? `<button class="btn btn-danger" data-action="delete-reward" data-id="${modal.rewardId}">删除</button>` : `<button class="btn btn-ghost" data-action="close-modal">取消</button>`}
      <button class="btn btn-primary" type="submit" form="reward-form">${editing ? '保存' : '加入清单'}</button>
    `,
  });
}

export function renderPoolEditor(ctx) {
  const modal = ctx.ui.modal;
  const editing = Boolean(modal.poolId);
  const draft = modal.draft;
  const totalWeight = draft.prizes.reduce((sum, prize) => sum + (Number(prize.weight) || 0), 0);
  const expected = totalWeight
    ? draft.prizes.reduce(
        (sum, prize) => sum + ((Number(prize.weight) || 0) / totalWeight) * (Number(prize.points) || 0),
        0,
      )
    : 0;
  const rtp = Number(draft.cost) ? expected / Number(draft.cost) : 0;
  return sheet({
    eyebrow: 'Custom pool',
    title: editing ? '编辑奖池' : '自建一个奖池',
    sub: '概率由权重决定，不需要凑满 100%；会按总权重折算。',
    tall: true,
    body: `
      <form id="pool-form" novalidate>
        <div class="field-row">
          ${field({
            label: '奖池名称',
            html: `<input class="input" data-pool-field="title" value="${escapeHtml(draft.title)}" placeholder="例如：周五夜奖池" maxlength="80" data-autofocus />`,
          })}
          ${field({
            label: '每次花费',
            html: `<input class="input" type="number" min="1" max="100000" step="1" data-pool-field="cost" value="${draft.cost}" />`,
          })}
        </div>
        <div class="field-row">
          ${field({
            label: '图标',
            html: `<input class="input" data-pool-field="icon" value="${escapeHtml(draft.icon)}" maxlength="8" placeholder="🌌" />`,
          })}
          ${field({
            label: '一句话说明',
            html: `<input class="input" data-pool-field="subtitle" value="${escapeHtml(draft.subtitle)}" placeholder="大概率空手而归" maxlength="200" />`,
          })}
        </div>
        ${field({
          label: '奖品总数 N',
          html: `<input class="input" type="number" min="${draft.prizes.length}" max="5000" step="1" data-pool-field="size" value="${draft.size || 100}" />`,
          hint: '按权重比例分配成有限库存；数量足够时每种至少 1 个，抽完需要重置。',
        })}
        <div class="field" style="margin-top:14px">
          <label>结果与权重</label>
          <div class="pool-editor-rows" id="pool-editor-rows">
            ${draft.prizes
              .map(
                (prize, index) => `
              <div class="pool-editor-row" data-prize-index="${index}">
                <input class="input" data-prize-field="label" value="${escapeHtml(prize.label)}" placeholder="结果名称" maxlength="80" />
                <input class="input" type="number" min="0.01" max="100" step="any" inputmode="decimal" data-prize-field="weight" value="${prize.weight}" title="权重" />
                <input class="input" type="number" min="0" max="1000000" step="1" data-prize-field="points" value="${prize.points}" title="奖励积分" />
                <button type="button" class="icon-btn small" data-action="remove-prize" data-index="${index}" aria-label="删除这一行">${icon('minus', 12)}</button>
              </div>`,
              )
              .join('')}
          </div>
          <div class="row" style="margin-top:6px">
            <button type="button" class="btn btn-ghost btn-sm" data-action="add-prize">${icon('plus', 12)} 加一个结果</button>
            <span class="spacer"></span>
            <span class="hint" style="margin:0">总权重 ${totalWeight || 0}</span>
          </div>
          <div class="hint">列顺序：结果名称 · 权重 · 奖励积分。权重可以随意设，程序会折算概率。</div>
        </div>
        <div class="info-box" style="margin-top:10px">
          期望回报：<b class="accent">${pct(rtp, 1)}</b> · 每次花费 ${draft.cost || 0} 分。
          设成 80% 左右会让你长期慢慢变穷，但偶尔有惊喜；设成 100% 以上则是送分。
        </div>
        ${errorBox(modal.error)}
      </form>
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn btn-primary" type="submit" form="pool-form">${editing ? '保存奖池' : '创建奖池'}</button>
    `,
  });
}

export function renderDraw(ctx) {
  const modal = ctx.ui.modal;
  const pool = ctx.state.pools.find((item) => item.id === modal.poolId);
  if (!pool) return '';
  const spinning = modal.phase === 'spinning';
  const draw = modal.draw;
  const prize = modal.prize;
  const big = prize && prize.points >= 1000;
  return sheet({
    eyebrow: spinning ? 'Drawing' : 'Result',
    title: spinning ? '正在落子…' : '这次的结果',
    sub: spinning ? '手心向上，交给随机。' : `${pool.title} · 每次 ${pool.cost} 分`,
    close: !spinning,
    body: `
      <div class="draw-stage">
        ${Array.from({ length: 6 })
          .map(
            (_, index) =>
              `<span class="spark" style="left:${12 + index * 14}%;top:${20 + (index % 3) * 22}%;animation-delay:${index * 180}ms"></span>`,
          )
          .join('')}
        <div class="draw-icon">${escapeHtml(pool.icon)}</div>
        <div class="reel ${spinning ? 'spinning' : ''}" id="draw-reel">${spinning ? '···' : escapeHtml(draw?.prizeLabel || '')}</div>
        ${
          spinning
            ? `<div class="draw-caption">结果马上揭晓</div>`
            : `
          <div class="draw-result">
            <div class="draw-points ${prize?.points ? '' : 'zero'}">${prize?.points ? `+${prize.points.toLocaleString('zh-CN')}` : '0 分'}</div>
            <div class="draw-net">本次 ${draw.points > 0 ? `收回 ${draw.points}` : '没有回报'} · 净变化 ${draw.points - draw.cost > 0 ? '+' : ''}${draw.points - draw.cost} · 余额 ${modal.balance}</div>
            <div class="draw-stock">${modal.remaining > 0 ? `奖池还剩 ${modal.remaining} 个奖品` : '奖池已抽完，记得重置'}</div>
          </div>
          ${big ? '<div class="hint" style="margin-top:10px;color:var(--accent)">这一把，桌面都亮了一下。</div>' : ''}
          <div class="draw-actions">
            <button class="btn btn-ghost" data-action="close-modal">收下</button>
            <button class="btn btn-secondary" data-action="draw-again" data-id="${pool.id}">再来一次</button>
          </div>
        `}
      </div>
      <div class="hint" style="margin-top:10px">每次结果独立随机，概率与回报率可以回奖励页查看。不要用生活必需的钱来类比积分。</div>
    `,
  });
}

export function renderConfirm(ctx) {
  const modal = ctx.ui.modal;
  return sheet({
    eyebrow: modal.eyebrow || 'Confirm',
    title: modal.title,
    sub: modal.sub || '',
    body: `
      <div class="info-box">${escapeHtml(modal.message)}</div>
      ${errorBox(modal.error)}
    `,
    footer: `
      <button class="btn btn-ghost" data-action="close-modal">再想想</button>
      <button class="btn ${modal.danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-modal">${escapeHtml(modal.confirmLabel || '确定')}</button>
    `,
  });
}

export function renderOverlay(ctx) {
  const modal = ctx.ui.modal;
  if (!modal) return '';
  switch (modal.type) {
    case 'task-actions':
      return renderTaskActions(ctx);
    case 'task-editor':
      return renderTaskEditor(ctx);
    case 'bonus-editor':
      return renderBonusEditor(ctx);
    case 'habit-editor':
      return renderHabitEditor(ctx);
    case 'habit-actions':
      return renderHabitActions(ctx);
    case 'habit-manager':
      return renderHabitManager(ctx);
    case 'project-editor':
      return renderProjectEditor(ctx);
    case 'project-actions':
      return renderProjectActions(ctx);
    case 'plan-wizard':
      return renderPlanWizard(ctx);
    case 'manual-plan':
      return renderManualPlan(ctx);
    case 'reward-editor':
      return renderRewardEditor(ctx);
    case 'pool-editor':
      return renderPoolEditor(ctx);
    case 'draw':
      return renderDraw(ctx);
    case 'confirm':
      return renderConfirm(ctx);
    default:
      return '';
  }
}

export function renderToast(ctx) {
  const toast = ctx.ui.toast;
  if (!toast) return '';
  return `
    <div class="toast" role="status">
      <span class="toast-message">${escapeHtml(toast.message)}</span>
      ${toast.action ? `<button class="toast-action" data-action="toast-action">${escapeHtml(toast.action.label)}</button>` : ''}
      <button class="toast-close" data-action="dismiss-toast" aria-label="关闭提示">${icon('x', 11)}</button>
    </div>
  `;
}
