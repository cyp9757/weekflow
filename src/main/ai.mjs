import {
  chatEndpoint,
  describeAiError,
  extractJson,
  modelsEndpoint,
  normalizeBaseUrl,
} from '../shared/planner.js';
import { normalizePlan } from '../shared/domain.js';

const DEFAULT_TIMEOUT = 180_000;

function authHeaders(apiKey) {
  const key = String(apiKey || '').trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function readError(response) {
  let detail = '';
  try {
    const text = await response.text();
    detail = text.slice(0, 500);
  } catch {
    detail = '';
  }
  return new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
}

async function withTimeout(run, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function testAi(config = {}) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const timeout = Math.min(Math.max(Number(config.timeoutMs) || 15_000, 3_000), 60_000);
  try {
    const response = await withTimeout(
      (signal) =>
        fetch(modelsEndpoint(baseUrl), {
          method: 'GET',
          headers: { ...authHeaders(config.apiKey) },
          signal,
        }),
      timeout,
    );
    if (!response.ok) {
      if (response.status === 404) {
        // Some gateways only expose chat/completions. A minimal chat is the real test.
        return await testChat(config);
      }
      throw await readError(response);
    }
    const data = await response.json();
    const models = Array.isArray(data?.data)
      ? data.data.map((item) => item.id).filter(Boolean).slice(0, 80)
      : [];
    return {
      ok: true,
      models,
      message: models.length ? `连接成功，发现 ${models.length} 个模型` : '连接成功',
    };
  } catch (error) {
    return { ok: false, error: describeAiError(error) };
  }
}

async function testChat(config = {}) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = String(config.model || 'local-model').trim();
  const response = await withTimeout(
    (signal) =>
      fetch(chatEndpoint(baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(config.apiKey) },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '只回复 OK' }],
          temperature: 0,
          max_tokens: 8,
          stream: false,
        }),
        signal,
      }),
    20_000,
  );
  if (!response.ok) throw await readError(response);
  const data = await response.json();
  return {
    ok: true,
    models: [],
    message: data?.choices?.[0]?.message?.content ? '连接成功' : '接口有响应，但返回格式不常见',
  };
}

function contentFromResponse(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error('AI 接口没有返回 choices[0].message');
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  throw new Error('AI 接口返回了空内容');
}

async function requestPlan(config, messages, useJsonMode) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = String(config.model || 'local-model').trim();
  const timeout = Math.min(Math.max(Number(config.timeoutMs) || DEFAULT_TIMEOUT, 10_000), 600_000);
  const body = {
    model,
    messages,
    temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.4,
    stream: false,
  };
  if (useJsonMode) body.response_format = { type: 'json_object' };

  const response = await withTimeout(
    (signal) =>
      fetch(chatEndpoint(baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(config.apiKey) },
        body: JSON.stringify(body),
        signal,
      }),
    timeout,
  );

  if (!response.ok) {
    const error = await readError(response);
    if (useJsonMode && /HTTP 400/.test(error.message) && /response_format|json/i.test(error.message)) {
      return { retryWithoutJson: true, error };
    }
    throw error;
  }
  const data = await response.json();
  return { content: contentFromResponse(data) };
}

export async function generatePlan(config = {}, messages = []) {
  try {
    let result = await requestPlan(config, messages, Boolean(config.jsonMode));
    if (result.retryWithoutJson) {
      result = await requestPlan(config, messages, false);
    }
    const raw = extractJson(result.content);
    let candidate = raw;
    if (Array.isArray(raw)) candidate = { weeks: raw };
    if (!candidate.weeks && Array.isArray(candidate.plan?.weeks)) candidate = candidate.plan;
    const plan = normalizePlan(candidate, 'AI 周计划');
    return { ok: true, plan };
  } catch (error) {
    return { ok: false, error: describeAiError(error) };
  }
}
