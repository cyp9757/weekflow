const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('weekflow', {
  platform: process.platform,
  getBootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  saveState: (state, revision) => ipcRenderer.invoke('state:save', { state, revision }),
  exportData: () => ipcRenderer.invoke('state:export'),
  importData: () => ipcRenderer.invoke('state:import'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('app:set-always-on-top', enabled),
  setClickThrough: (enabled) => ipcRenderer.invoke('app:set-click-through', enabled),
  setCompact: (compact) => ipcRenderer.invoke('app:set-compact', compact),
  openDataDir: () => ipcRenderer.invoke('app:open-data-dir'),
  resetPosition: () => ipcRenderer.invoke('app:reset-position'),
  setLogin: (enabled) => ipcRenderer.invoke('app:set-login', enabled),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  show: () => ipcRenderer.invoke('app:show'),
  hide: () => ipcRenderer.invoke('app:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  setTraySummary: (summary) => ipcRenderer.invoke('tray:summary', summary),
  testAI: (config) => ipcRenderer.invoke('ai:test', config),
  planAI: (config, input) => ipcRenderer.invoke('ai:plan', { config, input }),
  onCompactChanged: (callback) => subscribe('app:compact-changed', callback),
  onClickThroughChanged: (callback) => subscribe('app:click-through-changed', callback),
  onSettingsChanged: (callback) => subscribe('app:settings-changed', callback),
});
