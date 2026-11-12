import { AI_PRESETS } from '../../shared/defaults.js';
import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/format.js';
import { renderThemeTiles } from './appearance.js';

const ACCENTS = ['#E7B87C', '#A8C7A5', '#D6A6C8', '#B47A38', '#9AA9D6', '#D79A9A'];

function switchRow({ setting, name, desc, checked, iconName }) {
  return `
    <label class="setting-row">
      <span class="setting-copy">
        <span class="setting-name">${iconName ? icon(iconName, 13) : ''}${escapeHtml(name)}</span>
        <span class="setting-desc">${desc}</span>
      </span>
      <span class="setting-control">
        <input type="checkbox" data-setting="${setting}" ${checked ? 'checked' : ''} />
        <span class="switch"></span>
      </span>
    </label>
  `;
}

function aiStatus(ctx) {
  const config = ctx.state.settings.ai;
  const preset = AI_PRESETS[config.provider] || AI_PRESETS.custom;
  if (ctx.ui.aiTest?.state === 'loading') {
    return `<div class="ai-status"><span class="dot"></span><span>正在连接 ${escapeHtml(config.baseUrl)}…</span></div>`;
  }
  if (ctx.ui.aiTest?.state === 'ok') {
    return `<div class="ai-status ok"><span class="dot"></span><span>${escapeHtml(ctx.ui.aiTest.message || '连接成功')}</span></div>`;
  }
  if (ctx.ui.aiTest?.state === 'error') {
    return `<div class="ai-status error"><span class="dot"></span><span>${escapeHtml(ctx.ui.aiTest.message)}</span></div>`;
  }
  return `<div class="ai-status"><span class="dot"></span><span>${escapeHtml(preset.label)} · ${escapeHtml(config.model || '未选择模型')}</span></div>`;
}

function renderAiForm(ctx) {
  const config = ctx.state.settings.ai;
  return `
    <div class="ai-form">
      <div class="field">
        <label>接口类型</label>
        <select class="select" data-ai-field="provider">
          ${Object.entries(AI_PRESETS)
            .map(
              ([key, preset]) =>
                `<option value="${key}" ${config.provider === key ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`,
            )
            .join('')}
        </select>
      </div>
      <div class="field">
        <label>接口地址</label>
        <input class="input" data-ai-field="baseUrl" value="${escapeHtml(config.baseUrl)}" spellcheck="false" placeholder="http://127.0.0.1:11434/v1" />
        <div class="hint">OpenAI 兼容地址，通常以 <code>/v1</code> 结尾。Ollama 默认 <code>127.0.0.1:11434/v1</code>。</div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>模型</label>
          <input class="input" data-ai-field="model" value="${escapeHtml(config.model)}" spellcheck="false" placeholder="qwen2.5:7b" list="ai-models" />
          <datalist id="ai-models">${(ctx.ui.aiModels || []).map((model) => `<option value="${escapeHtml(model)}"></option>`).join('')}</datalist>
        </div>
        <div class="field">
          <label>API Key（本机模型可空）</label>
          <div style="position:relative">
            <input class="input" type="${ctx.ui.showKey ? 'text' : 'password'}" data-ai-field="apiKey" value="${escapeHtml(config.apiKey)}" spellcheck="false" autocomplete="off" style="padding-right:30px" />
            <button class="icon-btn small" data-action="toggle-key" aria-label="显示或隐藏 Key" style="position:absolute;right:3px;top:3px">${icon(ctx.ui.showKey ? 'eyeOff' : 'eye', 13)}</button>
          </div>
        </div>
      </div>
      <div class="field">
        <label>随机度 <span class="faint" style="font-weight:400">${Number(config.temperature).toFixed(1)}</span></label>
        <input type="range" min="0" max="1" step="0.1" value="${config.temperature}" data-ai-field="temperature" />
      </div>
      <label class="check-row">
        <input type="checkbox" data-ai-field="jsonMode" ${config.jsonMode ? 'checked' : ''} />
        要求模型返回 JSON 模式（部分本机模型不支持，失败会自动重试）
      </label>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-secondary btn-sm" data-action="test-ai">
          ${icon(ctx.ui.aiTest?.state === 'loading' ? 'refresh' : 'robot', 13)} ${ctx.ui.aiTest?.state === 'loading' ? '测试中…' : '测试连接'}
        </button>
        <span class="hint" style="margin:0;flex:1">只在你点“生成周计划”时发送目标文本。</span>
      </div>
    </div>
  `;
}

export function renderSettings(ctx) {
  const { settings } = ctx.state;
  const provider = AI_PRESETS[settings.ai.provider] || AI_PRESETS.custom;
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Preferences</div>
          <h1 class="page-title">设置</h1>
          <div class="page-sub">让它更像桌面上的一件小东西，而不是一个后台。</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">启动</div>
        <div class="settings-card">
          ${switchRow({
            setting: 'launchAtLogin',
            name: '开机自动启动',
            desc: '登录 Windows 后自动显示周流；开关状态会与系统启动项同步。',
            checked: settings.launchAtLogin,
            iconName: 'play',
          })}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">桌面</div>
        <div class="settings-card">
          ${switchRow({
            setting: 'alwaysOnTop',
            name: '窗口置顶',
            desc: '总在其他窗口之上。不想被挡住时可以关掉。',
            checked: settings.alwaysOnTop,
            iconName: 'pin',
          })}
          ${switchRow({
            setting: 'autoFade',
            name: '自动淡出',
            desc: '默认关闭。开启后鼠标移开会变淡；如遇点击异常，先关掉它。',
            checked: settings.autoFade,
            iconName: 'eyeOff',
          })}
          ${switchRow({
            setting: 'doublePoints',
            name: '周末 / 节假日双倍',
            desc: '周六日或自定义节假日完成任务，积分 ×2。',
            checked: settings.doublePoints,
            iconName: 'sparkles',
          })}
          <div class="setting-row" style="display:block;padding-top:9px;padding-bottom:10px">
            <div class="setting-copy" style="margin-bottom:6px">
              <span class="setting-name">${icon('calendar', 13)} 额外双倍日期</span>
              <span class="setting-desc">周末自动双倍；法定节假日或调休日可在这里补充。</span>
            </div>
            <input class="input" data-holiday-dates value="${escapeHtml((settings.holidayDates || []).join(', '))}" placeholder="2026-12-25, 2027-01-01" />
            <div class="hint" style="margin-top:5px">逗号分隔，格式 YYYY-MM-DD；留空表示只按周末双倍。</div>
          </div>
          <div class="setting-row" style="display:block;padding-top:11px;padding-bottom:10px">
            <div class="setting-copy" style="margin-bottom:7px">
              <span class="setting-name">${icon('sun', 13)} 主题</span>
              <span class="setting-desc">不只是黑色；也可以换成苔绿、暮紫或米白纸感。</span>
            </div>
            <div class="theme-grid">${renderThemeTiles(settings.theme)}</div>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('sliders', 13)} 面板不透明度</span>
              <span class="setting-desc">越透明越轻，也越难读。</span>
            </span>
            <span class="setting-control">
              <span class="range-wrap">
                <input type="range" min="0.45" max="1" step="0.01" value="${settings.panelOpacity}" data-range="panelOpacity" />
                <span class="range-value" id="panel-opacity-value">${Math.round(settings.panelOpacity * 100)}%</span>
              </span>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('eye', 13)} 淡出程度</span>
              <span class="setting-desc">自动淡出后保留多少可见度。</span>
            </span>
            <span class="setting-control">
              <span class="range-wrap">
                <input type="range" min="0.2" max="1" step="0.01" value="${settings.fadeOpacity}" data-range="fadeOpacity" />
                <span class="range-value" id="fade-opacity-value">${Math.round(settings.fadeOpacity * 100)}%</span>
              </span>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('sparkles', 13)} 强调色</span>
              <span class="setting-desc">只影响按钮、积分和进度。</span>
            </span>
            <span class="setting-control accent-dots">
              ${ACCENTS.map(
                (color) =>
                  `<button class="accent-dot ${settings.accent.toLowerCase() === color.toLowerCase() ? 'active' : ''}" data-action="set-accent" data-color="${color}" style="background:${color}" aria-label="强调色 ${color}"></button>`,
              ).join('')}
            </span>
          </div>
          ${switchRow({
            setting: 'reduceMotion',
            name: '减少动态效果',
            desc: '关闭弹层、勾选和抽奖的动画。',
            checked: settings.reduceMotion,
            iconName: 'flame',
          })}
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('expand', 13)} 桌面小条</span>
              <span class="setting-desc">收成小周视图：每日全部、每周按项目分组。</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-secondary btn-sm" data-action="toggle-compact">${ctx.ui.compact ? '展开' : '收起'}</button>
            </span>
          </div>
          ${switchRow({
            setting: 'clickThrough',
            name: '鼠标穿透',
            desc: `开启后点击会落到桌面。按 ${ctx.hotkey || '托盘菜单'} 或使用托盘恢复。`,
            checked: ctx.ui.clickThrough,
            iconName: 'mouse',
          })}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">AI 规划</div>
        <div class="settings-card">
          <div style="padding:10px 11px">
            ${aiStatus(ctx)}
            <div class="setting-name" style="margin-bottom:2px">${escapeHtml(provider.label)}</div>
            <div class="setting-desc" style="word-break:break-all">${escapeHtml(settings.ai.baseUrl)} · ${escapeHtml(settings.ai.model || '未设置模型')}</div>
            <div class="row" style="margin-top:9px">
              <button class="btn btn-secondary btn-sm" data-action="toggle-ai-form">${icon('sliders', 12)} ${ctx.ui.aiOpen ? '收起配置' : '配置 AI'}</button>
              <button class="btn btn-ghost btn-sm" data-action="test-ai">${icon('refresh', 12)} 测试</button>
            </div>
          </div>
          ${ctx.ui.aiOpen ? renderAiForm(ctx) : ''}
        </div>
        <div class="hint" style="padding:0 2px">
          本机模型推荐 Ollama 或 LM Studio，不需要把目标发到云端。远程接口需要 Key，配置以明文保存在本机 JSON，请勿在共享电脑上保存敏感 Key。
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">快捷键与窗口</div>
        <div class="settings-card">
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('maximize', 13)} 显示 / 隐藏</span>
              <span class="setting-desc">${ctx.hotkey ? '任何时候都能把周流叫回来。' : '快捷键被占用，暂时只能用托盘打开。'}</span>
            </span>
            <span class="setting-control">
              <kbd style="font-size:9px;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:3px 6px;background:rgb(255 255 255 / 3%)">${escapeHtml(ctx.hotkey || '不可用')}</kbd>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('maximize', 13)} 窗口位置</span>
              <span class="setting-desc">如果拖到屏幕外，点这里回到右上角。</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-secondary btn-sm" data-action="reset-position">复位</button>
            </span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">数据</div>
        <div class="settings-card">
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('folder', 13)} 本地数据</span>
              <span class="setting-desc" style="word-break:break-all">${escapeHtml(ctx.dataDir)}</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-secondary btn-sm" data-action="open-data-dir">打开</button>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('download', 13)} 备份与迁移</span>
              <span class="setting-desc">导出一个 JSON，换电脑时再导入。</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-secondary btn-sm" data-action="export-data">导出</button>
              <button class="btn btn-ghost btn-sm" data-action="import-data">导入</button>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name">${icon('layers', 13)} 示例数据</span>
              <span class="setting-desc">载入一份 12 周的 C++ 计划，用来熟悉界面。</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-ghost btn-sm" data-action="load-demo">载入</button>
            </span>
          </div>
          <div class="setting-row">
            <span class="setting-copy">
              <span class="setting-name danger-text">${icon('trash', 13)} 清空数据</span>
              <span class="setting-desc">删除项目、每周任务、每日任务、积分和奖池记录，保留 AI 配置与主题。</span>
            </span>
            <span class="setting-control">
              <button class="btn btn-danger btn-sm" data-action="clear-data">清空</button>
            </span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">关于</div>
        <div class="settings-card">
          <div class="about">
            <b>周流 WeekFlow ${escapeHtml(ctx.version)}</b><br />
            一个透明的每周待办小部件。数据只保存在本机，没有账号、没有云同步。<br />
            AI 只在你主动生成计划时调用；本机模型不会联网。<br />
            快捷键 ${escapeHtml(ctx.hotkey || '未注册')} · 托盘菜单可恢复鼠标穿透。
          </div>
        </div>
      </div>
      <div class="hint" style="text-align:center;margin-top:16px">把这一周过好，比把一年排满更重要。</div>
    </div>
  `;
}
