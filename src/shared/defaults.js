export const PROJECT_COLORS = [
  '#E7B87C',
  '#9DB8A0',
  '#9AA9D6',
  '#D79A9A',
  '#B8A3D4',
  '#83B7B5',
  '#C9B27A',
  '#A8AFB8',
];

export const THEMES = [
  {
    id: 'night',
    label: '墨夜',
    accent: '#E7B87C',
    swatch: '#191714',
    hint: '暖金与深墨',
  },
  {
    id: 'forest',
    label: '苔林',
    accent: '#A8C7A5',
    swatch: '#12211D',
    hint: '低饱和苔绿',
  },
  {
    id: 'plum',
    label: '暮紫',
    accent: '#D6A6C8',
    swatch: '#211622',
    hint: '暗紫与暮色',
  },
  {
    id: 'paper',
    label: '米白',
    accent: '#B47A38',
    swatch: '#F4EEE2',
    hint: '浅色纸感',
  },
];

export const DEFAULT_SETTINGS = {
  theme: 'night',
  alwaysOnTop: true,
  autoFade: false,
  doublePoints: true,
  holidayDates: [],
  fadeOpacity: 0.5,
  panelOpacity: 0.72,
  accent: '#E7B87C',
  launchAtLogin: false,
  clickThrough: false,
  compact: false,
  reduceMotion: false,
  weekOrder: ['daily', 'week', 'bonus'],
  ai: {
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
    model: 'qwen2.5:7b',
    temperature: 0.4,
    jsonMode: true,
  },
};

export const AI_PRESETS = {
  ollama: {
    label: 'Ollama（本机）',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    needsKey: false,
    hint: '先运行 ollama serve，并已 pull 一个模型',
  },
  lmstudio: {
    label: 'LM Studio（本机）',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'local-model',
    needsKey: false,
    hint: '在 LM Studio 中启动 Local Server',
  },
  deepseek: {
    label: 'DeepSeek API',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    needsKey: true,
    hint: '需要联网与 API Key',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    needsKey: true,
    hint: '需要联网与 API Key',
  },
  custom: {
    label: '自定义 OpenAI 兼容接口',
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: '',
    needsKey: false,
    hint: '任何兼容 /chat/completions 的服务',
  },
};

export function defaultRewards() {
  return [
    { id: 'rw_movie', title: '看一场电影', cost: 80, icon: '🎬', note: '关掉手机，完整地看一部。', archived: false },
    { id: 'rw_milktea', title: '一杯喜欢的奶茶', cost: 30, icon: '🧋', note: '小奖励，立刻兑现。', archived: false },
    { id: 'rw_game', title: '游戏之夜', cost: 120, icon: '🎮', note: '两小时，不带着愧疚玩。', archived: false },
    { id: 'rw_sleep', title: '睡到自然醒', cost: 60, icon: '🛌', note: '周末任选一天。', archived: false },
    { id: 'rw_trip', title: '周末短途出走', cost: 400, icon: '🚞', note: '去一个没去过的地方。', archived: false },
  ];
}

export function defaultPools() {
  return [
    {
      id: 'pool_deep',
      title: '深空奖池',
      subtitle: '大概率空手而归，小概率带走一大笔。',
      cost: 100,
      icon: '🌌',
      prizes: [
        { id: 'pz_0', label: '空手而归', weight: 65, points: 0 },
        { id: 'pz_1', label: '回一点血', weight: 20, points: 20 },
        { id: 'pz_2', label: '小小惊喜', weight: 9, points: 80 },
        { id: 'pz_3', label: '今晚走运', weight: 4, points: 300 },
        { id: 'pz_4', label: '深空回响', weight: 1.5, points: 1500 },
        { id: 'pz_5', label: '传说级大奖', weight: 0.5, points: 8888 },
      ],
    },
  ];
}

export function defaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}
