import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { packager } = require('@electron/packager');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const buildId = `${pkg.version}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const launcher = `@echo off
setlocal
title WeekFlow
set "ROOT=%~dp0"
set "RUNTIME=%LOCALAPPDATA%\\WeekFlow\\runtime"
set "DATA=%ROOT%data"

if not exist "%DATA%" mkdir "%DATA%" >nul 2>&1

if not exist "%RUNTIME%\\WeekFlowApp.exe" goto copy
tasklist /FI "IMAGENAME eq WeekFlowApp.exe" 2>nul | find /I "WeekFlowApp.exe" >nul
if not errorlevel 1 goto run
if not exist "%RUNTIME%\\build-id.txt" goto copy
fc /b "%ROOT%build-id.txt" "%RUNTIME%\\build-id.txt" >nul 2>&1
if errorlevel 1 goto copy
goto run

:copy
echo Preparing WeekFlow runtime (first launch only)...
if exist "%RUNTIME%" rmdir /s /q "%RUNTIME%" >nul 2>&1
mkdir "%RUNTIME%" >nul 2>&1
robocopy "%ROOT%." "%RUNTIME%" /E /XD "%ROOT%data" "%ROOT%docs" /XF "START_WEEKFLOW.cmd" "HOW_TO_START.txt" "weekflow-portable.flag" /NFL /NDL /NJH /NJS /NP /R:1 /W:1 >nul
if errorlevel 8 goto fail
copy /y "%ROOT%build-id.txt" "%RUNTIME%\\build-id.txt" >nul
goto run

:run
set "WEEKFLOW_DATA_DIR=%DATA%"
start "" "%RUNTIME%\\WeekFlowApp.exe"
exit /b 0

:fail
echo.
echo Could not prepare the runtime. Move this folder outside the DSH workspace and try again.
pause
exit /b 1
`;

const startHelp = `请双击 START_WEEKFLOW.cmd 启动，不要直接双击 WeekFlowApp.exe。

原因：如果这个文件夹位于 DSH 的 default-workspace 下，Windows 会阻止其中的 GUI 程序启动（连记事本也会立即退出）。启动器先把运行文件复制到：
  %LOCALAPPDATA%\\WeekFlow\\runtime
再从那里启动。你的数据仍然保存在当前文件夹的 data\\ 中。

首次启动需要复制约 350 MB，通常几秒钟。之后启动会直接复用。
`;

const appPaths = await packager({
  dir: ROOT,
  name: 'WeekFlow',
  executableName: 'WeekFlow',
  appVersion: pkg.version,
  buildVersion: pkg.version,
  platform: 'win32',
  arch: 'x64',
  out: path.join(ROOT, 'dist'),
  overwrite: true,
  asar: true,
  prune: true,
  icon: path.join(ROOT, 'assets', 'icon.ico'),
  electronVersion: '43.3.0',
  ignore: [
    /^\/dist($|\/)/,
    /^\/probe($|\/)/,
    /^\/test($|\/)/,
    /^\/scripts($|\/)/,
    /^\/\.npm-cache($|\/)/,
    /^\/\.git($|\/)/,
    /^\/docs\/screenshots($|\/)/,
  ],
  win32metadata: {
    CompanyName: 'WeekFlow',
    FileDescription: 'WeekFlow 周流 - 透明每周待办',
    ProductName: 'WeekFlow 周流',
    OriginalFilename: 'WeekFlowApp.exe',
    InternalName: 'WeekFlow',
  },
});

for (const appPath of appPaths) {
  const runtimeExe = path.join(appPath, 'WeekFlow.exe');
  const renamedExe = path.join(appPath, 'WeekFlowApp.exe');
  try {
    await fs.access(runtimeExe);
    await fs.rename(runtimeExe, renamedExe);
  } catch {
    // Already renamed by a previous run.
  }

  await fs.writeFile(
    path.join(appPath, 'weekflow-portable.flag'),
    'Portable mode: data is stored in the data/ folder next to the launcher.\n',
    'utf8',
  );
  await fs.writeFile(path.join(appPath, 'build-id.txt'), `${buildId}\n`, 'utf8');
  await fs.writeFile(path.join(appPath, 'START_WEEKFLOW.cmd'), launcher.replace(/\n/g, '\r\n'), 'utf8');
  await fs.writeFile(path.join(appPath, 'HOW_TO_START.txt'), startHelp.replace(/\n/g, '\r\n'), 'utf8');
  await fs.cp(path.join(ROOT, 'docs'), path.join(appPath, 'docs'), { recursive: true });
  await fs.copyFile(path.join(ROOT, 'README.md'), path.join(appPath, 'README.md'));
  await fs.copyFile(path.join(ROOT, 'CHANGELOG.md'), path.join(appPath, 'CHANGELOG.md'));
  console.log(`packaged: ${appPath}`);
  console.log(`build id: ${buildId}`);
}

console.log('Build complete. Run scripts/zip.ps1 to make the portable archive.');
