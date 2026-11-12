import {
  addBonusTask,
  addHabit,
  addPool,
  addReward,
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
  deletePool,
  deleteProject,
  deleteReward,
  deleteTask,
  drawPool,
  getBonusTask,
  getHabit,
  getPool,
  getProject,
  getRedemption,
  getReward,
  getTask,
  habitCompletion,
  markRedemptionUsed,
  moveOverdueToWeek,
  projectStats,
  projectTasks,
  redeemReward,
  startOfWeekISO,
  todayISO,
  uid,
  uncompleteBonusTask,
  uncompleteHabit,
  uncompleteTask,
  unmarkRedemptionUsed,
  updateBonusTask,
  updateHabit,
  updatePool,
  updateReward,
  updateTask,
} from '../shared/domain.js';
import { createDemoState } from '../shared/demo.js';
import { AI_PRESETS, THEMES } from '../shared/defaults.js';
import { normalizeBaseUrl as parseBaseUrl } from '../shared/planner.js';

function runUndoable(ctx, mutator, message, options = {}) {
  const snapshot = structuredClone(ctx.state);
  let result;
  try {
    result = mutator(ctx.state);
  } catch (error) {
    ctx.showToast(error.message || String(error));
    return null;
  }
  if (result && result.ok === false) {
    ctx.showToast(result.error || '操作没有完成');
    return null;
  }
  if (ctx.ui.modal && options.keepModal !== true) ctx.closeModal();
  ctx.render();
  ctx.persist();
  const text = typeof message === 'function' ? message(result) : message;
  if (text) {
    ctx.showToast(text, {
      action: options.undo === false
        ? null
        : {
            label: '撤销',
            onClick: () => {
              ctx.state = snapshot;
              ctx.render();
              ctx.persist();
              ctx.showToast('已撤销');
            },
          },
      timeout: options.timeout || 6500,
    });
  }
  return result;
}

function setModalError(ctx, message) {
  if (!ctx.ui.modal) return;
  ctx.ui.modal.error = message;
  ctx.renderOverlayOnly();
}

function openTaskEditor(ctx, { taskId = null, projectId = null } = {}) {
  const task = taskId ? getTask(ctx.state, taskId) : null;
  ctx.openModal({
    type: 'task-editor',
    taskId,
    draft: task
      ? {
          title: task.title,
          detail: task.detail,
          projectId: task.projectId || '',
          weekStart: task.weekStart,
          points: task.points,
          estimateMin: task.estimateMin,
          repeatWeekly: false,
          newProject: { title: '', weeks: 12 },
        }
      : {
          title: '',
          detail: '',
          projectId: projectId || '',
          weekStart: ctx.ui.selectedWeek || ctx.currentWeek,
          points: 15,
          newProject: { title: '', weeks: 12 },
          estimateMin: 60,
          repeatWeekly: false,
        },
    error: null,
  });
}

function openHabitEditor(ctx, habitId = null) {
  const habit = habitId ? getHabit(ctx.state, habitId) : null;
  ctx.openModal({
    type: 'habit-editor',
    habitId,
    draft: habit
      ? {
          title: habit.title,
          detail: habit.detail,
          icon: habit.icon,
          points: habit.points,
        }
      : { title: '', detail: '', icon: '🏃', points: 10 },
    error: null,
  });
}

function openBonusEditor(ctx, bonusId = null) {
  const bonus = bonusId ? getBonusTask(ctx.state, bonusId) : null;
  ctx.openModal({
    type: 'bonus-editor',
    bonusId,
    draft: bonus
      ? {
          title: bonus.title,
          detail: bonus.detail,
          icon: bonus.icon,
          points: bonus.points,
        }
      : { title: '', detail: '', icon: '✨', points: 100 },
    error: null,
  });
}

function openRewardEditor(ctx, rewardId = null) {
  const reward = rewardId ? getReward(ctx.state, rewardId) : null;
  ctx.openModal({
    type: 'reward-editor',
    rewardId,
    draft: reward
      ? { title: reward.title, cost: reward.cost, icon: reward.icon, note: reward.note }
      : { title: '', cost: 50, icon: '🎁', note: '' },
    error: null,
  });
}

function newPoolDraft() {
  return {
    title: '',
    subtitle: '大概率空手而归，小概率带走一大笔。',
    icon: '🌌',
    cost: 100,
    prizes: [
      { label: '空手而归', weight: 65, points: 0 },
      { label: '回一点血', weight: 20, points: 20 },
      { label: '小小惊喜', weight: 9, points: 80 },
      { label: '今晚走运', weight: 4, points: 300 },
      { label: '深空回响', weight: 1.5, points: 1500 },
      { label: '传说级大奖', weight: 0.5, points: 8888 },
    ],
  };
}

function poolToDraft(pool) {
  return {
    title: pool.title,
    subtitle: pool.subtitle,
    icon: pool.icon,
    cost: pool.cost,
    prizes: pool.prizes.map((prize) => ({
      label: prize.label,
      weight: prize.weight,
      points: prize.points,
    })),
  };
}

function openPoolEditor(ctx, poolId = null) {
  const pool = poolId ? getPool(ctx.state, poolId) : null;
  ctx.openModal({
    type: 'pool-editor',
    poolId,
    draft: pool ? poolToDraft(pool) : newPoolDraft(),
    error: null,
  });
}

function openPlanWizard(ctx, prefill = {}) {
  ctx.openModal({
    type: 'plan-wizard',
    step: 'form',
    draft: {
      goal: prefill.goal || '',
      weeks: prefill.weeks || 12,
      hoursPerWeek: 5,
      level: '入门',
      notes: prefill.notes || '',
      startDate: todayISO(),
    },
    plan: null,
    source: 'ai',
    error: null,
  });
}

function openManualPlan(ctx, prefill = {}) {
  const weeks = Number(prefill.weeks) || 8;
  ctx.openModal({
    type: 'manual-plan',
    draft: {
      title: prefill.title || '',
      goal: prefill.goal || '',
      startDate: todayISO(),
      weeks,
      weekPlans: Array.from({ length: weeks }, (_, index) => ({
        theme: prefill.weekThemes?.[index] || '',
        text: prefill.weekTexts?.[index] || '',
      })),
    },
    error: null,
  });
}

function parseManualWeeks(draft) {
  const weeks = Math.max(1, Math.min(52, Number(draft.weeks) || draft.weekPlans.length));
  const plans = [];
  let totalTasks = 0;
  for (let index = 0; index < weeks; index += 1) {
    const week = draft.weekPlans[index] || { theme: '', text: '' };
    const lines = String(week.text || '')
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*]\s*/, ''))
      .filter(Boolean);
    if (lines.length > 8) {
      throw new Error(`第 ${index + 1} 周最多 8 件任务，建议只留 2–4 件`);
    }
    const tasks = lines.map((line) => {
      const parts = line.split(/[|｜]/).map((part) => part.trim());
      let points = 15;
      if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
        points = Number(parts.pop());
      }
      if (points < 1 || points > 500) {
        throw new Error(`第 ${index + 1} 周有一件任务的积分不在 1–500 之间`);
      }
      const title = parts.join(' | ').trim();
      if (!title) throw new Error(`第 ${index + 1} 周有一行只写了积分，没有任务名`);
      return {
        title,
        detail: '',
        points,
        estimateMin: 60,
      };
    });
    totalTasks += tasks.length;
    plans.push({ theme: String(week.theme || '').trim(), tasks });
  }
  if (totalTasks === 0) throw new Error('至少给某一周写一件任务');
  if (totalTasks > 120) throw new Error('任务太多了，先控制在 120 件以内');
  return plans;
}

function planStats(plan) {
  return plan.weeks.reduce(
    (acc, week) => {
      acc.tasks += week.tasks.length;
      acc.points += week.tasks.reduce((sum, task) => sum + task.points, 0);
      return acc;
    },
    { tasks: 0, points: 0 },
  );
}

function startDraw(ctx, poolId) {
  const pool = getPool(ctx.state, poolId);
  if (!pool) return;
  const balance = computeBalance(ctx.state);
  if (balance < pool.cost) {
    ctx.showToast(`还差 ${pool.cost - balance} 积分`);
    return;
  }
  if (ctx.ui.drawTimer) ctx.clearDrawTimer();
  ctx.ui.modal = {
    type: 'draw',
    poolId,
    phase: 'spinning',
    balance,
  };
  ctx.renderOverlayOnly();
  const labels = pool.prizes.map((prize) => prize.label);
  let index = 0;
  const reel = document.getElementById('draw-reel');
  if (reel) reel.textContent = labels[0] || '···';
  const interval = setInterval(() => {
    const element = document.getElementById('draw-reel');
    if (!element) return;
    index = (index + 1) % labels.length;
    element.textContent = labels[index];
  }, 90);
  const duration = ctx.state.settings.reduceMotion ? 200 : 1600;
  const timeout = setTimeout(() => {
    clearInterval(interval);
    const snapshot = structuredClone(ctx.state);
    const result = drawPool(ctx.state, poolId);
    if (!result.ok) {
      ctx.closeModal();
      ctx.showToast(result.error || '抽奖失败');
      return;
    }
    ctx.ui.drawTimer = null;
    ctx.ui.modal = {
      type: 'draw',
      poolId,
      phase: 'result',
      draw: result.draw,
      prize: result.prize,
      balance: result.balance,
    };
    ctx.render();
    ctx.persist();
    if (result.prize.points >= 1000) launchConfetti(ctx);
    // Keep the snapshot referenced for debugging without offering a lottery undo.
    void snapshot;
  }, duration);
  ctx.ui.drawTimer = { interval, timeout };
}

function launchConfetti(ctx) {
  if (ctx.state.settings.reduceMotion) return;
  const layer = document.getElementById('confetti');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#E7B87C', '#9DB8A0', '#9AA9D6', '#D79A9A', '#F2EDE4'];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--fall-duration', `${1.4 + Math.random() * 1.4}s`);
    piece.style.setProperty('--fall-delay', `${Math.random() * 340}ms`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
    piece.style.width = `${3 + Math.random() * 4}px`;
    piece.style.height = `${6 + Math.random() * 7}px`;
    layer.appendChild(piece);
  }
  setTimeout(() => {
    layer.innerHTML = '';
  }, 3000);
}

function syncAiConfig(ctx) {
  const config = ctx.state.settings.ai;
  try {
    return { ...config, baseUrl: parseBaseUrl(config.baseUrl) };
  } catch (error) {
    ctx.showToast(error.message);
    return null;
  }
}

export const ACTIONS = {
  'copy-text': async (ctx, el) => {
    const text = el.dataset.copy || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    ctx.showToast(text.startsWith('BV') ? `已复制 ${text}` : '已复制链接');
  },
  'navigate': (ctx, el) => {
    ctx.navigate(el.dataset.view);
  },
  'go-plans': (ctx) => ctx.navigate('plans'),
  'go-rewards': (ctx) => ctx.navigate('rewards'),
  'go-redemptions': (ctx) => ctx.navigate('redemptions'),
  'go-ai-settings': (ctx) => {
    ctx.closeModal();
    ctx.ui.aiOpen = true;
    ctx.navigate('settings');
  },
  'toggle-nav': (ctx) => {
    ctx.ui.navOpen = !ctx.ui.navOpen;
    ctx.ui.quickPanel = null;
    ctx.render();
  },
  'toggle-appearance': (ctx) => {
    ctx.ui.quickPanel = ctx.ui.quickPanel === 'appearance' ? null : 'appearance';
    ctx.ui.navOpen = false;
    ctx.render();
  },
  'close-appearance': (ctx) => {
    ctx.ui.quickPanel = null;
    ctx.render();
  },
  'appearance-settings': (ctx) => {
    ctx.ui.quickPanel = null;
    ctx.navigate('settings');
  },
  'set-opacity': (ctx, el) => {
    const value = Math.max(45, Math.min(100, Number(el.dataset.value) || 72));
    ctx.state.settings.panelOpacity = value / 100;
    ctx.applyTheme();
    const slider = document.querySelector('[data-range="panelOpacity"]');
    if (slider) slider.value = String(value / 100);
    const quickLabel = document.getElementById('quick-opacity-value');
    if (quickLabel) quickLabel.textContent = `${value}%`;
    const settingsLabel = document.getElementById('panel-opacity-value');
    if (settingsLabel) settingsLabel.textContent = `${value}%`;
    document.querySelectorAll('.opacity-presets .chip').forEach((chip) => {
      chip.classList.toggle('active', Number(chip.dataset.value) === value);
    });
    ctx.persist();
  },
  'set-theme': (ctx, el) => {
    const theme = THEMES.find((item) => item.id === el.dataset.theme);
    if (!theme) return;
    ctx.state.settings.theme = theme.id;
    ctx.state.settings.accent = theme.accent;
    ctx.applyTheme();
    ctx.render();
    ctx.persist();
  },

  'prev-week': (ctx) => {
    ctx.ui.selectedWeek = addWeeksISO(ctx.ui.selectedWeek, -1);
    ctx.render();
  },
  'next-week': (ctx) => {
    ctx.ui.selectedWeek = addWeeksISO(ctx.ui.selectedWeek, 1);
    ctx.render();
  },
  'this-week': (ctx) => {
    ctx.ui.selectedWeek = ctx.currentWeek;
    ctx.render();
  },
  'toggle-done': (ctx) => {
    ctx.ui.showDone = !ctx.ui.showDone;
    ctx.render();
  },
  'dismiss-rollover': (ctx) => {
    ctx.ui.rollover = null;
    ctx.render();
  },
  'rollover-catchup': (ctx) => {
    const current = startOfWeekISO(todayISO());
    ctx.ui.rollover = null;
    runUndoable(
      ctx,
      (state) => moveOverdueToWeek(state, current),
      (result) => `已把 ${result?.moved || 0} 件并入本周，下周会更满一点`,
    );
  },
  'catch-up-overdue': (ctx) => {
    runUndoable(
      ctx,
      (state) => moveOverdueToWeek(state, ctx.currentWeek),
      (result) => (result?.moved ? `已把 ${result.moved} 件补齐到本周` : '没有需要补的任务'),
    );
  },

  'toggle-bonus': (ctx, el) => {
    const bonus = getBonusTask(ctx.state, el.dataset.id);
    if (!bonus) return;
    if (bonus.status === 'done') {
      const result = uncompleteBonusTask(ctx.state, bonus.id);
      if (!result.ok) {
        ctx.showToast(result.error);
        return;
      }
      ctx.closeModal();
      ctx.render();
      ctx.persist();
      ctx.showToast('已撤销完成，积分也退回了');
      return;
    }
    const result = completeBonusTask(ctx.state, bonus.id);
    if (!result.ok) {
      ctx.showToast(result.error);
      return;
    }
    ctx.closeModal();
    ctx.render();
    ctx.persist();
    ctx.showToast(`+${result.points} 分 · 待办完成`, {
      action: {
        label: '撤销',
        onClick: () => {
          const undone = uncompleteBonusTask(ctx.state, bonus.id);
          if (!undone.ok) {
            ctx.showToast(undone.error);
            return;
          }
          ctx.render();
          ctx.persist();
          ctx.showToast('已撤销');
        },
      },
    });
  },
  'new-bonus': (ctx) => openBonusEditor(ctx),
  'edit-bonus': (ctx, el) => openBonusEditor(ctx, el.dataset.id),
  'pick-bonus-template': (ctx, el) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    draft.points = Number(el.dataset.points) || 100;
    ctx.renderOverlayOnly();
  },
  'delete-bonus': (ctx, el) => {
    const bonus = getBonusTask(ctx.state, el.dataset.id);
    if (!bonus) return;
    ctx.openConfirm({
      title: `删除「${bonus.title}」？`,
      eyebrow: 'Delete todo',
      message: '这是一件待办，删除后不会影响周计划；完成过的积分记录会一起移除。',
      confirmLabel: '删除',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deleteBonusTask(state, bonus.id);
          },
          `已删除「${bonus.title}」`,
        );
      },
    });
  },
  'submit:bonus-form': (ctx) => {
    const modal = ctx.ui.modal;
    const draft = modal?.draft;
    if (!draft) return;
    const title = String(draft.title || '').trim();
    if (!title) {
      setModalError(ctx, '先写下这件待办');
      return;
    }
    const points = Math.round(Number(draft.points) || 0);
    if (points < 1 || points > 10_000) {
      setModalError(ctx, '积分需要在 1 到 10000 之间');
      return;
    }
    try {
      if (modal.bonusId) {
        const existing = getBonusTask(ctx.state, modal.bonusId);
        updateBonusTask(ctx.state, modal.bonusId, {
          title,
          detail: draft.detail,
          icon: draft.icon,
          points: existing?.status === 'done' ? undefined : points,
        });
      } else {
        addBonusTask(ctx.state, {
          title,
          detail: draft.detail,
          icon: draft.icon,
          points,
        });
      }
      ctx.closeModal();
      ctx.render();
      ctx.persist();
      ctx.showToast(modal.bonusId ? '待办已更新' : `待办已加入，完成可得 ${points} 分`);
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },

  'toggle-habit': (ctx, el) => {
    const habit = getHabit(ctx.state, el.dataset.id);
    if (!habit) return;
    const today = todayISO();
    const existing = habitCompletion(ctx.state, habit.id, today);
    if (existing) {
      const result = uncompleteHabit(ctx.state, habit.id, today);
      if (!result.ok) {
        ctx.showToast(result.error);
        return;
      }
      ctx.render();
      ctx.persist();
      ctx.showToast('已撤销今天的完成');
      return;
    }
    ctx.ui.justHabit = habit.id;
    const result = completeHabit(ctx.state, habit.id, today);
    if (!result.ok) {
      ctx.showToast(result.error);
      return;
    }
    ctx.render();
    ctx.persist();
    ctx.showToast(`+${result.points} 分 · ${habit.title}，今天也做到了`, {
      action: {
        label: '撤销',
        onClick: () => {
          const undone = uncompleteHabit(ctx.state, habit.id, today);
          if (!undone.ok) {
            ctx.showToast(undone.error);
            return;
          }
          ctx.render();
          ctx.persist();
          ctx.showToast('已撤销');
        },
      },
    });
    setTimeout(() => {
      ctx.ui.justHabit = null;
    }, 700);
  },
  'new-habit': (ctx) => openHabitEditor(ctx),
  'quick-habit': (ctx, el) => {
    try {
      const habit = addHabit(ctx.state, {
        title: el.dataset.title,
        points: Number(el.dataset.points) || 10,
        icon: el.dataset.icon || '',
      });
      ctx.render();
      ctx.persist();
      ctx.showToast(`已加入每日：${habit.title}`, {
        action: {
          label: '撤销',
          onClick: () => {
            deleteHabit(ctx.state, habit.id);
            ctx.render();
            ctx.persist();
            ctx.showToast('已撤销');
          },
        },
      });
    } catch (error) {
      ctx.showToast(error.message);
    }
  },
  'habit-actions': (ctx, el) => {
    ctx.openModal({ type: 'habit-actions', habitId: el.dataset.id });
  },
  'manage-habits': (ctx) => {
    ctx.openModal({ type: 'habit-manager' });
  },
  'edit-habit': (ctx, el) => openHabitEditor(ctx, el.dataset.id),
  'pick-habit-template': (ctx, el) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    draft.title = el.dataset.title;
    draft.icon = el.dataset.icon;
    draft.points = Number(el.dataset.points) || 10;
    ctx.renderOverlayOnly({ focus: true });
  },
  'submit:habit-form': (ctx) => {
    const modal = ctx.ui.modal;
    const draft = modal?.draft;
    if (!draft) return;
    const title = String(draft.title || '').trim();
    if (!title) {
      setModalError(ctx, '先写下每天要做的事');
      return;
    }
    const points = Math.round(Number(draft.points) || 10);
    if (points < 1 || points > 100) {
      setModalError(ctx, '每日积分需要在 1 到 100 之间');
      return;
    }
    try {
      if (modal.habitId) {
        updateHabit(ctx.state, modal.habitId, {
          title,
          detail: draft.detail,
          icon: draft.icon,
          points,
        });
        ctx.closeModal();
        ctx.render();
        ctx.persist();
        ctx.showToast('每日任务已更新');
      } else {
        addHabit(ctx.state, {
          title,
          detail: draft.detail,
          icon: draft.icon,
          points,
        });
        ctx.closeModal();
        ctx.render();
        ctx.persist();
        ctx.showToast('已加入每日任务，明天还会出现');
      }
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },
  'delete-habit': (ctx, el) => {
    const habit = getHabit(ctx.state, el.dataset.id);
    if (!habit) return;
    ctx.openConfirm({
      title: `删除「${habit.title}」？`,
      eyebrow: 'Delete daily',
      message: '它会从每天的清单里消失，历史完成记录和对应积分也会一起删除。可在提示里撤销。',
      confirmLabel: '删除每日任务',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deleteHabit(state, habit.id);
          },
          '每日任务已删除',
        );
      },
    });
  },

  'toggle-task': (ctx, el) => {
    const task = getTask(ctx.state, el.dataset.id);
    if (!task) return;
    if (task.status === 'done') {
      const result = uncompleteTask(ctx.state, task.id);
      if (!result.ok) {
        ctx.showToast(result.error);
        return;
      }
      ctx.closeModal();
      ctx.render();
      ctx.persist();
      ctx.showToast('已撤销完成，积分也退回了');
      return;
    }
    ctx.ui.justDone = task.id;
    const result = completeTask(ctx.state, task.id);
    if (!result.ok) {
      ctx.showToast(result.error);
      return;
    }
    ctx.closeModal();
    ctx.render();
    ctx.persist();
    ctx.showToast(`+${task.points} 分 · 收下一件`, {
      action: {
        label: '撤销',
        onClick: () => {
          const undone = uncompleteTask(ctx.state, task.id);
          if (!undone.ok) {
            ctx.showToast(undone.error);
            return;
          }
          ctx.render();
          ctx.persist();
          ctx.showToast('已撤销');
        },
      },
    });
    setTimeout(() => {
      ctx.ui.justDone = null;
    }, 700);
  },

  'task-actions': (ctx, el) => {
    ctx.openModal({ type: 'task-actions', taskId: el.dataset.id });
  },
  'new-task': (ctx, el) => {
    openTaskEditor(ctx, { projectId: el?.dataset?.projectId || null });
  },
  'task-new-project': (ctx) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    draft.projectId = '__new__';
    draft.newProject = draft.newProject || { title: '', weeks: 12 };
    ctx.renderOverlayOnly({ focus: true });
  },
  'edit-task': (ctx, el) => {
    openTaskEditor(ctx, { taskId: el.dataset.id });
  },
  'delete-task': (ctx, el) => {
    const task = getTask(ctx.state, el.dataset.id);
    if (!task) return;
    ctx.openConfirm({
      title: '删除这件任务？',
      eyebrow: 'Delete',
      message: `「${task.title}」会从这一周消失。完成后可以在提示里撤销。`,
      confirmLabel: '删除',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deleteTask(state, task.id);
          },
          `已删除「${task.title}」`,
        );
      },
    });
  },
  'defer-single-task': (ctx, el) => {
    const task = getTask(ctx.state, el.dataset.id);
    if (!task) return;
    const mode = el.dataset.mode;
    runUndoable(
      ctx,
      (state) =>
        deferSingleTask(
          state,
          { taskId: task.id, fromWeek: ctx.ui.selectedWeek, mode },
          new Date(),
        ),
      (outcome) =>
        mode === 'shift'
          ? '只把这件任务顺延了一周'
          : `只把这件任务压到下周${outcome?.nextWeekLoad ? `（下周同项目共 ${outcome.nextWeekLoad} 件）` : ''}`,
      { timeout: 7500 },
    );
  },
  'defer-task': (ctx, el) => {
    const task = getTask(ctx.state, el.dataset.id);
    if (!task) return;
    const mode = el.dataset.mode;
    const fromWeek = task.weekStart > ctx.ui.selectedWeek ? task.weekStart : ctx.ui.selectedWeek;
    runUndoable(
      ctx,
      (state) =>
        deferTasks(
          state,
          { taskId: task.id, fromWeek, mode },
          new Date(),
        ),
      (outcome) =>
        mode === 'shift'
          ? `已整体顺延一周（${outcome?.moved || 1} 件）`
          : `已压到下周（${outcome?.nextWeekLoad || outcome?.moved || 1} 件在下周）`,
      { timeout: 7500 },
    );
  },

  'submit:task-form': (ctx, form) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    const title = String(draft.title || '').trim();
    if (!title) {
      setModalError(ctx, '先写下要做的事');
      return;
    }
    const points = Math.round(Number(draft.points) || 15);
    if (points < 1 || points > 500) {
      setModalError(ctx, '积分需要在 1 到 500 之间');
      return;
    }
    const estimateMin = Math.max(0, Math.round(Number(draft.estimateMin) || 0));
    if (draft.projectId === '__new__' && !String(draft.newProject?.title || '').trim()) {
      setModalError(ctx, '给新项目起个名字');
      return;
    }
    let createdProject = null;
    try {
      let projectId = draft.projectId === '__new__' ? null : draft.projectId || null;
      if (draft.projectId === '__new__') {
        createdProject = createProject(ctx.state, {
          title: draft.newProject.title,
          startDate: draft.weekStart,
          weeks: Number(draft.newProject.weeks) || 12,
        });
        projectId = createdProject.id;
      }
      if (ctx.ui.modal.taskId) {
        const task = updateTask(ctx.state, ctx.ui.modal.taskId, {
          title,
          detail: draft.detail,
          projectId,
          weekStart: draft.weekStart,
          points,
          estimateMin,
        });
        ctx.closeModal();
        ctx.ui.selectedWeek = task.weekStart;
        ctx.render();
        ctx.persist();
        ctx.showToast(createdProject ? `已创建「${createdProject.title}」并更新任务` : '任务已更新');
      } else {
        const project = projectId ? getProject(ctx.state, projectId) : null;
        let repeatCount = 1;
        if (draft.repeatWeekly) {
          if (project) {
            const projectEnd = addWeeksISO(project.startDate, project.plannedWeeks - 1);
            let cursor = addWeeksISO(draft.weekStart, 1);
            while (cursor <= projectEnd && repeatCount < 52) {
              repeatCount += 1;
              cursor = addWeeksISO(cursor, 1);
            }
          } else {
            repeatCount = 12;
          }
        }
        const seriesId = draft.repeatWeekly && repeatCount > 1 ? uid('sr') : null;
        const created = [];
        for (let index = 0; index < repeatCount; index += 1) {
          const task = createTask(ctx.state, {
            title,
            detail: draft.detail,
            projectId,
            weekStart: addWeeksISO(draft.weekStart, index),
            points,
            estimateMin,
          });
          if (seriesId) {
            task.seriesId = seriesId;
            task.recurring = true;
          }
          created.push(task);
        }
        ctx.closeModal();
        ctx.ui.selectedWeek = created[0].weekStart;
        ctx.ui.view = 'week';
        ctx.render();
        ctx.persist();
        const taskMessage = seriesId
          ? `已加入 ${created.length} 周（每周重复）`
          : '已放进这一周';
        ctx.showToast(
          createdProject ? `已创建「${createdProject.title}」，${taskMessage}` : taskMessage,
          {
            action: {
              label: '撤销',
              onClick: () => {
                if (createdProject) deleteProject(ctx.state, createdProject.id);
                else for (const task of created) deleteTask(ctx.state, task.id);
                ctx.render();
                ctx.persist();
                ctx.showToast('已撤销');
              },
            },
          },
        );
      }
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },

  'new-project': (ctx) => {
    ctx.openModal({
      type: 'project-editor',
      draft: {
        title: '',
        goal: '',
        startDate: todayISO(),
        weeks: 12,
      },
      error: null,
    });
  },
  'submit:project-form': (ctx) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    try {
      const project = createProject(ctx.state, {
        title: draft.title,
        goal: draft.goal,
        startDate: draft.startDate,
        weeks: Number(draft.weeks),
      });
      ctx.closeModal();
      ctx.ui.view = 'plans';
      ctx.ui.expandedProjects.add(project.id);
      ctx.render();
      ctx.persist();
      ctx.showToast('项目建好了，接下来按周加任务');
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },

  'toggle-project': (ctx, el) => {
    const id = el.dataset.id;
    if (ctx.ui.expandedProjects.has(id)) ctx.ui.expandedProjects.delete(id);
    else ctx.ui.expandedProjects.add(id);
    ctx.render();
  },
  'project-actions': (ctx, el) => {
    ctx.openModal({ type: 'project-actions', projectId: el.dataset.id });
  },
  'shift-project': (ctx, el) => {
    const project = getProject(ctx.state, el.dataset.id);
    if (!project) return;
    const remaining = projectTasks(ctx.state, project.id).filter((task) => task.status !== 'done');
    if (!remaining.length) {
      ctx.showToast('这个项目已经没有未完成任务了');
      return;
    }
    ctx.openConfirm({
      title: `让「${project.title}」整体后移一周？`,
      eyebrow: 'Shift',
      message: `${remaining.length} 件未完成任务会全部后移 7 天。每周节奏不变，项目结束时间也会顺延。`,
      confirmLabel: '后移一周',
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) =>
            deferTasks(
              state,
              { taskId: remaining[0].id, fromWeek: ctx.ui.selectedWeek, mode: 'shift' },
              new Date(),
            ),
          (result) => `已整体后移一周（${result?.moved || 0} 件）`,
          { timeout: 7500 },
        );
      },
    });
  },
  'delete-project': (ctx, el) => {
    const project = getProject(ctx.state, el.dataset.id);
    if (!project) return;
    const stats = projectStats(ctx.state, project.id);
    ctx.openConfirm({
      title: `删除「${project.title}」？`,
      eyebrow: 'Delete project',
      message: `连同 ${stats.total} 件任务一起删除。可以在提示里撤销，但请确认不是手滑。`,
      confirmLabel: '删除项目',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deleteProject(state, project.id);
          },
          `已删除项目「${project.title}」`,
        );
      },
    });
  },

  'open-plan-wizard': (ctx) => openPlanWizard(ctx),
  'open-manual-plan': (ctx, el) => {
    const project = el?.dataset?.id ? getProject(ctx.state, el.dataset.id) : null;
    const wizard = ctx.ui.modal?.type === 'plan-wizard' ? ctx.ui.modal.draft : null;
    openManualPlan(ctx, {
      title: project?.title || '',
      goal: project?.goal || wizard?.goal || '',
      weeks: project?.plannedWeeks || Number(wizard?.weeks) || 8,
    });
  },
  'manual-weeks-change': (ctx, el) => {
    const draft = ctx.ui.modal?.draft;
    if (!draft) return;
    const next = Math.max(1, Math.min(52, Number(el.value) || 8));
    const current = draft.weekPlans || [];
    draft.weeks = next;
    draft.weekPlans = Array.from({ length: next }, (_, index) =>
      current[index] || { theme: '', text: '' },
    );
    ctx.renderOverlayOnly();
  },
  'submit:manual-plan-form': (ctx) => {
    const modal = ctx.ui.modal;
    const draft = modal?.draft;
    if (!draft) return;
    const title = String(draft.title || '').trim();
    if (!title) {
      setModalError(ctx, '先给这个计划起个名字');
      return;
    }
    let weekPlans;
    try {
      weekPlans = parseManualWeeks(draft);
    } catch (error) {
      setModalError(ctx, error.message);
      return;
    }
    const snapshot = structuredClone(ctx.state);
    try {
      const project = createManualProject(ctx.state, {
        title,
        goal: draft.goal,
        startDate: draft.startDate || todayISO(),
        weeks: Number(draft.weeks) || weekPlans.length,
        weekPlans,
      });
      const stats = projectStats(ctx.state, project.id);
      ctx.closeModal();
      ctx.ui.view = 'plans';
      ctx.ui.expandedProjects.add(project.id);
      ctx.ui.selectedWeek = startOfWeekISO(draft.startDate || todayISO());
      ctx.render();
      ctx.persist();
      ctx.showToast(`手动计划已创建：${stats.total} 件，分布在 ${weekPlans.length} 周`, {
        action: {
          label: '撤销',
          onClick: () => {
            ctx.state = snapshot;
            ctx.render();
            ctx.persist();
            ctx.showToast('已撤销');
          },
        },
        timeout: 8000,
      });
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },
  'open-plan-wizard-for-project': (ctx, el) => {
    const project = getProject(ctx.state, el.dataset.id);
    openPlanWizard(ctx, {
      goal: project?.goal || project?.title || '',
      weeks: project?.plannedWeeks || 12,
    });
  },
  'offline-plan': (ctx) => {
    const modal = ctx.ui.modal;
    if (!modal?.draft) return;
    const plan = createBlankPlan({
      goal: String(modal.draft.goal || '').trim() || '新目标',
      weeks: Number(modal.draft.weeks) || 12,
      startDate: modal.draft.startDate || todayISO(),
    });
    ctx.ui.modal = {
      ...modal,
      step: 'preview',
      plan,
      source: 'template',
      error: null,
    };
    ctx.renderOverlayOnly({ focus: true });
  },
  'submit:plan-form': async (ctx) => {
    const modal = ctx.ui.modal;
    if (!modal?.draft) return;
    const goal = String(modal.draft.goal || '').trim();
    if (goal.length < 2) {
      modal.error = '先写下你想完成什么，哪怕只有一句话';
      ctx.renderOverlayOnly();
      return;
    }
    const config = ctx.state.settings.ai;
    if (!config.model || !config.baseUrl) {
      modal.error = '还没有配置 AI。可以在设置里连接 Ollama / LM Studio，或先用离线模板。';
      ctx.renderOverlayOnly();
      return;
    }
    try {
      parseBaseUrl(config.baseUrl);
    } catch (error) {
      modal.error = error.message;
      ctx.renderOverlayOnly();
      return;
    }
    const token = ++ctx.ui.planToken;
    modal.step = 'loading';
    modal.error = null;
    ctx.renderOverlayOnly();
    const result = await ctx.api.planAI(config, {
      goal,
      weeks: Number(modal.draft.weeks) || 12,
      hoursPerWeek: Number(modal.draft.hoursPerWeek) || 5,
      level: modal.draft.level,
      notes: modal.draft.notes,
      startDate: modal.draft.startDate || todayISO(),
    });
    if (token !== ctx.ui.planToken || !ctx.ui.modal || ctx.ui.modal.type !== 'plan-wizard') return;
    if (!result.ok) {
      ctx.ui.modal.step = 'form';
      ctx.ui.modal.error = result.error;
      ctx.renderOverlayOnly();
      return;
    }
    ctx.ui.modal.step = 'preview';
    ctx.ui.modal.plan = result.plan;
    ctx.ui.modal.source = 'ai';
    ctx.ui.modal.error = null;
    ctx.renderOverlayOnly({ focus: true });
  },
  'plan-back': (ctx) => {
    if (!ctx.ui.modal) return;
    ctx.ui.modal.step = 'form';
    ctx.ui.modal.error = null;
    ctx.renderOverlayOnly({ focus: true });
  },
  'cancel-plan': (ctx) => {
    ctx.ui.planToken += 1;
    ctx.closeModal();
  },
  'plan-confirm': (ctx) => {
    const modal = ctx.ui.modal;
    if (!modal?.plan) return;
    const snapshot = structuredClone(ctx.state);
    try {
      const project = createProjectFromPlan(
        ctx.state,
        modal.plan,
        {
          startDate: modal.draft.startDate || todayISO(),
          source: modal.source,
        },
        new Date(),
      );
      const stats = projectStats(ctx.state, project.id);
      ctx.closeModal();
      ctx.ui.view = 'plans';
      ctx.ui.expandedProjects.add(project.id);
      ctx.ui.selectedWeek = startOfWeekISO(modal.draft.startDate || todayISO());
      ctx.render();
      ctx.persist();
      ctx.showToast(`已加入蓝图：${stats.total} 件，分布在 ${modal.plan.weeks.length} 周`, {
        action: {
          label: '撤销',
          onClick: () => {
            ctx.state = snapshot;
            ctx.render();
            ctx.persist();
            ctx.showToast('已撤销');
          },
        },
        timeout: 8000,
      });
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },

  'new-reward': (ctx) => openRewardEditor(ctx),
  'use-redemption': (ctx, el) => {
    const redemption = getRedemption(ctx.state, el.dataset.id);
    if (!redemption) return;
    const wasUsed = Boolean(redemption.usedAt);
    runUndoable(
      ctx,
      (state) =>
        wasUsed
          ? unmarkRedemptionUsed(state, redemption.id)
          : markRedemptionUsed(state, redemption.id),
      wasUsed ? `已撤销核销「${redemption.title}」` : `已核销「${redemption.title}」`,
      { timeout: 6500 },
    );
  },
  'edit-reward': (ctx, el) => openRewardEditor(ctx, el.dataset.id),
  'pick-emoji': (ctx, el) => {
    if (!ctx.ui.modal?.draft) return;
    ctx.ui.modal.draft.icon = el.dataset.emoji;
    ctx.renderOverlayOnly({ focus: true });
  },
  'submit:reward-form': (ctx) => {
    const modal = ctx.ui.modal;
    if (!modal?.draft) return;
    try {
      if (modal.rewardId) {
        updateReward(ctx.state, modal.rewardId, modal.draft);
        ctx.closeModal();
        ctx.render();
        ctx.persist();
        ctx.showToast('奖励已更新');
      } else {
        addReward(ctx.state, modal.draft);
        ctx.closeModal();
        ctx.render();
        ctx.persist();
        ctx.showToast('奖励已加入清单');
      }
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },
  'delete-reward': (ctx, el) => {
    const reward = getReward(ctx.state, el.dataset.id);
    if (!reward) return;
    ctx.openConfirm({
      title: `删除「${reward.title}」？`,
      eyebrow: 'Delete reward',
      message: '只会从兑换清单里移除，不会影响已经兑换过的记录。',
      confirmLabel: '删除',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deleteReward(state, reward.id);
          },
          '奖励已移除',
        );
      },
    });
  },
  'redeem-reward': (ctx, el) => {
    const reward = getReward(ctx.state, el.dataset.id);
    if (!reward) return;
    const balance = computeBalance(ctx.state);
    if (balance < reward.cost) {
      ctx.showToast(`还差 ${reward.cost - balance} 积分`);
      return;
    }
    ctx.openConfirm({
      title: `兑换「${reward.title}」？`,
      eyebrow: 'Redeem',
      message: `会花掉 ${reward.cost} 积分，剩下 ${balance - reward.cost} 分。兑换之后记得真的去做。`,
      confirmLabel: `花 ${reward.cost} 分`,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => redeemReward(state, reward.id),
          `兑换成功：${reward.title}`,
          { timeout: 8000 },
        );
      },
    });
  },

  'new-pool': (ctx) => openPoolEditor(ctx),
  'edit-pool': (ctx, el) => openPoolEditor(ctx, el.dataset.id),
  'add-prize': (ctx) => {
    ctx.syncPrizeDraft();
    if (!ctx.ui.modal?.draft) return;
    if (ctx.ui.modal.draft.prizes.length >= 12) {
      ctx.showToast('一个奖池最多 12 种结果');
      return;
    }
    ctx.ui.modal.draft.prizes.push({ label: '新结果', weight: 5, points: 0 });
    ctx.renderOverlayOnly();
  },
  'remove-prize': (ctx, el) => {
    ctx.syncPrizeDraft();
    if (!ctx.ui.modal?.draft) return;
    if (ctx.ui.modal.draft.prizes.length <= 2) {
      ctx.showToast('至少保留两个结果');
      return;
    }
    ctx.ui.modal.draft.prizes.splice(Number(el.dataset.index), 1);
    ctx.renderOverlayOnly();
  },
  'submit:pool-form': (ctx) => {
    ctx.syncPrizeDraft();
    const modal = ctx.ui.modal;
    if (!modal?.draft) return;
    const draft = modal.draft;
    if (!String(draft.title || '').trim()) {
      setModalError(ctx, '给奖池起个名字');
      return;
    }
    if (Number(draft.cost) < 1) {
      setModalError(ctx, '每次花费至少 1 分');
      return;
    }
    if (draft.prizes.some((prize) => !String(prize.label || '').trim())) {
      setModalError(ctx, '每个结果都需要名字');
      return;
    }
    if (
      draft.prizes.some((prize) => {
        const weight = Number(prize.weight);
        return !Number.isFinite(weight) || weight < 0.01 || weight > 100;
      })
    ) {
      setModalError(ctx, '权重需要是 0.01 到 100 之间的数字');
      return;
    }
    const payload = {
      title: draft.title,
      subtitle: draft.subtitle,
      icon: draft.icon,
      cost: Number(draft.cost),
      prizes: draft.prizes.map((prize) => ({
        label: prize.label,
        weight: Number(prize.weight),
        points: Number(prize.points),
      })),
    };
    try {
      if (modal.poolId) {
        updatePool(ctx.state, modal.poolId, payload);
      } else {
        addPool(ctx.state, payload);
      }
      ctx.closeModal();
      ctx.render();
      ctx.persist();
      ctx.showToast(modal.poolId ? '奖池已更新。' : '奖池已创建。概率是公开的，后果也是。');
    } catch (error) {
      setModalError(ctx, error.message);
    }
  },
  'delete-pool': (ctx, el) => {
    const pool = getPool(ctx.state, el.dataset.id);
    if (!pool) return;
    ctx.openConfirm({
      title: `删除「${pool.title}」？`,
      eyebrow: 'Delete pool',
      message: '奖池会消失，已经抽过的记录仍留在积分流水里。',
      confirmLabel: '删除奖池',
      danger: true,
      onConfirm: () => {
        runUndoable(
          ctx,
          (state) => {
            deletePool(state, pool.id);
          },
          '奖池已删除',
        );
      },
    });
  },
  'toggle-pool-odds': (ctx, el) => {
    const id = el.dataset.id;
    if (ctx.ui.expandedPools.has(id)) ctx.ui.expandedPools.delete(id);
    else ctx.ui.expandedPools.add(id);
    ctx.render();
  },
  'draw-pool': (ctx, el) => startDraw(ctx, el.dataset.id),
  'draw-again': (ctx, el) => startDraw(ctx, el.dataset.id),
  'rewards-tab': (ctx, el) => {
    ctx.ui.rewardsTab = el.dataset.tab;
    ctx.render();
  },
  'redemptions-tab': (ctx, el) => {
    ctx.ui.redemptionsTab = el.dataset.tab;
    ctx.render();
  },

  'toggle-compact': (ctx) => {
    if (ctx.ui.modal) ctx.closeModal();
    ctx.ui.navOpen = false;
    const next = !ctx.ui.compact;
    ctx.ui.compact = next;
    ctx.state.settings.compact = next;
    ctx.api.setCompact(next);
    ctx.render();
    ctx.persist();
  },
  'expand-compact': (ctx) => {
    ctx.ui.compact = false;
    ctx.state.settings.compact = false;
    ctx.api.setCompact(false);
    ctx.render();
    ctx.persist();
  },
  'toggle-ai-form': (ctx) => {
    ctx.ui.aiOpen = !ctx.ui.aiOpen;
    ctx.render();
  },
  'toggle-key': (ctx) => {
    ctx.ui.showKey = !ctx.ui.showKey;
    ctx.render();
  },
  'ai-field-change': (ctx, el) => {
    const field = el.dataset.aiField;
    const ai = ctx.state.settings.ai;
    if (field === 'provider') {
      const preset = AI_PRESETS[el.value] || AI_PRESETS.custom;
      ai.provider = el.value;
      ai.baseUrl = preset.baseUrl;
      if (preset.model) ai.model = preset.model;
      ctx.ui.aiTest = null;
      ctx.persist();
      ctx.render();
      return;
    }
    if (field === 'jsonMode') {
      ai.jsonMode = el.checked;
    } else if (field === 'temperature') {
      ai.temperature = Number(el.value);
    } else {
      ai[field] = el.value;
    }
    ctx.persist();
  },
  'test-ai': async (ctx) => {
    const config = syncAiConfig(ctx);
    if (!config) return;
    ctx.ui.aiTest = { state: 'loading', message: '正在连接' };
    ctx.render();
    const result = await ctx.api.testAI(config);
    ctx.ui.aiTest = result.ok
      ? { state: 'ok', message: result.message }
      : { state: 'error', message: result.error || '连接失败' };
    if (result.ok && result.models?.length) {
      ctx.ui.aiModels = result.models;
      const current = ctx.state.settings.ai.model;
      if (!current || current === 'local-model' || !result.models.includes(current)) {
        ctx.state.settings.ai.model = result.models[0];
      }
      ctx.persist();
    }
    ctx.render();
    if (result.ok) ctx.showToast(result.message || 'AI 连接成功');
    else ctx.showToast(result.error || '连接失败');
  },
  'range-commit': (ctx, el) => {
    const key = el.dataset.range;
    if (!['panelOpacity', 'fadeOpacity'].includes(key)) return;
    ctx.state.settings[key] = Number(el.value);
    ctx.applyTheme();
    ctx.persist();
  },
  'set-accent': (ctx, el) => {
    ctx.state.settings.accent = el.dataset.color;
    ctx.applyTheme();
    ctx.render();
    ctx.persist();
  },
  'setting-change': (ctx, el) => {
    const key = el.dataset.setting;
    if (key === 'clickThrough') {
      ctx.ui.clickThrough = el.checked;
      ctx.api.setClickThrough(el.checked);
      ctx.render();
      if (el.checked) {
        ctx.showToast(`鼠标穿透已开启。按 ${ctx.hotkey || '托盘菜单'} 恢复。`, { timeout: 7000 });
      }
      return;
    }
    if (key === 'launchAtLogin') {
      const requested = Boolean(el.checked);
      ctx.state.settings.launchAtLogin = requested;
      ctx.api.setLogin(requested).then((result) => {
        const actual = Boolean(result?.ok && result.enabled);
        if (!result?.ok || (requested && !actual)) {
          ctx.state.settings.launchAtLogin = false;
          ctx.showToast(result?.error || '设置开机启动失败');
        } else {
          ctx.state.settings.launchAtLogin = actual;
        }
        ctx.render();
        ctx.persist();
      });
      ctx.persist();
      return;
    }
    if (key === 'alwaysOnTop') {
      ctx.state.settings.alwaysOnTop = el.checked;
      ctx.api.setAlwaysOnTop(el.checked);
      ctx.persist();
      ctx.render();
      return;
    }
    if (key === 'doublePoints') {
      ctx.state.settings.doublePoints = el.checked;
      ctx.persist();
      ctx.render();
      return;
    }
    if (['autoFade', 'reduceMotion'].includes(key)) {
      ctx.state.settings[key] = el.checked;
      if (key === 'autoFade' && !el.checked) {
        // A stale click-through state can survive opacity changes; restore hit testing.
        ctx.ui.clickThrough = false;
        ctx.api.setClickThrough(false);
      }
      ctx.applyTheme();
      ctx.persist();
      ctx.render();
      if (key === 'autoFade' && !el.checked) {
        ctx.showToast('自动淡出已关闭，点击已恢复');
      }
      return;
    }
  },
  'reset-position': (ctx) => {
    ctx.api.resetPosition();
    ctx.showToast('窗口已回到右上角');
  },
  'open-data-dir': (ctx) => {
    ctx.api.openDataDir();
  },
  'export-data': async (ctx) => {
    const result = await ctx.api.exportData();
    if (result?.ok) ctx.showToast('已导出 JSON 备份');
    else if (result && !result.canceled) ctx.showToast(result.error || '导出失败');
  },
  'import-data': async (ctx) => {
    const result = await ctx.api.importData();
    if (!result?.ok) {
      if (result && !result.canceled) ctx.showToast(result.error || '导入失败');
      return;
    }
    ctx.state = result.state;
    ctx.revision = result.revision;
    const current = startOfWeekISO(todayISO());
    ctx.currentWeek = current;
    ctx.ui.selectedWeek = current;
    ctx.ui.compact = Boolean(ctx.state.settings.compact);
    ctx.ui.view = 'week';
    ctx.api.setCompact(ctx.ui.compact);
    ctx.api.setAlwaysOnTop(ctx.state.settings.alwaysOnTop);
    ctx.api.setLogin(Boolean(ctx.state.settings.launchAtLogin));
    ctx.applyTheme();
    ctx.render();
    ctx.showToast('数据已导入');
  },
  'load-demo': (ctx) => {
    ctx.openConfirm({
      title: '载入示例数据？',
      eyebrow: 'Demo',
      message: '当前任务和积分会被示例项目替换。建议先导出备份；AI 与外观设置会保留。',
      confirmLabel: '载入示例',
      onConfirm: () => {
        const snapshot = structuredClone(ctx.state);
        const demo = createDemoState(new Date());
        demo.settings = {
          ...demo.settings,
          ...ctx.state.settings,
          ai: ctx.state.settings.ai,
          compact: false,
        };
        ctx.state = demo;
        ctx.revision = ctx.revision;
        ctx.ui.compact = false;
        ctx.ui.view = 'week';
        ctx.ui.selectedWeek = ctx.currentWeek;
        ctx.ui.showDone = false;
        ctx.api.setCompact(false);
        ctx.render();
        ctx.persist();
        ctx.showToast('示例已载入，12 周的计划在蓝图里', {
          action: {
            label: '撤销',
            onClick: () => {
              ctx.state = snapshot;
              ctx.render();
              ctx.persist();
              ctx.showToast('已恢复');
            },
          },
          timeout: 8000,
        });
      },
    });
  },
  'clear-data': (ctx) => {
    ctx.openConfirm({
      title: '清空所有数据？',
      eyebrow: 'Danger zone',
      message: '项目、每周任务、每日任务、积分、奖励与抽奖记录都会被删除，AI 配置和外观设置会保留。这个动作也会清空正在进行的计划。',
      confirmLabel: '确认清空',
      danger: true,
      onConfirm: () => {
        const snapshot = structuredClone(ctx.state);
        const settings = snapshot.settings;
        const next = createDefaultState();
        next.settings = { ...next.settings, ...settings, compact: false };
        ctx.state = next;
        ctx.currentWeek = startOfWeekISO(todayISO());
        ctx.ui.selectedWeek = ctx.currentWeek;
        ctx.ui.view = 'week';
        ctx.ui.compact = false;
        ctx.ui.showDone = false;
        ctx.api.setCompact(false);
        ctx.render();
        ctx.persist();
        ctx.showToast('已经清空。可以重新开始了。', {
          action: {
            label: '撤销',
            onClick: () => {
              ctx.state = snapshot;
              ctx.render();
              ctx.persist();
              ctx.showToast('已恢复');
            },
          },
          timeout: 8000,
        });
      },
    });
  },

  'close-modal': (ctx) => {
    if (ctx.ui.modal?.type === 'draw' && ctx.ui.modal.phase === 'spinning') return;
    ctx.closeModal();
  },
  'confirm-modal': async (ctx) => {
    const modal = ctx.ui.modal;
    if (!modal?.onConfirm) {
      ctx.closeModal();
      return;
    }
    try {
      const result = await modal.onConfirm();
      if (result !== false && ctx.ui.modal === modal) ctx.closeModal();
    } catch (error) {
      modal.error = error.message || String(error);
      ctx.renderOverlayOnly();
    }
  },
  'dismiss-toast': (ctx) => ctx.dismissToast(),
  'toast-action': (ctx) => {
    const action = ctx.ui.toast?.action;
    if (!action) return;
    ctx.dismissToast();
    action.onClick();
  },
};
