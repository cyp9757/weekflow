import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Store } from '../src/main/store.mjs';
import { createTask } from '../src/shared/domain.js';

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'weekflow-store-test-'));
}

test('store persists state, increments revision, and detects conflicts', async () => {
  const dir = await tempDir();
  const store = new Store(dir);
  await store.init();
  const firstRevision = store.revision;
  const state = store.getState();
  createTask(state, { title: '持久化任务', weekStart: '2026-11-02', points: 15 }, new Date('2026-11-05T00:00:00Z'));

  const saved = await store.save(state, firstRevision);
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, firstRevision + 1);
  assert.equal(store.getState().tasks.length, 1);

  const conflict = await store.save(state, firstRevision);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);

  const reloaded = new Store(dir);
  await reloaded.init();
  assert.equal(reloaded.getState().tasks.length, 1);
  assert.equal(reloaded.getState().tasks[0].title, '持久化任务');
  assert.ok(reloaded.revision >= saved.revision);
});

test('store exports, imports, and keeps a recoverable backup', async () => {
  const dir = await tempDir();
  const store = new Store(dir);
  await store.init();
  const state = store.getState();
  const project = { ...state };
  project.meta.onboardingDismissed = true;
  await store.save(project, store.revision);

  const backupFile = path.join(dir, 'export.json');
  await store.exportTo(backupFile);
  const exported = JSON.parse(await fs.readFile(backupFile, 'utf8'));
  assert.equal(exported.meta.onboardingDismissed, true);

  exported.meta.onboardingDismissed = false;
  await fs.writeFile(backupFile, JSON.stringify(exported), 'utf8');
  const imported = await store.importFrom(backupFile);
  assert.equal(imported.state.meta.onboardingDismissed, false);

  const backups = await fs.readdir(path.join(dir, 'backups'));
  assert.ok(backups.some((name) => name.endsWith('.json')));
});
