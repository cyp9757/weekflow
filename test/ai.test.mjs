import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { generatePlan, testAi } from '../src/main/ai.mjs';

function mockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/v1` });
    });
  });
}

test('AI client discovers models and parses a plan', async () => {
  const plan = {
    title: 'C++ 12 周',
    summary: '从语法到小引擎。',
    weeks: [
      {
        week: 1,
        theme: '地基',
        outcome: '跑通第一个程序',
        tasks: [
          { title: '装好编译器', detail: '跑通 Hello World', points: 10, estimateMin: 45 },
          { title: '写完基础练习', detail: '完成 10 道小题', points: 15, estimateMin: 90 },
        ],
      },
      {
        week: 2,
        theme: '指针',
        outcome: '手写动态数组',
        tasks: [{ title: '实现动态数组', detail: '支持 push 和 resize', points: 25, estimateMin: 120 }],
      },
    ],
  };
  const { server, baseUrl } = await mockServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const payload = JSON.parse(body);
        assert.equal(payload.model, 'mock-model');
        assert.equal(payload.response_format.type, 'json_object');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(plan) } }],
          }),
        );
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  try {
    const connection = await testAi({ baseUrl, model: 'mock-model', timeoutMs: 5000 });
    assert.equal(connection.ok, true);
    assert.deepEqual(connection.models, ['mock-model']);

    const result = await generatePlan(
      { baseUrl, model: 'mock-model', jsonMode: true, timeoutMs: 5000 },
      [{ role: 'user', content: '请制定计划' }],
    );
    assert.equal(result.ok, true);
    assert.equal(result.plan.title, 'C++ 12 周');
    assert.equal(result.plan.weeks.length, 2);
    assert.equal(result.plan.weeks[1].tasks[0].points, 25);
  } finally {
    server.close();
  }
});

test('AI client surfaces a readable connection error', async () => {
  const result = await testAi({
    baseUrl: 'http://127.0.0.1:1/v1',
    model: 'none',
    timeoutMs: 3000,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /连不上|超时/);
});
