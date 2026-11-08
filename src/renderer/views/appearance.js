import { THEMES } from '../../shared/defaults.js';
import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/format.js';

export function renderThemeTiles(selected, { compact = false } = {}) {
  return THEMES.map(
    (theme) => `
      <button
        class="theme-tile ${theme.id === selected ? 'active' : ''} ${compact ? 'compact' : ''}"
        data-action="set-theme"
        data-theme="${theme.id}"
        title="${escapeHtml(theme.hint)}"
        aria-label="切换到${escapeHtml(theme.label)}主题"
        aria-pressed="${theme.id === selected}"
      >
        <span class="theme-swatch" style="background:${theme.swatch}">
          <i style="background:${theme.accent}"></i>
          <b style="background:${theme.accent}"></b>
        </span>
        <span class="theme-tile-name">${escapeHtml(theme.label)}</span>
      </button>
    `,
  ).join('');
}

export function renderAppearancePopover(ctx) {
  const settings = ctx.state.settings;
  const percent = Math.round(settings.panelOpacity * 100);
  return `
    <div class="quick-scrim" data-action="close-appearance"></div>
    <aside class="appearance-pop" id="appearance-pop" role="dialog" aria-label="快捷外观">
      <div class="appearance-head">
        <span>${icon('sun', 14)} 外观</span>
        <button class="icon-btn small" data-action="close-appearance" aria-label="关闭外观面板">${icon('x', 13)}</button>
      </div>

      <div class="appearance-block">
        <div class="appearance-row">
          <span>面板透明度</span>
          <strong id="quick-opacity-value">${percent}%</strong>
        </div>
        <input type="range" min="0.45" max="1" step="0.01" value="${settings.panelOpacity}" data-range="panelOpacity" aria-label="面板透明度" />
        <div class="opacity-presets">
          ${[55, 70, 85, 100]
            .map(
              (value) =>
                `<button class="chip ${percent === value ? 'active' : ''}" data-action="set-opacity" data-value="${value}">${value}%</button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="appearance-block">
        <div class="appearance-row">
          <span>主题</span>
          <span class="faint">${escapeHtml(THEMES.find((theme) => theme.id === settings.theme)?.hint || '')}</span>
        </div>
        <div class="theme-grid">${renderThemeTiles(settings.theme, { compact: true })}</div>
      </div>

      <label class="appearance-toggle">
        <span>自动淡出</span>
        <span class="setting-control">
          <input type="checkbox" data-setting="autoFade" ${settings.autoFade ? 'checked' : ''} />
          <span class="switch"></span>
        </span>
      </label>

      <button class="appearance-more" data-action="appearance-settings">
        更多外观与桌面设置 <span>→</span>
      </button>
    </aside>
  `;
}
