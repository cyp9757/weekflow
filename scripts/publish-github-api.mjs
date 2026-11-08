import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'cyp9757';
const REPO = 'weekflow';
const BRANCH = 'main';
const API = 'https://api.github.com';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'data', '.npm-cache']);
const EXCLUDED_FILES = new Set([
  'scripts/import-bili-plan.mjs',
  'scripts/import-stock-basics.mjs',
  'scripts/import-vibe-plan.mjs',
  'docs/images/task-editor.jpg',
]);
const EXCLUDED_EXTENSIONS = new Set(['.log']);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
if (!token) {
  console.error('Missing GITHUB_TOKEN (or GH_TOKEN). Create a fine-grained PAT with Contents: Read and write.');
  process.exit(2);
}

const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;
const changelog = await fs.readFile(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const sectionMarker = `## [${version}]`;
const sectionStart = changelog.indexOf(sectionMarker);
const nextSection = changelog.indexOf('\n## [', sectionStart + sectionMarker.length);
const releaseBody =
  sectionStart >= 0
    ? changelog
        .slice(sectionStart + sectionMarker.length, nextSection > sectionStart ? nextSection : undefined)
        .trim()
    : `Release ${version}`;

async function api(method, url, body) {
  const response = await fetch(`${API}${url}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'WeekFlow-Publisher',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${url} -> ${response.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function listFiles(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...(await listFiles(absolute, relative)));
      continue;
    }
    if (EXCLUDED_FILES.has(relative) || EXCLUDED_EXTENSIONS.has(path.extname(relative))) continue;
    files.push({ relative, absolute });
  }
  return files;
}

// GitHub's Git Data API refuses blobs until the repository has an initial commit.
// Seed an empty repository through the Contents API first.
try {
  await api('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
} catch (error) {
  if (String(error.message).includes('404') || String(error.message).includes('409')) {
    await api('PUT', `/repos/${OWNER}/${REPO}/contents/README.md`, {
      message: 'Initialize repository',
      content: Buffer.from('# WeekFlow\n\nSource repository for the WeekFlow desktop planner.\n').toString('base64'),
      branch: BRANCH,
    });
  } else {
    throw error;
  }
}

const files = (await listFiles(ROOT)).sort((a, b) => a.relative.localeCompare(b.relative));
const blobs = [];
for (const file of files) {
  const content = await fs.readFile(file.absolute);
  const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: content.toString('base64'),
    encoding: 'base64',
  });
  blobs.push({ path: file.relative, mode: '100644', type: 'blob', sha: blob.sha });
  process.stdout.write(`uploaded ${file.relative}\n`);
}

const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: blobs });
let parent = null;
try {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  parent = ref.object.sha;
} catch (error) {
  // Empty repositories return 404/409 until the first commit exists.
  if (!String(error.message).includes('404') && !String(error.message).includes('409')) throw error;
}

const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: `release: v${version}`,
  tree: tree.sha,
  parents: parent ? [parent] : [],
  author: { name: OWNER, email: 'cyp592415664@gmail.com' },
  committer: { name: OWNER, email: 'cyp592415664@gmail.com' },
});

if (parent) {
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: commit.sha,
    force: false,
  });
} else {
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
    ref: `refs/heads/${BRANCH}`,
    sha: commit.sha,
  });
}

try {
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
    ref: `refs/tags/${tagName}`,
    sha: commit.sha,
  });
} catch (error) {
  if (!String(error.message).includes('422')) throw error;
  console.log(`Tag ${tagName} already exists; skipped.`);
}

try {
  await api('POST', `/repos/${OWNER}/${REPO}/releases`, {
    tag_name: tagName,
    name: tagName,
    body: releaseBody,
    draft: false,
    prerelease: false,
  });
} catch (error) {
  if (!String(error.message).includes('422')) throw error;
  console.log(`Release ${tagName} already exists; skipped.`);
}

console.log(`\nPublished ${files.length} files to https://github.com/${OWNER}/${REPO}`);
console.log(`Version: ${tagName}`);
console.log(`Commit: ${commit.sha}`);
