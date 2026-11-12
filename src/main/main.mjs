import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
} = require('electron');

import { Store, resolveDataDir } from './store.mjs';
import { generatePlan, testAi } from './ai.mjs';
import { createDemoState } from '../shared/demo.js';
import { todayISO } from '../shared/domain.js';
import { buildPlannerMessages } from '../shared/planner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const IS_SHOT = process.argv.includes('--screenshot');
const IS_SELFTEST = process.argv.includes('--selftest');
const IS_DEV = process.argv.includes('--dev');
const OUT_DIR = process.env.WEEKFLOW_OUT_DIR
  ? path.resolve(process.env.WEEKFLOW_OUT_DIR)
  : path.join(ROOT, 'dist');
const DEBUG_LOG = path.join(OUT_DIR, 'main-debug.log');
const HOTKEY_CANDIDATES = ['Alt+Shift+W', 'CommandOrControl+Shift+W', 'CommandOrControl+Alt+W'];
const DEFAULT_BOUNDS = { width: 408, height: 716 };
const COMPACT_BOUNDS = { width: 380, height: 400 };
const SCREENSHOT_VIEWS = ['plans', 'rewards', 'redemptions', 'settings'];

if (IS_SHOT || IS_SELFTEST) {
  app.setPath('userData', path.join(os.tmpdir(), `weekflow-${IS_SELFTEST ? 'test' : 'shot'}-${process.pid}`));
  app.disableHardwareAcceleration();
}

function debugLog(...parts) {
  if (!IS_SHOT && !IS_DEV && !IS_SELFTEST) return;
  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(
      DEBUG_LOG,
      `[${new Date().toISOString()}] ${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}\n`,
      'utf8',
    );
  } catch {
    // Diagnostics only.
  }
}

debugLog('main loaded', process.versions.electron, process.versions.node, process.argv.join(' '));
process.on('uncaughtException', (error) => {
  debugLog('uncaughtException', error?.stack || String(error));
});
process.on('unhandledRejection', (error) => {
  debugLog('unhandledRejection', error?.stack || String(error));
});

let win = null;
let tray = null;
let store = null;
let isQuitting = false;
let isCompact = false;
let isClickThrough = false;
let normalBounds = null;
let saveBoundsTimer = null;
let traySummary = '周流 · 本周';
let hotkeyOk = false;
let activeHotkey = null;

const gotLock = app.requestSingleInstanceLock();
debugLog('single instance lock', gotLock);
if (!gotLock) {
  app.quit();
}

function assetPath(name) {
  return path.join(ROOT, 'assets', name);
}

function defaultBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    width: DEFAULT_BOUNDS.width,
    height: DEFAULT_BOUNDS.height,
    x: Math.round(area.x + area.width - DEFAULT_BOUNDS.width - 24),
    y: Math.round(area.y + 24),
  };
}

function isBoundsVisible(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return false;
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x + 80 > area.x &&
      bounds.x < area.x + area.width - 40 &&
      bounds.y + 60 > area.y &&
      bounds.y < area.y + area.height - 40
    );
  });
}

async function loadBounds() {
  const stored = await store.readWindowState();
  if (stored && Number(stored.width) >= 320 && isBoundsVisible(stored)) {
    return {
      x: Math.round(stored.x),
      y: Math.round(stored.y),
      width: Math.round(stored.width),
      height: Math.round(stored.height),
    };
  }
  return defaultBounds();
}

function scheduleBoundsSave() {
  if (!win || win.isDestroyed() || isCompact) return;
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(async () => {
    if (!win || win.isDestroyed() || isCompact) return;
    normalBounds = win.getBounds();
    await store.writeWindowState(normalBounds);
    rebuildTray();
  }, 400);
}

function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (isClickThrough) setClickThrough(false);
  if (isCompact) {
    // A compact bar should remain compact when summoned.
    win.showInactive();
    win.setIgnoreMouseEvents(false);
    win.setAlwaysOnTop(store.getState().settings.alwaysOnTop, 'floating');
    return;
  }
  win.show();
  win.focus();
  win.setIgnoreMouseEvents(false);
}

function hideWindow() {
  if (win && !win.isDestroyed()) win.hide();
}

function toggleWindow() {
  if (!win) return;
  if (isClickThrough) {
    setClickThrough(false);
    showWindow();
    return;
  }
  if (win.isVisible()) hideWindow();
  else showWindow();
}

function applyCompact(compact, { animate = true } = {}) {
  if (!win || win.isDestroyed()) return { compact: isCompact };
  const next = Boolean(compact);
  if (next === isCompact) return { compact: isCompact };
  if (store?.getState()) store.getState().settings.compact = next;

  if (next) {
    normalBounds = win.getBounds();
    isCompact = true;
    win.setResizable(false);
    win.setMinimumSize(320, 60);
    const old = win.getBounds();
    const width = COMPACT_BOUNDS.width;
    const height = COMPACT_BOUNDS.height;
    const x = old.x + old.width - width;
    win.setBounds({ x, y: old.y, width, height }, animate);
  } else {
    isCompact = false;
    win.setMinimumSize(340, 560);
    win.setResizable(true);
    const target = normalBounds || defaultBounds();
    const old = win.getBounds();
    const x = old.x + old.width - target.width;
    win.setBounds({ x, y: old.y, width: target.width, height: target.height }, animate);
    scheduleBoundsSave();
  }
  rebuildTray();
  return { compact: isCompact };
}

function setAlwaysOnTop(enabled) {
  if (!win || win.isDestroyed()) return false;
  const next = Boolean(enabled);
  if (store) store.getState().settings.alwaysOnTop = next;
  win.setAlwaysOnTop(next, 'floating');
  rebuildTray();
  return win.isAlwaysOnTop();
}

function setClickThrough(enabled) {
  isClickThrough = Boolean(enabled);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(isClickThrough, { forward: true });
  }
  rebuildTray();
  return isClickThrough;
}

function resetPosition() {
  if (!win || win.isDestroyed()) return;
  if (isCompact) {
    const area = screen.getPrimaryDisplay().workArea;
    const current = win.getBounds();
    win.setBounds(
      {
        x: Math.round(area.x + area.width - current.width - 24),
        y: Math.round(area.y + 24),
        width: current.width,
        height: current.height,
      },
      true,
    );
    rebuildTray();
    return;
  }
  const bounds = defaultBounds();
  win.setBounds(bounds, true);
  normalBounds = bounds;
  store.writeWindowState(bounds);
  rebuildTray();
}

function buildTrayMenu() {
  const visible = Boolean(win?.isVisible());
  return Menu.buildFromTemplate([
    { label: traySummary, enabled: false },
    { type: 'separator' },
    { label: visible ? '隐藏周流' : '显示周流', click: () => (visible ? hideWindow() : showWindow()) },
    {
      label: '收起为桌面小条',
      type: 'checkbox',
      checked: isCompact,
      click: () => {
        if (!win?.isVisible()) showWindow();
        const result = applyCompact(!isCompact);
        win.webContents.send('app:compact-changed', result.compact);
      },
    },
    {
      label: '窗口置顶',
      type: 'checkbox',
      checked: Boolean(store?.getState().settings.alwaysOnTop),
      click: (item) => {
        if (!store) return;
        const state = store.getState();
        state.settings.alwaysOnTop = item.checked;
        setAlwaysOnTop(item.checked);
        win?.webContents.send('app:settings-changed', state.settings);
      },
    },
    {
      label: `鼠标穿透（${activeHotkey || '托盘菜单'} 恢复）`,
      type: 'checkbox',
      checked: isClickThrough,
      click: (item) => {
        setClickThrough(item.checked);
        win?.webContents.send('app:click-through-changed', isClickThrough);
      },
    },
    { type: 'separator' },
    {
      label: '打开数据文件夹',
      click: () => store && shell.openPath(store.dataDir),
    },
    {
      label: '重置窗口位置',
      click: () => resetPosition(),
    },
    { type: 'separator' },
    {
      label: '退出周流',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip(`周流 · ${traySummary}`);
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(assetPath('tray.png'));
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 18, height: 18 }));
  } catch {
    return;
  }
  tray.setToolTip('周流 · 本周');
  rebuildTray();
  tray.on('click', () => toggleWindow());
  tray.on('double-click', () => showWindow());
}

function registerHotkey() {
  for (const candidate of HOTKEY_CANDIDATES) {
    try {
      const registered = globalShortcut.register(candidate, () => toggleWindow());
      debugLog('hotkey', candidate, registered);
      if (registered) {
        hotkeyOk = true;
        activeHotkey = candidate;
        return;
      }
    } catch (error) {
      debugLog('hotkey error', candidate, error?.message || String(error));
    }
  }
  hotkeyOk = false;
  activeHotkey = null;
}

async function createWindow() {
  const bounds = await loadBounds();
  normalBounds = bounds;
  const startCompact = Boolean(store.getState().settings.compact) && !IS_SHOT;
  isCompact = false;

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 340,
    minHeight: 560,
    maxWidth: 560,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    roundedCorners: true,
    icon: assetPath('icon.png'),
    title: 'WeekFlow 周流',
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: IS_DEV || !app.isPackaged,
    },
  });

  win.setMenu(null);
  win.setAlwaysOnTop(Boolean(store.getState().settings.alwaysOnTop), 'floating');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setWindowButtonVisibility(false);
  }

  win.on('move', scheduleBoundsSave);
  win.on('resize', scheduleBoundsSave);
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideWindow();
    }
  });
  win.on('closed', () => {
    win = null;
  });
  win.on('show', rebuildTray);
  win.on('hide', rebuildTray);

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    debugLog(`renderer[${level}]`, `${sourceId}:${line}`, message);
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    debugLog('did-fail-load', code, description, url);
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    debugLog('preload-error', preloadPath, error?.stack || String(error));
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    debugLog('render-process-gone', details);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && !win.isFocused()) {
      hideWindow();
    }
    if (input.type === 'keyDown' && (input.control || input.meta) && input.key.toLowerCase() === 'r' && IS_DEV) {
      win.webContents.reload();
    }
  });

  win.once('ready-to-show', () => {
    if (IS_SHOT) {
      win.showInactive();
    } else {
      win.show();
      if (startCompact) {
        applyCompact(true, { animate: false });
        win.webContents.send('app:compact-changed', true);
      }
    }
  });

  const query = IS_SHOT ? { view: process.env.WEEKFLOW_SHOT_VIEW || 'week', screenshot: '1' } : {};
  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'), { query });

  if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' });
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', () => ({
    state: store.getState(),
    revision: store.revision,
    dataDir: store.dataDir,
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    hotkey: hotkeyOk ? activeHotkey : null,
    isCompact,
    isClickThrough,
  }));

  ipcMain.handle('state:save', async (_event, payload) => {
    try {
      return await store.save(payload?.state, payload?.revision);
    } catch (error) {
      return { ok: false, error: error.message || String(error), revision: store.revision };
    }
  });

  ipcMain.handle('state:export', async () => {
    const result = await dialog.showSaveDialog(win, {
      title: '导出周流数据',
      defaultPath: path.join(app.getPath('documents'), `weekflow-backup-${todayISO()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      await store.exportTo(result.filePath);
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('state:import', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '导入周流数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
    try {
      const imported = await store.importFrom(result.filePaths[0]);
      return { ok: true, ...imported };
    } catch (error) {
      return { ok: false, error: `导入失败：${error.message || String(error)}` };
    }
  });

  ipcMain.handle('app:show', () => showWindow());
  ipcMain.handle('app:hide', () => hideWindow());
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
  ipcMain.handle('app:set-always-on-top', (_event, enabled) => setAlwaysOnTop(enabled));
  ipcMain.handle('app:set-click-through', (_event, enabled) => setClickThrough(enabled));
  ipcMain.handle('app:set-compact', (_event, compact) => applyCompact(Boolean(compact)));
  ipcMain.handle('app:open-data-dir', async () => {
    await store.ensureDir();
    return shell.openPath(store.dataDir);
  });
  ipcMain.handle('app:reset-position', () => {
    resetPosition();
    return true;
  });
  ipcMain.handle('app:get-login', () => {
    try {
      return { ok: true, enabled: app.getLoginItemSettings().openAtLogin };
    } catch (error) {
      return { ok: false, error: error.message || String(error), enabled: false };
    }
  });
  ipcMain.handle('app:set-login', (_event, enabled) => {
    try {
      // In portable mode, launch the launcher rather than the runtime exe.
      // The launcher sets WEEKFLOW_DATA_DIR, so login startup reads the same data/.
      const dataDir = resolveDataDir(app);
      const portableRoot = path.dirname(dataDir);
      const portableLauncher = path.join(portableRoot, 'START_WEEKFLOW.cmd');
      const usePortableLauncher =
        app.isPackaged && process.platform === 'win32' && fs.existsSync(portableLauncher);
      const command = usePortableLauncher
        ? process.env.ComSpec || path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'cmd.exe')
        : process.execPath;
      const args = usePortableLauncher
        ? ['/c', `"${portableLauncher}"`]
        : app.isPackaged
          ? []
          : [ROOT];
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        path: command,
        args,
      });
      return { ok: true, enabled: app.getLoginItemSettings().openAtLogin };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
  ipcMain.handle('app:open-external', (_event, url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return false;
    shell.openExternal(url);
    return true;
  });
  ipcMain.handle('tray:summary', (_event, summary) => {
    traySummary = String(summary || '周流 · 本周').slice(0, 80);
    rebuildTray();
    return true;
  });

  ipcMain.handle('ai:test', async (_event, config) => testAi(config || {}));
  ipcMain.handle('ai:plan', async (_event, payload) => {
    const messages = buildPlannerMessages(payload?.input || {});
    return generatePlan(payload?.config || {}, messages);
  });

  ipcMain.handle('window:set-size', (_event, _size) => true);
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSelfTest() {
  const outFile = path.join(OUT_DIR, 'selftest.json');
  await wait(1600);
  let results = { pass: false };
  try {
    results = await win.webContents.executeJavaScript(`
      (async () => {
        const ctx = window.__weekflowCtx;
        const A = window.__weekflowActions;
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const snap = () => ({
          projects: ctx.state.projects.length,
          tasks: ctx.state.tasks.length,
          balance: ctx.balance,
          view: ctx.ui.view,
        });
        const results = {
          boot: snap(),
          autoFade: {
            setting: ctx.state.settings.autoFade,
            body: document.body.classList.contains('auto-fade'),
          },
        };

        A['toggle-nav'](ctx);
        await wait(240);
        results.nav = {
          open: ctx.ui.navOpen,
          tabbar: Boolean(document.querySelector('.tabbar')),
          handle: Boolean(document.querySelector('.nav-handle')),
        };
        A['toggle-nav'](ctx);
        await wait(160);

        const dragHandle = document.querySelector('[data-week-section="daily"] .panel-grip');
        const dragTarget = document.querySelector('[data-week-section="week"]');
        const transfer = new DataTransfer();
        const targetRect = dragTarget.getBoundingClientRect();
        dragHandle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        dragTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: targetRect.bottom - 2 }));
        dragTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: targetRect.bottom - 2 }));
        await wait(220);
        results.dragOrder = [...ctx.state.settings.weekOrder];
        ctx.state.settings.weekOrder = ['daily', 'week', 'bonus'];
        ctx.render();
        ctx.persist();

        A['toggle-appearance'](ctx);
        await wait(180);
        A['set-opacity'](ctx, { dataset: { value: '85' } });
        await wait(160);
        results.opacity = {
          setting: ctx.state.settings.panelOpacity,
          css: getComputedStyle(document.documentElement).getPropertyValue('--panel-alpha').trim(),
          label: document.getElementById('quick-opacity-value')?.textContent || '',
        };
        A['set-opacity'](ctx, { dataset: { value: '72' } });

        A['set-theme'](ctx, { dataset: { theme: 'paper' } });
        await wait(160);
        results.theme = {
          setting: ctx.state.settings.theme,
          body: document.body.dataset.theme,
          accent: ctx.state.settings.accent,
        };
        A['set-theme'](ctx, { dataset: { theme: 'night' } });
        await wait(160);
        results.opacityRestored = ctx.state.settings.panelOpacity;
        results.themeRestored = ctx.state.settings.theme;
        A['close-appearance'](ctx);

        const beforeHabit = ctx.balance;
        A['quick-habit'](ctx, {
          dataset: { title: '自测锻炼', points: '10', icon: '🏃' },
        });
        await wait(260);
        const habit = ctx.state.habits.find((item) => item.title === '自测锻炼');
        const habitElement = habit
          ? document.querySelector('[data-habit-id="' + habit.id + '"]')
          : null;
        results.habit = {
          created: Boolean(habit),
          dailyCard: Boolean(document.querySelector('.daily-card')),
          display: habitElement ? getComputedStyle(habitElement).display : '',
          list: Boolean(habitElement?.closest('.habit-list')),
          pointsBelow: Boolean(habitElement?.querySelector('.habit-foot .points-chip')),
          edit: Boolean(habitElement?.querySelector('[data-action="edit-habit"]')),
          remove: Boolean(habitElement?.querySelector('[data-action="delete-habit"]')),
        };
        A['manage-habits'](ctx);
        await wait(220);
        results.manager = {
          open: Boolean(document.querySelector('.manage-row')),
          edit: Boolean(document.querySelector('.manage-row [data-action="edit-habit"]')),
          remove: Boolean(document.querySelector('.manage-row [data-action="delete-habit"]')),
        };
        A['close-modal'](ctx);
        await wait(160);

        A['toggle-habit'](ctx, { dataset: { id: habit.id } });
        await wait(260);
        results.habitComplete = {
          done: Boolean(ctx.state.habitCompletions.find((item) => item.habitId === habit.id)),
          delta: ctx.balance - beforeHabit,
        };
        A['toggle-habit'](ctx, { dataset: { id: habit.id } });
        await wait(260);
        results.habitUndo = {
          done: Boolean(ctx.state.habitCompletions.find((item) => item.habitId === habit.id)),
          balance: ctx.balance,
        };

        const beforeBonus = ctx.balance;
        A['new-bonus'](ctx);
        ctx.ui.modal.draft = {
          title: '自测随时任务',
          detail: '没有截止时间',
          icon: '✨',
          points: 200,
        };
        A['submit:bonus-form'](ctx);
        await wait(260);
        const bonus = ctx.state.bonusTasks.find((item) => item.title === '自测随时任务');
        const bonusElement = bonus
          ? document.querySelector('[data-bonus-id="' + bonus.id + '"]')
          : null;
        results.bonus = {
          created: Boolean(bonus),
          section: Boolean(document.querySelector('.bonus-section')),
          edit: Boolean(bonusElement?.querySelector('[data-action="edit-bonus"]')),
          remove: Boolean(bonusElement?.querySelector('[data-action="delete-bonus"]')),
        };
        A['toggle-bonus'](ctx, { dataset: { id: bonus.id } });
        await wait(260);
        results.bonusComplete = {
          done: ctx.state.bonusTasks.find((item) => item.id === bonus.id)?.status === 'done',
          delta: ctx.balance - beforeBonus,
        };
        A['toggle-bonus'](ctx, { dataset: { id: bonus.id } });
        await wait(260);
        results.bonusUndo = {
          done: ctx.state.bonusTasks.find((item) => item.id === bonus.id)?.status === 'done',
          balance: ctx.balance,
        };

        const task = ctx.state.tasks.find(
          (item) => item.status !== 'done' && item.weekStart === ctx.currentWeek,
        );
        if (!task) throw new Error('demo task missing');
        const taskElement = document.querySelector('[data-task-id="' + task.id + '"]');
        results.taskLayout = {
          display: taskElement ? getComputedStyle(taskElement).display : '',
          list: Boolean(taskElement?.closest('.task-list')),
          pointsInMeta: Boolean(taskElement?.querySelector('.task-meta .points-chip')),
          edit: Boolean(taskElement?.querySelector('[data-action="edit-task"]')),
          remove: Boolean(taskElement?.querySelector('[data-action="delete-task"]')),
        };
        task.detail = '教程：BV1VMTDzvEaV';
        ctx.render();
        await wait(180);
        results.copy = {
          chips: document.querySelectorAll('.copy-chip').length,
          label: document.querySelector('.copy-label')?.textContent?.trim(),
        };
        A['copy-text'](ctx, { dataset: { copy: 'BV1VMTDzvEaV' } });
        await wait(150);
        results.copyToast = ctx.ui.toast?.message || '';

        const repeatProject = ctx.state.projects[0];
        A['new-task'](ctx, { dataset: { projectId: repeatProject.id } });
        ctx.ui.modal.draft = {
          title: '自测每周任务',
          detail: '',
          projectId: repeatProject.id,
          weekStart: ctx.currentWeek,
          points: 10,
          estimateMin: 10,
          repeatWeekly: true,
        };
        A['submit:task-form'](ctx);
        await wait(260);
        const repeated = ctx.state.tasks.filter((item) => item.title === '自测每周任务');
        results.recurring = {
          count: repeated.length,
          badge: Boolean(document.querySelector('.recurring-badge')),
          weeks: repeated.length,
        };
        if (ctx.ui.toast?.action) {
          A['toast-action'](ctx);
          await wait(240);
        }
        results.recurringUndo = ctx.state.tasks.filter((item) => item.title === '自测每周任务').length;

        const now = new Date();
        const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
        ctx.state.settings.holidayDates = [today];
        const beforeComplete = ctx.balance;
        const basePoints = task.points;
        A['toggle-task'](ctx, { dataset: { id: task.id } });
        await wait(260);
        results.complete = {
          ok: ctx.state.tasks.find((item) => item.id === task.id)?.status === 'done',
          delta: ctx.balance - beforeComplete,
        };
        results.double = {
          base: basePoints,
          awarded: ctx.state.tasks.find((item) => item.id === task.id)?.awardedPoints,
        };
        ctx.state.settings.holidayDates = [];
        A['toggle-task'](ctx, { dataset: { id: task.id } });
        await wait(260);
        results.undoComplete = {
          ok: ctx.state.tasks.find((item) => item.id === task.id)?.status === 'todo',
          balance: ctx.balance,
        };

        const project = ctx.state.projects[0];
        const currentTask =
          ctx.state.tasks.find(
            (item) =>
              item.projectId === project.id &&
              item.status !== 'done' &&
              item.weekStart === ctx.currentWeek,
          ) || ctx.state.tasks.find((item) => item.status !== 'done');
        const beforeWeeks = Object.fromEntries(
          ctx.state.tasks
            .filter((item) => item.projectId === project.id)
            .map((item) => [item.id, item.weekStart]),
        );
        A['defer-task'](ctx, { dataset: { id: currentTask.id, mode: 'shift' } });
        await wait(320);
        results.shift = {
          moved: ctx.state.tasks.filter(
            (item) => item.projectId === project.id && beforeWeeks[item.id] && item.weekStart !== beforeWeeks[item.id],
          ).length,
          shiftCount: ctx.state.projects.find((item) => item.id === project.id)?.shiftCount,
          hasUndo: Boolean(ctx.ui.toast?.action),
        };
        if (ctx.ui.toast?.action) {
          A['toast-action'](ctx);
          await wait(320);
          results.undoShift = {
            restored: Object.entries(beforeWeeks).every(
              ([id, week]) => ctx.state.tasks.find((item) => item.id === id)?.weekStart === week,
            ),
          };
        }

        const singleBefore = ctx.state.tasks.find((item) => item.id === currentTask.id)?.weekStart;
        const shiftCountBefore = ctx.state.projects.find((item) => item.id === project.id)?.shiftCount;
        A['defer-single-task'](ctx, { dataset: { id: currentTask.id, mode: 'shift' } });
        await wait(320);
        results.singleShift = {
          moved: ctx.state.tasks.filter(
            (item) =>
              item.projectId === project.id &&
              beforeWeeks[item.id] &&
              item.weekStart !== beforeWeeks[item.id],
          ).length,
          target: ctx.state.tasks.find((item) => item.id === currentTask.id)?.weekStart,
          source: singleBefore,
          shiftCount: ctx.state.projects.find((item) => item.id === project.id)?.shiftCount,
          shiftCountBefore,
        };
        if (ctx.ui.toast?.action) {
          A['toast-action'](ctx);
          await wait(260);
        }

        A['open-plan-wizard'](ctx);
        ctx.ui.modal.draft.goal = '自测目标：做一个小东西';
        A['offline-plan'](ctx);
        results.planPreview = {
          weeks: ctx.ui.modal.plan.weeks.length,
          filled: ctx.ui.modal.plan.weeks.filter((week) => week.tasks.length).length,
        };
        A['plan-confirm'](ctx);
        await wait(350);
        const newProject = ctx.state.projects.find((item) => item.title === '自测目标：做一个小东西');
        results.plan = {
          created: Boolean(newProject),
          tasks: newProject
            ? ctx.state.tasks.filter((item) => item.projectId === newProject.id).length
            : 0,
        };

        A['open-manual-plan'](ctx);
        ctx.ui.modal.draft.title = '手排测试';
        ctx.ui.modal.draft.goal = '不用 AI 的八周';
        ctx.ui.modal.draft.weeks = 2;
        ctx.ui.modal.draft.weekPlans = [
          { theme: '第一周', text: '写验收标准\\n做一次基线 | 20' },
          { theme: '第二周', text: '做出第一版' },
        ];
        A['submit:manual-plan-form'](ctx);
        await wait(350);
        const manualProject = ctx.state.projects.find((item) => item.title === '手排测试');
        const manualTasks = manualProject
          ? ctx.state.tasks.filter((item) => item.projectId === manualProject.id)
          : [];
        results.manualPlan = {
          created: Boolean(manualProject),
          tasks: manualTasks.length,
          points: manualTasks.reduce((sum, task) => sum + task.points, 0),
          weeks: manualProject?.weeksMeta?.length,
        };

        const beforeReward = ctx.balance;
        A['new-reward'](ctx);
        ctx.ui.modal.draft = { title: '自测咖啡', cost: 10, icon: '☕', note: '' };
        A['submit:reward-form'](ctx);
        await wait(280);
        const reward = ctx.state.rewards.find((item) => item.title === '自测咖啡');
        results.reward = { created: Boolean(reward) };
        ctx.navigate('rewards');
        await wait(260);
        results.rewardCards = {
          edit: Boolean(document.querySelector('.reward-actions [data-action="edit-reward"]')),
          remove: Boolean(document.querySelector('.reward-actions [data-action="delete-reward"]')),
        };
        results.poolCards = {
          edit: Boolean(document.querySelector('[data-action="edit-pool"]')),
          remove: Boolean(document.querySelector('[data-action="delete-pool"]')),
        };
        A['redeem-reward'](ctx, { dataset: { id: reward.id } });
        await A['confirm-modal'](ctx);
        await wait(300);
        results.redeem = {
          spent: beforeReward - ctx.balance,
          redemptionCount: ctx.state.redemptions.length,
        };
        ctx.navigate('redemptions');
        await wait(260);
        results.redemptionsPage = {
          title: document.querySelector('.page-title')?.textContent,
          rows: document.querySelectorAll('.redemption-row').length,
          filters: document.querySelectorAll('[data-action="redemptions-tab"]').length,
        };
        const redemption = ctx.state.redemptions[0];
        results.redemption = {
          row: Boolean(document.querySelector('.redemption-row')),
          button: Boolean(document.querySelector('[data-action="use-redemption"]')),
          used: Boolean(redemption?.usedAt),
        };
        if (redemption) {
          A['use-redemption'](ctx, { dataset: { id: redemption.id } });
          await wait(260);
          results.redemptionUsed = Boolean(
            ctx.state.redemptions.find((item) => item.id === redemption.id)?.usedAt,
          );
          A['use-redemption'](ctx, { dataset: { id: redemption.id } });
          await wait(260);
          results.redemptionUndo = Boolean(
            ctx.state.redemptions.find((item) => item.id === redemption.id)?.usedAt,
          );
        }

        ctx.state.ledger.push({
          id: 'lg_selftest',
          kind: 'adjust',
          amount: 500,
          at: new Date().toISOString(),
          refId: '',
          note: '自测充值',
        });
        ctx.render();
        await ctx.persist();
        const pool = ctx.state.pools[0];
        A['edit-pool'](ctx, { dataset: { id: pool.id } });
        await wait(220);
        const weightInputs = [...document.querySelectorAll('[data-prize-field="weight"]')];
        weightInputs.forEach((input, index) => {
          input.value = String([65, 20, 9, 4, 2, 1][index] ?? 1);
        });
        const poolForm = document.querySelector('#pool-form');
        results.poolEdit = {
          title: document.querySelector('.sheet-title')?.textContent,
          draftTitle: ctx.ui.modal?.draft?.title,
          prizeRows: document.querySelectorAll('.pool-editor-row').length,
          expectedRows: pool.prizes.length,
          weightSteps: [...new Set(weightInputs.map((input) => input.step))],
          weightsValid: Boolean(poolForm?.checkValidity()),
        };
        A['close-modal'](ctx);
        await wait(160);
        const beforeDraw = ctx.balance;
        A['draw-pool'](ctx, { dataset: { id: pool.id } });
        await wait(2300);
        results.draw = {
          phase: ctx.ui.modal?.phase,
          cost: ctx.ui.modal?.draw?.cost,
          points: ctx.ui.modal?.draw?.points,
          balance: ctx.ui.modal?.balance,
          expected: beforeDraw - pool.cost + (ctx.ui.modal?.draw?.points || 0),
        };
        A['close-modal'](ctx);

        ctx.navigate('settings');
        await wait(220);
        results.launchSetting = Boolean(document.querySelector('[data-setting="launchAtLogin"]'));
        results.login = await window.weekflow.getLogin();

        const autoFade = ctx.state.settings.autoFade;
        A['setting-change'](ctx, { dataset: { setting: 'autoFade' }, checked: !autoFade });
        await wait(220);
        results.setting = { changed: ctx.state.settings.autoFade !== autoFade };
        A['setting-change'](ctx, { dataset: { setting: 'autoFade' }, checked: autoFade });

        A['toggle-compact'](ctx);
        await wait(700);
        results.compact = {
          ui: ctx.ui.compact,
          body: document.body.classList.contains('is-compact'),
          rows: document.querySelectorAll('.compact-row').length,
          daily: Boolean(document.querySelector('.compact-row[data-kind="daily"]')),
          week: Boolean(document.querySelector('.compact-row[data-kind="week"]')),
        };
        A['expand-compact'](ctx);
        await wait(700);
        results.expanded = { ui: ctx.ui.compact };
        await ctx.persist();
        results.final = snap();
        results.revision = ctx.revision;
        return results;
      })()
    `);

    await win.webContents.executeJavaScript("window.__weekflowActions['toggle-compact'](window.__weekflowCtx)");
    await wait(700);
    results.compactBounds = win.getBounds();
    await win.webContents.executeJavaScript("window.__weekflowActions['expand-compact'](window.__weekflowCtx)");
    await wait(500);

    results.pass = Boolean(
      results.autoFade?.setting === false &&
        results.autoFade?.body === false &&
        results.launchSetting &&
        results.login?.ok &&
        results.nav?.open &&
        results.nav?.tabbar &&
        results.nav?.handle &&
        results.dragOrder?.join(',') === 'week,daily,bonus' &&
        results.taskLayout?.display === 'block' &&
        results.taskLayout?.list &&
        results.taskLayout?.pointsInMeta &&
        results.taskLayout?.edit &&
        results.taskLayout?.remove &&
        results.copy?.chips > 0 &&
        results.copyToast?.includes('BV1VMTDzvEaV') &&
        results.habit?.edit &&
        results.habit?.remove &&
        results.opacity?.setting === 0.85 &&
        results.opacity?.label === '85%' &&
        results.opacityRestored === 0.72 &&
        results.theme?.setting === 'paper' &&
        results.theme?.body === 'paper' &&
        results.themeRestored === 'night' &&
        results.habit?.created &&
        results.habit?.dailyCard &&
        results.habit?.display === 'block' &&
        results.habit?.list &&
        results.habit?.pointsBelow &&
        results.habitComplete?.done &&
        results.habitComplete?.delta === 10 &&
        results.manager?.open &&
        results.manager?.edit &&
        results.manager?.remove &&
        results.bonus?.created &&
        results.bonus?.section &&
        results.bonus?.edit &&
        results.bonus?.remove &&
        results.bonusComplete?.done &&
        results.bonusComplete?.delta === 200 &&
        results.bonusUndo?.done === false &&
        results.habitUndo?.done === false &&
        results.complete?.ok &&
        results.double?.awarded === results.double?.base * 2 &&
        results.recurring?.count > 1 &&
        results.recurring?.badge &&
        results.recurringUndo === 0 &&
        results.undoComplete?.ok &&
        results.shift?.moved > 0 &&
        results.undoShift?.restored &&
        results.singleShift?.moved === 1 &&
        results.singleShift?.target !== results.singleShift?.source &&
        results.singleShift?.shiftCount === results.singleShift?.shiftCountBefore &&
        results.plan?.created &&
        results.plan?.tasks > 0 &&
        results.manualPlan?.created &&
        results.manualPlan?.tasks === 3 &&
        results.manualPlan?.points === 50 &&
        results.manualPlan?.weeks === 2 &&
        results.reward?.created &&
        results.rewardCards?.edit &&
        results.rewardCards?.remove &&
        results.poolCards?.edit &&
        results.poolCards?.remove &&
        results.poolEdit?.title === '编辑奖池' &&
        results.poolEdit?.prizeRows === results.poolEdit?.expectedRows &&
        results.poolEdit?.weightSteps?.includes('any') &&
        results.poolEdit?.weightsValid &&
        results.redeem?.spent === 10 &&
        results.redemptionsPage?.title === '兑换' &&
        results.redemptionsPage?.rows > 0 &&
        results.redemptionsPage?.filters === 3 &&
        results.redemption?.row &&
        results.redemption?.button &&
        results.redemption?.used === false &&
        results.redemptionUsed === true &&
        results.redemptionUndo === false &&
        results.draw?.phase === 'result' &&
        results.draw?.balance === results.draw?.expected &&
        results.setting?.changed &&
        results.compact?.ui &&
        results.compact?.body &&
        results.compact?.rows >= 3 &&
        results.compact?.daily &&
        results.compact?.week &&
        results.compactBounds?.height >= 160 &&
        !results.expanded?.ui,
    );
  } catch (error) {
    results.error = error?.stack || String(error);
    debugLog('selftest error', results.error);
  } finally {
    try {
      await fsp.mkdir(path.dirname(outFile), { recursive: true });
      await fsp.writeFile(
        outFile,
        JSON.stringify(
          {
            ...results,
            storeRevision: store.revision,
            hotkey: activeHotkey,
            trayAvailable: Boolean(tray),
            dataFile: store.file,
            dataFileExists: fs.existsSync(store.file),
            windowBounds: win?.getBounds(),
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch (error) {
      debugLog('selftest write failed', error?.stack || String(error));
    }
    isQuitting = true;
    app.quit();
  }
}

async function captureShots() {
  const outDir = path.join(OUT_DIR, 'screenshots');
  await fsp.mkdir(outDir, { recursive: true });
  await wait(1800);
  const capture = async (name) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const image = await win.webContents.capturePage();
        await fsp.writeFile(path.join(outDir, `${name}.png`), image.toPNG());
        return;
      } catch (error) {
        debugLog('capture failed', name, attempt, error?.message || String(error));
        await wait(450);
      }
    }
  };
  try {
    await win.webContents.executeJavaScript("window.__weekflowSetView?.('week')");
    await wait(300);
    await capture('week-empty');
    await win.webContents.executeJavaScript(`
      (() => {
        const ctx = window.__weekflowCtx;
        const A = window.__weekflowActions;
        A['quick-habit'](ctx, { dataset: { title: '锻炼 20 分钟', points: '10', icon: '🏃' } });
        A['quick-habit'](ctx, { dataset: { title: '读 20 页书', points: '10', icon: '📖' } });
        A['quick-habit'](ctx, { dataset: { title: '拉伸', points: '5', icon: '🧘' } });
        const first = ctx.state.habits[0];
        if (first) A['toggle-habit'](ctx, { dataset: { id: first.id } });
        A['new-bonus'](ctx);
        ctx.ui.modal.draft = {
          title: '整理一次桌面',
          detail: '把桌面、下载和收藏夹清一遍；没有截止时间。',
          icon: '✨',
          points: 200,
        };
        A['submit:bonus-form'](ctx);
        A['dismiss-toast'](ctx);
        ctx.ui.justHabit = null;
        ctx.render();
      })()
    `);
    await wait(500);
    await win.webContents.executeJavaScript("window.__weekflowSetView?.('week')");
    await wait(500);
    await capture('week');
    await win.webContents.executeJavaScript("document.querySelector('.main-scroll').scrollTop = 520");
    await wait(350);
    await capture('week-tasks');
    await win.webContents.executeJavaScript("document.querySelector('.main-scroll').scrollTop = 1180");
    await wait(350);
    await capture('week-bonus');
    await win.webContents.executeJavaScript("document.querySelector('.main-scroll').scrollTop = 0");
    await wait(250);
    await win.webContents.executeJavaScript("window.__weekflowActions['toggle-nav'](window.__weekflowCtx)");
    await wait(400);
    await capture('nav-open');
    await win.webContents.executeJavaScript("window.__weekflowActions['toggle-nav'](window.__weekflowCtx)");
    await win.webContents.executeJavaScript("window.__weekflowActions['toggle-appearance'](window.__weekflowCtx)");
    await wait(400);
    await capture('appearance');
    await win.webContents.executeJavaScript("window.__weekflowActions['set-theme'](window.__weekflowCtx, { dataset: { theme: 'paper' } })");
    await wait(350);
    await win.webContents.executeJavaScript("window.__weekflowActions['close-appearance'](window.__weekflowCtx)");
    await wait(350);
    await capture('week-paper');
    await win.webContents.executeJavaScript("window.__weekflowActions['set-theme'](window.__weekflowCtx, { dataset: { theme: 'night' } })");
    await wait(350);
    for (const view of SCREENSHOT_VIEWS) {
      await win.webContents.executeJavaScript(`window.__weekflowSetView?.(${JSON.stringify(view)})`);
      await wait(600);
      await capture(view);
      if (view === 'rewards') {
        await win.webContents.executeJavaScript(
          "document.querySelector('.main-scroll').scrollTop = 430",
        );
        await wait(350);
        await capture('rewards-pool');
      }
      if (view === 'settings') {
        await win.webContents.executeJavaScript(
          "document.querySelector('.main-scroll').scrollTop = 430",
        );
        await wait(350);
        await capture('settings-ai');
      }
    }

    await win.webContents.executeJavaScript("window.__weekflowSetView?.('week')");
    await wait(300);
    await win.webContents.executeJavaScript(`
      (() => {
        const ctx = window.__weekflowCtx;
        const task = ctx.state.tasks.find((item) => item.status !== 'done' && item.weekStart === ctx.currentWeek);
        if (task) window.__weekflowActions['task-actions'](ctx, { dataset: { id: task.id } });
      })()
    `);
    await wait(500);
    await capture('task-sheet');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowSetView?.('week')");
    await win.webContents.executeJavaScript("window.__weekflowActions['open-plan-wizard'](window.__weekflowCtx)");
    await win.webContents.executeJavaScript(`
      (() => {
        const ctx = window.__weekflowCtx;
        ctx.ui.modal.draft.goal = '未来三个月从零学 C++，做出一个可玩的小引擎';
        ctx.renderOverlayOnly();
      })()
    `);
    await wait(500);
    await capture('plan-form');
    await win.webContents.executeJavaScript("window.__weekflowActions['offline-plan'](window.__weekflowCtx)");
    await wait(500);
    await capture('plan-preview');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowActions['open-manual-plan'](window.__weekflowCtx)");
    await win.webContents.executeJavaScript(`
      (() => {
        const ctx = window.__weekflowCtx;
        ctx.ui.modal.draft.title = '三个月学会 C++';
        ctx.ui.modal.draft.goal = '从零开始，做出一个可玩的小引擎';
        ctx.ui.modal.draft.weekPlans[0] = { theme: '环境与语法', text: '装好编译器并跑通 Hello World\\n读完指针章节' };
        ctx.ui.modal.draft.weekPlans[1] = { theme: '指针与内存', text: '手写动态数组 | 25\\n用 ASan 查一次泄漏 | 15' };
        ctx.renderOverlayOnly();
      })()
    `);
    await wait(500);
    await capture('manual-plan');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowActions['new-task'](window.__weekflowCtx)");
    await wait(450);
    await capture('task-editor');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowActions['new-reward'](window.__weekflowCtx)");
    await wait(400);
    await capture('reward-editor');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowActions['new-pool'](window.__weekflowCtx)");
    await wait(450);
    await capture('pool-editor');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript(`
      (() => {
        const ctx = window.__weekflowCtx;
        const pool = ctx.state.pools[0];
        if (pool) window.__weekflowActions['draw-pool'](ctx, { dataset: { id: pool.id } });
      })()
    `);
    await wait(2300);
    await capture('draw-result');
    await win.webContents.executeJavaScript("window.__weekflowActions['close-modal'](window.__weekflowCtx)");

    await win.webContents.executeJavaScript("window.__weekflowSetView?.('week')");
    await win.webContents.executeJavaScript('window.__weekflowSetCompact?.(true)');
    await wait(350);
    applyCompact(true, { animate: false });
    await wait(800);
    await capture('compact');
  } catch (error) {
    debugLog('captureShots failed', error?.stack || String(error));
  } finally {
    isQuitting = true;
    app.quit();
  }
}

app.whenReady().then(async () => {
  debugLog('whenReady start');
  app.setAppUserModelId('com.weekflow.desktop');
  const dataDir = resolveDataDir(app);
  debugLog('dataDir', dataDir);
  store = new Store(dataDir);
  try {
    await store.init();
  } catch (error) {
    debugLog('store init failed', error?.stack || String(error));
    dialog.showErrorBox('周流无法启动', `数据目录无法访问：\n${dataDir}\n\n${error.message || error}`);
    app.quit();
    return;
  }

  if (IS_SHOT || IS_SELFTEST) {
    await store.replace(createDemoState());
  }

  registerIpc();
  registerHotkey();
  debugLog('creating window');
  await createWindow();
  debugLog('window created');
  createTray();

  if (IS_SELFTEST) await runSelfTest();
  else if (IS_SHOT) await captureShots();
}).catch((error) => {
  debugLog('whenReady failed', error?.stack || String(error));
});

app.on('second-instance', () => {
  showWindow();
});

app.on('activate', () => {
  showWindow();
});

app.on('window-all-closed', () => {
  // Keep the tray resident on every platform.
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
