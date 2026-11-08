import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { normalizeState, createDefaultState, todayISO } from '../shared/domain.js';

const DATA_FILE = 'weekflow.json';
const REVISION_FILE = 'weekflow.revision.json';

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, DATA_FILE);
    this.revisionFile = path.join(dataDir, REVISION_FILE);
    this.backupDir = path.join(dataDir, 'backups');
    this.state = null;
    this.revision = 0;
    this.saveChain = Promise.resolve();
    this.lastBackupDate = null;
  }

  async init() {
    await fsp.mkdir(this.dataDir, { recursive: true });
    await fsp.mkdir(this.backupDir, { recursive: true });
    await this.#cleanupTemps();

    const revisionRaw = await this.#readJson(this.revisionFile, null);
    this.revision = Number(revisionRaw?.revision) || 0;

    const raw = await this.#readJson(this.file, null);
    if (raw) {
      try {
        this.state = normalizeState(raw);
      } catch (error) {
        await this.#quarantine();
        this.state = createDefaultState();
      }
    } else {
      this.state = createDefaultState();
      await this.#write(this.state);
    }
    return this.state;
  }

  async #cleanupTemps() {
    try {
      const names = await fsp.readdir(this.dataDir);
      await Promise.all(
        names
          .filter((name) => name.startsWith(`${DATA_FILE}.tmp-`))
          .map((name) => fsp.unlink(path.join(this.dataDir, name)).catch(() => {})),
      );
    } catch {
      // Best effort.
    }
  }

  async #readJson(file, fallback) {
    try {
      const text = await fsp.readFile(file, 'utf8');
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  async #quarantine() {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fsp.copyFile(this.file, path.join(this.backupDir, `corrupt-${stamp}.json`));
    } catch {
      // Best effort only.
    }
  }

  async #write(state) {
    const tmp = `${this.file}.tmp-${process.pid}`;
    const body = JSON.stringify(state, null, 2);
    await fsp.writeFile(tmp, body, 'utf8');
    await fsp.rename(tmp, this.file);
    this.revision += 1;
    await fsp.writeFile(
      this.revisionFile,
      JSON.stringify({ revision: this.revision, savedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  }

  async #dailyBackup() {
    const date = todayISO();
    if (this.lastBackupDate === date) return;
    this.lastBackupDate = date;
    try {
      await fsp.access(this.file);
      const target = path.join(this.backupDir, `weekflow-${date}.json`);
      await fsp.access(target).catch(() => fsp.copyFile(this.file, target));
      const files = (await fsp.readdir(this.backupDir))
        .filter((name) => /^weekflow-\d{4}-\d{2}-\d{2}\.json$/.test(name))
        .sort();
      for (const name of files.slice(0, Math.max(0, files.length - 21))) {
        await fsp.unlink(path.join(this.backupDir, name)).catch(() => {});
      }
    } catch {
      // Backups must never block saving.
    }
  }

  getState() {
    return this.state;
  }

  save(incoming, expectedRevision) {
    const run = async () => {
      if (Number(expectedRevision) !== this.revision) {
        return {
          ok: false,
          conflict: true,
          error: '数据已被其他窗口更新，请刷新后重试',
          revision: this.revision,
          state: this.state,
        };
      }
      const next = normalizeState(incoming);
      await this.#dailyBackup();
      this.state = next;
      await this.#write(next);
      return { ok: true, revision: this.revision, state: next };
    };
    this.saveChain = this.saveChain.then(run, run);
    return this.saveChain;
  }

  async replace(incoming) {
    const next = normalizeState(incoming);
    await this.#dailyBackup();
    this.state = next;
    await this.#write(next);
    return { ok: true, revision: this.revision, state: next };
  }

  async exportTo(target) {
    const body = JSON.stringify(this.state, null, 2);
    await fsp.writeFile(target, body, 'utf8');
    return target;
  }

  async importFrom(source) {
    const text = await fsp.readFile(source, 'utf8');
    const raw = JSON.parse(text);
    const next = normalizeState(raw);
    await this.replace(next);
    return { state: next, revision: this.revision };
  }

  windowStateFile() {
    return path.join(this.dataDir, 'window-state.json');
  }

  async readWindowState() {
    return this.#readJson(this.windowStateFile(), null);
  }

  async writeWindowState(bounds) {
    try {
      await fsp.writeFile(this.windowStateFile(), JSON.stringify(bounds, null, 2), 'utf8');
    } catch {
      // Window position persistence is optional.
    }
  }

  async ensureDir() {
    await fsp.mkdir(this.dataDir, { recursive: true });
  }
}

export function resolveDataDir(app, fsModule = fs) {
  if (process.env.WEEKFLOW_DATA_DIR) {
    return path.resolve(process.env.WEEKFLOW_DATA_DIR);
  }
  if (app.isPackaged) {
    const executableDir = path.dirname(process.execPath);
    const flag = path.join(executableDir, 'weekflow-portable.flag');
    if (fsModule.existsSync(flag)) {
      return path.join(executableDir, 'data');
    }
  }
  return app.getPath('userData');
}
