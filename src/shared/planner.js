import { clamp, todayISO } from './domain.js';

export const PLAN_SYSTEM_PROMPT = `你是「周流」的首席学习与项目教练。你的工作是把一个长期目标拆成每周可执行、可验收的小步，而不是写励志建议。

输出必须是严格的 JSON 对象，不要 Markdown 代码围栏，不要解释，不要前后缀。结构：
{
  "title": "不超过 24 字的项目名",
  "summary": "2-3 句话：路径、每周投入、最终可验收成果",
  "weeks": [
    {
      "week": 1,
      "theme": "本周主题，不超过 18 字",
      "outcome": "本周结束时可以检查的产出，不超过 60 字",
      "tasks": [
        {
          "title": "具体动作，动词开头，不超过 28 字",
          "detail": "怎么做、做到什么程度，不超过 120 字",
          "points": 15,
          "estimateMin": 90
        }
      ]
    }
  ]
}

硬性规则：
1. weeks 数组长度必须等于用户要求的总周数，week 从 1 连续编号。
2. 每周 2-4 个任务，任务必须能在当周独立完成；不要出现“继续学习”“努力提升”这类无法验收的动作。
3. 第一周先做目标校准、环境准备或基线测试；最后一周留出整合、验收和复盘。
4. 每周至少有一个可展示、可检查的产出（练习、笔记、小项目、测试成绩、作品片段等）。
5. points 为 8-40 的整数，按预计投入和难度给分；普通任务约 15 分。
6. estimateMin 为预计分钟数，必须与每周可用时间大致匹配。
7. 如果用户信息不足，采用常见合理路径，并在 summary 里用一句话说明假设；不要编造用户已掌握的技能。
8. 全部使用简体中文。不要输出任何 JSON 以外的字符。`;

export function buildPlannerMessages(input = {}) {
  const weeks = Math.round(clamp(input.weeks ?? 12, 1, 52));
  const hoursPerWeek = clamp(input.hoursPerWeek ?? 5, 0.5, 60);
  const level = String(input.level || '入门').slice(0, 40);
  const goal = String(input.goal || '').trim().slice(0, 2000);
  const notes = String(input.notes || '').trim().slice(0, 1000);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate || '')
    ? input.startDate
    : todayISO();

  const user = `请为我制定周计划。

目标：${goal || '（未填写）'}
当前水平：${level}
总周数：${weeks} 周
每周可投入：${hoursPerWeek} 小时
开始日期：${startDate}
额外约束/偏好：${notes || '无'}

请只返回 JSON。`;

  return [
    { role: 'system', content: PLAN_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

export function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('请填写 AI 接口地址');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('AI 接口地址格式不正确');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('AI 接口只支持 http / https');
  }
  return url.toString().replace(/\/+$/, '');
}

export function chatEndpoint(baseUrl) {
  const clean = normalizeBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(clean)) return clean;
  return `${clean}/chat/completions`;
}

export function modelsEndpoint(baseUrl) {
  const clean = normalizeBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(clean)) return clean.replace(/\/chat\/completions$/i, '/models');
  return `${clean}/models`;
}

export function extractJson(text) {
  if (typeof text !== 'string') throw new Error('AI 返回内容为空');
  let source = text.trim().replace(/^\uFEFF/, '');
  source = source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(source);
  } catch {
    // Fall through to balanced-object extraction.
  }

  const start = source.indexOf('{');
  if (start === -1) throw new Error('AI 返回内容里没有 JSON');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = source.slice(start, index + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          throw new Error('AI 返回的 JSON 格式不完整');
        }
      }
    }
  }
  throw new Error('AI 返回的 JSON 不完整');
}

export function describeAiError(error) {
  const message = String(error?.message || error || '未知错误');
  if (/abort/i.test(message)) return 'AI 请求超时了。本机模型可能需要更久，请检查模型是否已加载。';
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return '连不上 AI 接口。若使用本机模型，请确认 Ollama / LM Studio 已启动，且地址与端口正确。';
  }
  if (/401|403/.test(message)) return 'AI 接口拒绝了请求，请检查 API Key。';
  if (/404/.test(message)) {
    return '接口路径不存在。地址通常以 /v1 结尾，例如 http://127.0.0.1:11434/v1。';
  }
  if (/429/.test(message)) return 'AI 服务限流或额度不足，请稍后再试。';
  return message.slice(0, 300);
}
