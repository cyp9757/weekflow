import {
  activeHabits,
  compareWeeks,
  computeBalance,
  endOfWeekISO,
  habitCompletion,
  isoWeekInfo,
  overdueTasks,
  startOfWeekISO,
  tasksForWeek,
  todayISO,
  weekStats,
} from '../shared/domain.js';
import { icon } from './lib/icons.js';
import { clampText, escapeHtml, relativeTaskWeek, weekRange } from './lib/format.js';
import { renderWeek } from './views/week.js';
import { renderPlans } from './views/plans.js';
import { renderRewards } from './views/rewards.js';
import { renderRedemptionsView } from './views/redemptions.js';
import { renderSettings } from './views/settings.js';
import { renderAppearancePopover } from './views/appearance.js';
import { renderOverlay, renderToast } from './views/modals.js';
import { ACTIONS } from './actions.js';

const api = window.weekflow;
const params = new URLSearchParams(window.location.search);
const isShot = params.get('screenshot') === '1';

const ctx = {
  state: null,
  revision: 0,
  dataDir: '',
  version: '0.11.1',
  hotkey: null,
  currentWeek: startOfWeekISO(todayISO()),
  selectedWeek: startOfWeekISO(todayISO()),
  balance: 0,
  saveChain: Promise.resolve(),
  saveState: 'saved',
  api,
  ui: {
    view: 'week',
    compact: false,
    clickThrough: false,
    quickPanel: null,
    navOpen: false,
    selectedWeek: startOfWeekISO(todayISO()),
    redemptionsTab: 'all',
    expandedProjects: new Set(),
    showDone: false,
    justDone: null,
    justHabit: null,
    modal: null,
    toast: null,
    toastTimer: null,
    rollover: null,
    aiOpen: false,
    aiTest: null,
    aiModels: [],
    showKey: false,
    rewardsTab: 'rewards',
    expandedPools: new Set(),
    drawTimer: null,
    planToken: 0,
  },
};

const appEl = document.getElementById('app');
const overlayEl = document.getElementById('overlay');
const toastEl = document.getElementById('toast');
const bootEl = document.getElementById('boot');

function applyTheme() {
  const state = ctx.state;
  if (!state) return;
  const settings = state.settings;
  const root = document.documentElement;
  document.body.dataset.theme = settings.theme || 'night';
  root.style.colorScheme = settings.theme === 'paper' ? 'light' : 'dark';
  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--panel-alpha', String(settings.panelOpacity));
  root.style.setProperty('--fade-opacity', String(settings.fadeOpacity));
  document.body.classList.toggle('auto-fade', Boolean(settings.autoFade && !isShot));
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  document.body.classList.toggle('is-compact', Boolean(ctx.ui.compact));
  document.body.classList.toggle('has-modal', Boolean(ctx.ui.modal));
  document.body.classList.toggle('is-shot', isShot);
}

function dotDate(iso) {
  return `${Number(iso.slice(5, 7))}.${String(iso.slice(8, 10)).padStart(2, '0')}`;
}

function renderTopline() {
  return `
    <div class="topline">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="brand-copy">
          <span class="brand-name">周流</span>
          <span class="brand-sub">WEEKFLOW</span>
        </div>
      </div>
      <span class="top-spacer"></span>
      <button class="icon-btn ${ctx.ui.quickPanel ? 'accent' : ''}" data-action="toggle-appearance" aria-label="快捷外观" title="透明度与主题">
        ${icon('sun', 15)}
      </button>
      <button class="points-pill" data-action="go-rewards" aria-label="打开奖励页">
        ${icon('coin', 12)} ${ctx.balance.toLocaleString('zh-CN')}
      </button>
      <button class="icon-btn" data-action="new-task" aria-label="添加任务">${icon('plus', 16)}</button>
      <button class="icon-btn" data-action="toggle-compact" aria-label="收起为小条">${icon('minimize', 16)}</button>
    </div>
  `;
}

function renderWeekHero() {
  const week = ctx.selectedWeek;
  const info = isoWeekInfo(week);
  const stats = weekStats(ctx.state, week);
  const range = weekRange(week);
  const isCurrent = week === ctx.currentWeek;
  const relative = isCurrent ? '本周' : compareWeeks(week, ctx.currentWeek) > 0 ? '未来' : '回看';
  return `
    <div class="week-hero">
      <div class="week-head">
        <div>
          <div class="week-kicker">WEEK ${info.week} · ${info.year}</div>
          <h1 class="week-number">${dotDate(week)}<span class="dash">—</span>${dotDate(endOfWeekISO(week))}</h1>
          <div class="week-meta">
            <span>${range}</span>
            <span class="dot"></span>
            <span>${relative}</span>
            ${stats.total ? `<span class="dot"></span><span>${stats.total} 件</span>` : ''}
          </div>
        </div>
        <div class="week-nav">
          <button class="icon-btn" data-action="prev-week" aria-label="上一周">${icon('chevronLeft', 15)}</button>
          ${!isCurrent ? `<button class="week-now-btn" data-action="this-week">本周</button>` : ''}
          <button class="icon-btn" data-action="next-week" aria-label="下一周">${icon('chevronRight', 15)}</button>
        </div>
      </div>
      <div class="week-progress">
        <div class="progress-copy">
          <span><strong>${stats.done} / ${stats.total}</strong> 已完成</span>
          <span class="earned">+${stats.points} 分</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round(stats.progress * 100)}%"></div></div>
      </div>
    </div>
  `;
}

function renderTabs() {
  const tabs = [
    { id: 'week', label: '本周', icon: 'calendar' },
    { id: 'plans', label: '蓝图', icon: 'layers' },
    { id: 'rewards', label: '奖励', icon: 'gift' },
    { id: 'redemptions', label: '兑换', icon: 'receipt' },
    { id: 'settings', label: '设置', icon: 'sliders' },
  ];
  return `
    <nav class="tabbar" aria-label="主导航">
      ${tabs
        .map(
          (tab) => `
        <button class="tab ${ctx.ui.view === tab.id ? 'active' : ''}" data-action="navigate" data-view="${tab.id}">
          ${icon(tab.icon, 18)}<span>${tab.label}</span>
        </button>`,
        )
        .join('')}
    </nav>
  `;
}

function renderNavHandle() {
  return `
    <button class="nav-handle ${ctx.ui.navOpen ? 'open' : ''}" data-action="toggle-nav" aria-expanded="${ctx.ui.navOpen}" aria-label="${ctx.ui.navOpen ? '收起导航' : '展开导航'}">
      ${icon(ctx.ui.navOpen ? 'chevronDown' : 'grid', 13)}
      <span>${ctx.ui.navOpen ? '收起' : '导航'}</span>
    </button>
  `;
}

function renderCurrentView() {
  if (ctx.ui.view === 'plans') return renderPlans(ctx);
  if (ctx.ui.view === 'rewards') return renderRewards(ctx);
  if (ctx.ui.view === 'redemptions') return renderRedemptionsView(ctx);
  if (ctx.ui.view === 'settings') return renderSettings(ctx);
  return renderWeek(ctx);
}

function compactRow(kind, label, title, points, { done = false, empty = false, repeat = false, hideTag = false } = {}) {
  return `
    <div class="compact-row ${done ? 'done' : ''} ${empty ? 'empty' : ''} ${hideTag ? 'no-tag' : ''}" data-kind="${kind}">
      ${!hideTag && label ? `<span class="compact-tag ${kind}">${label}</span>` : ''}
      <span class="compact-row-title">${escapeHtml(clampText(title, 42))}</span>
      ${repeat ? '<span class="compact-repeat">每周</span>' : ''}
      <span class="compact-row-points">${points}</span>
    </div>
  `;
}

function compactProject(project, tasks) {
  const color = project?.color || 'var(--accent)';
  const done = tasks.filter((task) => task.status === 'done').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return `
    <div class="compact-project" style="--project-color:${color}">
      <div class="compact-project-head">
        <span class="compact-project-dot"></span>
        <span class="compact-project-title">${escapeHtml(project?.title || '单件小事')}</span>
        <span class="compact-project-count">${done}/${tasks.length}</span>
      </div>
      <div class="compact-project-track"><span style="width:${progress}%"></span></div>
      ${tasks
        .map((task) =>
          compactRow('week', '', task.title, task.status === 'done' ? '已完成' : `+${task.points}`, {
            done: task.status === 'done',
            repeat: Boolean(task.seriesId || task.recurring),
            hideTag: true,
          }),
        )
        .join('')}
    </div>
  `;
}

function renderCompact() {
  const today = todayISO();
  const habits = activeHabits(ctx.state);
  const weekTasks = tasksForWeek(ctx.state, ctx.currentWeek);
  const stats = weekStats(ctx.state, ctx.currentWeek);
  const progress = Math.round(stats.progress * 100);
  const groups = new Map();
  for (const task of weekTasks) {
    const key = task.projectId || '__solo';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  return `
    <div class="compact-bar">
      <div class="compact-head">
        <div class="compact-brand" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="compact-copy">
          <div class="compact-week">${dotDate(ctx.currentWeek)} — ${dotDate(endOfWeekISO(ctx.currentWeek))} · ${stats.done}/${stats.total}</div>
        </div>
        <span class="compact-points">${ctx.balance.toLocaleString('zh-CN')} 分</span>
        <button class="compact-open" data-action="expand-compact" aria-label="展开周流">${icon('expand', 15)}</button>
      </div>
      <div class="compact-body">
        <div class="compact-section">
          <div class="compact-section-head"><span>每日</span><span>${habits.filter((habit) => habitCompletion(ctx.state, habit.id, today)).length}/${habits.length}</span></div>
          ${
            habits.length
              ? `<div class="compact-daily-grid">${habits
                  .map((habit) => {
                    const done = Boolean(habitCompletion(ctx.state, habit.id, today));
                    return compactRow('daily', '', habit.title, done ? '已完成' : `+${habit.points}`, { done, hideTag: true });
                  })
                  .join('')}</div>`
              : compactRow('daily', '每日', '还没有每日任务', '—', { empty: true })
          }
        </div>
        <div class="compact-section">
          <div class="compact-section-head"><span>每周</span><span>${stats.done}/${stats.total}</span></div>
          ${
            groups.size
              ? [...groups.entries()]
                  .map(([projectId, tasks]) => {
                    const project = projectId === '__solo' ? null : ctx.state.projects.find((item) => item.id === projectId);
                    return compactProject(project, tasks);
                  })
                  .join('')
              : compactRow('week', '每周', '本周已清空', '—', { empty: true })
          }
        </div>
      </div>
      <div class="compact-track"><span style="width:${progress}%"></span></div>
    </div>
  `;
}

function render() {
  if (!ctx.state) return;
  applyTheme();
  const scrollTop = document.querySelector('.main-scroll')?.scrollTop || 0;
  ctx.selectedWeek = ctx.ui.selectedWeek;
  ctx.balance = computeBalance(ctx.state);
  if (ctx.ui.compact) {
    ctx.ui.quickPanel = null;
    appEl.innerHTML = renderCompact();
  } else {
    appEl.innerHTML = `
      <header class="app-header">
        ${renderTopline()}
        ${ctx.ui.view === 'week' ? renderWeekHero() : ''}
      </header>
      ${ctx.ui.quickPanel === 'appearance' ? renderAppearancePopover(ctx) : ''}
      <main class="main-scroll ${ctx.ui.navOpen ? 'nav-open' : ''}">${renderCurrentView()}</main>
      ${ctx.ui.navOpen ? renderTabs() : ''}
      ${renderNavHandle()}
    `;
    const scroller = appEl.querySelector('.main-scroll');
    if (scroller) scroller.scrollTop = scrollTop;
  }
  overlayEl.innerHTML = ctx.ui.modal ? renderOverlay(ctx) : '';
  toastEl.innerHTML = renderToast(ctx);
  updateTraySummary();
}

let lastTraySummary = '';
let draggedWeekSection = null;
function updateTraySummary() {
  if (!ctx.state) return;
  const stats = weekStats(ctx.state, ctx.currentWeek);
  const summary = `${stats.done}/${stats.total} 件 · ${ctx.balance} 分`;
  if (summary !== lastTraySummary) {
    lastTraySummary = summary;
    api.setTraySummary(summary).catch(() => {});
  }
}

function focusModal() {
  if (!ctx.ui.modal) return;
  requestAnimationFrame(() => {
    const target =
      overlayEl.querySelector('[data-autofocus]') ||
      overlayEl.querySelector('input:not([type="checkbox"]):not([type="range"]), textarea, select') ||
      overlayEl.querySelector('button');
    if (target) {
      target.focus({ preventScroll: true });
      if (typeof target.select === 'function' && target.tagName === 'INPUT' && target.type === 'text') {
        target.select();
      }
    }
  });
}

function renderOverlayOnly({ focus = false } = {}) {
  applyTheme();
  overlayEl.innerHTML = ctx.ui.modal ? renderOverlay(ctx) : '';
  if (focus) focusModal();
}

function openModal(modal) {
  clearDrawTimer();
  ctx.ui.quickPanel = null;
  ctx.ui.navOpen = false;
  ctx.ui.modal = modal;
  renderOverlayOnly({ focus: true });
}

function closeModal({ keepToken = false } = {}) {
  clearDrawTimer();
  if (!keepToken) ctx.ui.planToken += 1;
  ctx.ui.modal = null;
  renderOverlayOnly();
}

function clearDrawTimer() {
  const timer = ctx.ui.drawTimer;
  if (!timer) return;
  if (typeof timer === 'object') {
    clearInterval(timer.interval);
    clearTimeout(timer.timeout);
  } else {
    clearInterval(timer);
    clearTimeout(timer);
  }
  ctx.ui.drawTimer = null;
}

function persist() {
  if (!ctx.state) return ctx.saveChain;
  const snapshot = structuredClone(ctx.state);
  ctx.saveState = 'saving';
  ctx.saveChain = ctx.saveChain
    .then(async () => {
      const response = await api.saveState(snapshot, ctx.revision);
      if (!response?.ok) {
        if (response?.conflict && response.state) {
          ctx.state = response.state;
          ctx.revision = response.revision;
          render();
          showToast('数据已被另一个窗口更新，已重新载入');
          return;
        }
        ctx.saveState = 'error';
        showToast(response?.error || '保存失败，请检查数据目录');
        return;
      }
      ctx.revision = response.revision;
      ctx.saveState = 'saved';
    })
    .catch((error) => {
      ctx.saveState = 'error';
      showToast(`保存失败：${error.message || error}`);
    });
  return ctx.saveChain;
}

function commit(mutator, options = {}) {
  if (!ctx.state) return false;
  const snapshot = options.undo === false ? null : structuredClone(ctx.state);
  let result;
  try {
    result = mutator(ctx.state);
  } catch (error) {
    showToast(error.message || String(error));
    return false;
  }
  if (result && result.ok === false) {
    showToast(result.error || '操作没有完成');
    return false;
  }
  if (options.closeModal !== false) {
    // Mutations that happen inside a sheet usually dismiss it.
    if (ctx.ui.modal && options.keepModal !== true) closeModal({ keepToken: options.keepPlanToken });
  }
  if (options.rerender !== false) render();
  persist();
  if (options.message) {
    showToast(options.message, {
      action: snapshot
        ? {
            label: options.undoLabel || '撤销',
            onClick: () => {
              ctx.state = snapshot;
              render();
              persist();
              showToast('已撤销');
            },
          }
        : null,
      timeout: options.timeout || 6000,
    });
  }
  return true;
}

function showToast(message, { action = null, timeout = 4800 } = {}) {
  if (ctx.ui.toastTimer) clearTimeout(ctx.ui.toastTimer);
  ctx.ui.toast = { message, action };
  toastEl.innerHTML = renderToast(ctx);
  ctx.ui.toastTimer = setTimeout(() => {
    dismissToast();
  }, timeout);
}

function dismissToast() {
  if (ctx.ui.toastTimer) clearTimeout(ctx.ui.toastTimer);
  ctx.ui.toastTimer = null;
  ctx.ui.toast = null;
  toastEl.innerHTML = '';
}

function navigate(view) {
  if (!['week', 'plans', 'rewards', 'redemptions', 'settings'].includes(view)) return;
  ctx.ui.view = view;
  ctx.ui.quickPanel = null;
  ctx.ui.navOpen = false;
  render();
  const scroller = appEl.querySelector('.main-scroll');
  if (scroller) scroller.scrollTop = 0;
}

function openConfirm(options) {
  openModal({
    type: 'confirm',
    eyebrow: options.eyebrow || 'Confirm',
    title: options.title || '确定吗？',
    sub: options.sub || '',
    message: options.message || '',
    confirmLabel: options.confirmLabel || '确定',
    danger: Boolean(options.danger),
    onConfirm: options.onConfirm,
  });
}

function setViewFromUrl() {
  const requested = params.get('view');
  if (['week', 'plans', 'rewards', 'redemptions', 'settings'].includes(requested)) {
    ctx.ui.view = requested;
  }
}

function initRollover() {
  const current = startOfWeekISO(todayISO());
  const previous = ctx.state.meta.lastSeenWeek;
  const changed = previous && compareWeeks(current, previous) > 0;
  const count = overdueTasks(ctx.state, current).length;
  if (changed && count > 0) {
    ctx.ui.rollover = { count, previous };
  }
  if (previous !== current) {
    ctx.state.meta.lastSeenWeek = current;
    persist();
  }
}

function setupEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = ACTIONS[target.dataset.action];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      action(ctx, target, event);
    } catch (error) {
      console.error(error);
      showToast(error.message || String(error));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    const action = ACTIONS[`submit:${form.id}`];
    if (action) {
      try {
        action(ctx, form, event);
      } catch (error) {
        console.error(error);
        showToast(error.message || String(error));
      }
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('[data-range]')) {
      const value = Number(target.value);
      if (target.dataset.range === 'panelOpacity') {
        document.documentElement.style.setProperty('--panel-alpha', String(value));
        const label = document.getElementById('panel-opacity-value');
        if (label) label.textContent = `${Math.round(value * 100)}%`;
        const quickLabel = document.getElementById('quick-opacity-value');
        if (quickLabel) quickLabel.textContent = `${Math.round(value * 100)}%`;
      }
      if (target.dataset.range === 'fadeOpacity') {
        document.documentElement.style.setProperty('--fade-opacity', String(value));
        const label = document.getElementById('fade-opacity-value');
        if (label) label.textContent = `${Math.round(value * 100)}%`;
      }
    }
    if (target.matches('[data-task-field]')) {
      if (ctx.ui.modal?.draft) {
        ctx.ui.modal.draft[target.dataset.taskField] =
          target.type === 'checkbox' ? target.checked : target.value;
      }
    }
    if (target.matches('[data-new-project-field]')) {
      const draft = ctx.ui.modal?.draft;
      if (draft) {
        draft.newProject = draft.newProject || {};
        draft.newProject[target.dataset.newProjectField] = target.value;
      }
    }
    if (target.matches('[data-plan-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.planField] = target.value;
    }
    if (target.matches('[data-manual-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.manualField] = target.value;
    }
    if (target.matches('[data-manual-week]')) {
      const draft = ctx.ui.modal?.draft;
      const week = draft?.weekPlans?.[Number(target.dataset.manualWeek)];
      if (week) week[target.dataset.manualKey] = target.value;
    }
    if (target.matches('[data-project-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.projectField] = target.value;
    }
    if (target.matches('[data-reward-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.rewardField] = target.value;
    }
    if (target.matches('[data-habit-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.habitField] = target.value;
    }
    if (target.matches('[data-bonus-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.bonusField] = target.value;
    }
    if (target.matches('[data-pool-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.poolField] = target.value;
    }
    if (target.matches('[data-prize-field]')) {
      syncPrizeDraft();
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-task-field="projectId"]')) {
      const box = target.closest('form')?.querySelector('[data-new-project-box]');
      if (box) {
        box.hidden = target.value !== '__new__';
        if (!box.hidden) box.querySelector('[data-new-project-field="title"]')?.focus();
      }
    }
    if (target.matches('[data-setting]')) {
      ACTIONS['setting-change'](ctx, target, event);
    }
    if (target.matches('[data-ai-field]')) {
      ACTIONS['ai-field-change'](ctx, target, event);
    }
    if (target.matches('[data-range]')) {
      ACTIONS['range-commit'](ctx, target, event);
    }
    if (target.matches('[data-prize-field]')) {
      syncPrizeDraft();
    }
    if (target.matches('[data-pool-field]')) {
      if (ctx.ui.modal?.draft) ctx.ui.modal.draft[target.dataset.poolField] = target.value;
    }
    if (target.matches('[data-manual-weeks]')) {
      ACTIONS['manual-weeks-change'](ctx, target, event);
    }
    if (target.matches('[data-holiday-dates]')) {
      const dates = [
        ...new Set(
          target.value
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
            .filter((value) => !Number.isNaN(new Date(`${value}T12:00:00`).getTime())),
        ),
      ];
      ctx.state.settings.holidayDates = dates;
      ctx.persist();
      ctx.showToast(dates.length ? `已记录 ${dates.length} 个额外双倍日期` : '已清空额外双倍日期');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (ctx.ui.modal) {
        event.preventDefault();
        closeModal();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      ACTIONS['new-task'](ctx);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['1', '2', '3', '4', '5'].includes(event.key)) {
      event.preventDefault();
      navigate(['week', 'plans', 'rewards', 'redemptions', 'settings'][Number(event.key) - 1]);
      return;
    }
    if (event.key === 'Tab' && ctx.ui.modal) {
      const focusables = [
        ...overlayEl.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.matches('input, textarea, select, button')) {
      const target = event.target.closest('[role="button"][data-action]');
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  });

  document.addEventListener('dragstart', (event) => {
    const grip = event.target.closest?.('.panel-grip');
    if (!grip) return;
    const panel = grip.closest('[data-week-section]');
    if (!panel) return;
    draggedWeekSection = grip.dataset.dragSection;
    event.dataTransfer?.setData('text/plain', draggedWeekSection);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => panel.classList.add('dragging'));
  });

  document.addEventListener('dragover', (event) => {
    if (!draggedWeekSection) return;
    const panel = event.target.closest?.('[data-week-section]');
    document.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
      el.classList.remove('drop-before', 'drop-after');
    });
    if (!panel || panel.dataset.weekSection === draggedWeekSection) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    panel.classList.add(after ? 'drop-after' : 'drop-before');
  });

  document.addEventListener('drop', (event) => {
    if (!draggedWeekSection) return;
    const panel = event.target.closest?.('[data-week-section]');
    if (!panel || panel.dataset.weekSection === draggedWeekSection) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const current = ctx.state.settings.weekOrder || ['daily', 'week', 'bonus'];
    const next = current.filter((id) => id !== draggedWeekSection);
    let targetIndex = next.indexOf(panel.dataset.weekSection);
    if (targetIndex < 0) return;
    if (after) targetIndex += 1;
    next.splice(targetIndex, 0, draggedWeekSection);
    ctx.state.settings.weekOrder = next;
    draggedWeekSection = null;
    document.querySelectorAll('.dragging, .drop-before, .drop-after').forEach((el) => {
      el.classList.remove('dragging', 'drop-before', 'drop-after');
    });
    render();
    persist();
    ctx.showToast('已调整三个框的顺序');
  });

  document.addEventListener('dragend', () => {
    draggedWeekSection = null;
    document.querySelectorAll('.dragging, .drop-before, .drop-after').forEach((el) => {
      el.classList.remove('dragging', 'drop-before', 'drop-after');
    });
  });

  window.addEventListener('beforeunload', () => {
    // Best-effort flush; Electron's renderer usually survives hide.
    persist();
  });

  api.onCompactChanged?.((compact) => {
    ctx.ui.compact = Boolean(compact);
    if (ctx.state) ctx.state.settings.compact = Boolean(compact);
    if (compact) closeModal();
    render();
    if (ctx.state) persist();
  });
  api.onClickThroughChanged?.((enabled) => {
    ctx.ui.clickThrough = Boolean(enabled);
    if (ctx.ui.view === 'settings') render();
  });
  api.onSettingsChanged?.((settings) => {
    if (!ctx.state) return;
    ctx.state.settings = { ...ctx.state.settings, ...settings };
    applyTheme();
    render();
    persist();
  });
}

function syncPrizeDraft() {
  const modal = ctx.ui.modal;
  if (!modal?.draft) return;
  const rows = [...overlayEl.querySelectorAll('[data-prize-index]')];
  for (const row of rows) {
    const index = Number(row.dataset.prizeIndex);
    if (!modal.draft.prizes[index]) continue;
    const label = row.querySelector('[data-prize-field="label"]');
    const weight = row.querySelector('[data-prize-field="weight"]');
    const points = row.querySelector('[data-prize-field="points"]');
    if (label) modal.draft.prizes[index].label = label.value;
    if (weight) modal.draft.prizes[index].weight = weight.value;
    if (points) modal.draft.prizes[index].points = points.value;
  }
}

async function boot() {
  if (!api) {
    bootEl.innerHTML = '<p>请通过桌面程序启动周流。</p>';
    return;
  }
  try {
    const bootstrap = await api.getBootstrap();
    ctx.state = bootstrap.state;
    ctx.revision = bootstrap.revision;
    ctx.dataDir = bootstrap.dataDir;
    ctx.version = bootstrap.version;
    ctx.hotkey = bootstrap.hotkey;
    ctx.ui.compact = Boolean(bootstrap.state.settings.compact);
    ctx.ui.clickThrough = Boolean(bootstrap.isClickThrough);
    ctx.ui.aiModels = [];
    ctx.ui.aiTest = null;
    const current = startOfWeekISO(todayISO());
    ctx.currentWeek = current;
    ctx.selectedWeek = current;
    ctx.ui.selectedWeek = current;
    setViewFromUrl();
    ctx.balance = computeBalance(ctx.state);
    initRollover();
    setupEvents();
    applyTheme();
    render();
    api.getLogin?.().then((result) => {
      if (!result?.ok || !ctx.state) return;
      const actual = Boolean(result.enabled);
      if (ctx.state.settings.launchAtLogin !== actual) {
        ctx.state.settings.launchAtLogin = actual;
        ctx.render();
        ctx.persist();
      }
    });
    let renderedDay = todayISO();
    setInterval(() => {
      if (!ctx.state) return;
      const nowDay = todayISO();
      if (nowDay === renderedDay) return;
      renderedDay = nowDay;
      const nextWeek = startOfWeekISO(nowDay);
      if (ctx.currentWeek !== nextWeek) {
        const wasCurrent = ctx.ui.selectedWeek === ctx.currentWeek;
        ctx.currentWeek = nextWeek;
        if (wasCurrent) ctx.ui.selectedWeek = nextWeek;
      }
      render();
    }, 30_000);
    bootEl.classList.add('is-hidden');
    setTimeout(() => bootEl.remove(), 320);
  } catch (error) {
    console.error(error);
    bootEl.innerHTML = `<p>周流启动失败：${escapeHtml(error.message || error)}</p>`;
  }
}

Object.assign(ctx, {
  applyTheme,
  render,
  persist,
  commit,
  showToast,
  dismissToast,
  openModal,
  closeModal,
  renderOverlayOnly,
  navigate,
  openConfirm,
  clearDrawTimer,
  syncPrizeDraft,
});

// Used by the screenshot harness and for quick manual inspection.
window.__weekflowSetView = (view) => {
  if (['week', 'plans', 'rewards', 'redemptions', 'settings'].includes(view)) {
    ctx.ui.view = view;
    render();
  }
};

window.__weekflowSetCompact = (compact) => {
  ctx.ui.compact = Boolean(compact);
  render();
};

window.__weekflowCtx = ctx;
window.__weekflowActions = ACTIONS;

boot();
