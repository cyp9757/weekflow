import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/format.js';

function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function monthLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '更早';
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function renderEmpty() {
  return `
    <div class="empty redemption-empty">
      <div class="empty-orbit">${icon('receipt', 22)}</div>
      <div class="empty-title">还没有兑换记录</div>
      <div class="empty-copy">在奖励页兑换之后，记录会到这里；用掉时点“核销”。</div>
      <div class="empty-actions">
        <button class="btn btn-primary btn-sm" data-action="go-rewards">${icon('gift', 13)} 去奖励页</button>
      </div>
    </div>
  `;
}

export function renderRedemptionsView(ctx) {
  const all = [...(ctx.state.redemptions || [])].sort((a, b) =>
    String(b.at).localeCompare(String(a.at)),
  );
  const tab = ctx.ui.redemptionsTab || 'all';
  const pending = all.filter((item) => !item.usedAt);
  const used = all.filter((item) => Boolean(item.usedAt));
  const filtered = tab === 'pending' ? pending : tab === 'used' ? used : all;
  const spent = all.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const groups = new Map();
  for (const item of filtered) {
    const label = monthLabel(item.at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  return `
    <div class="page redemption-page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Redemptions</div>
          <h1 class="page-title">兑换</h1>
          <div class="page-sub">兑换过什么、什么时候换的、有没有用掉，都在这里。</div>
        </div>
        <button class="icon-btn" data-action="go-rewards" aria-label="去奖励页">${icon('gift', 16)}</button>
      </div>

      <section class="redeem-hero">
        <div class="redeem-hero-head">
          <span class="redeem-kicker">MY REDEMPTIONS</span>
          <span class="redeem-total">累计 ${all.length} 次</span>
        </div>
        <div class="redeem-stats">
          <div class="redeem-stat">
            <strong>${pending.length}</strong>
            <span>待使用</span>
          </div>
          <div class="redeem-stat">
            <strong>${used.length}</strong>
            <span>已核销</span>
          </div>
          <div class="redeem-stat wide">
            <strong>${spent}</strong>
            <span>累计花费积分</span>
          </div>
        </div>
      </section>

      <div class="section">
        <div class="section-head">
          <span class="section-title">兑换记录</span>
          <span class="section-count">${filtered.length}</span>
          <span class="section-rule"></span>
          <div class="chip-row">
            <button class="chip ${tab === 'all' ? 'active' : ''}" data-action="redemptions-tab" data-tab="all">全部</button>
            <button class="chip ${tab === 'pending' ? 'active' : ''}" data-action="redemptions-tab" data-tab="pending">待使用</button>
            <button class="chip ${tab === 'used' ? 'active' : ''}" data-action="redemptions-tab" data-tab="used">已核销</button>
          </div>
        </div>
        ${
          filtered.length
            ? [...groups.entries()]
                .map(
                  ([label, items]) => `
                    <div class="redemption-month">${escapeHtml(label)}</div>
                    <div class="redemption-list">
                      ${items
                        .map((item) => {
                          const reward = (ctx.state.rewards || []).find((entry) => entry.id === item.rewardId);
                          const isUsed = Boolean(item.usedAt);
                          return `
                            <article class="redemption-row ${isUsed ? 'used' : ''}">
                              <span class="redemption-icon">${isUsed ? icon('check', 14) : escapeHtml(reward?.icon || '🎁')}</span>
                              <div class="redemption-copy">
                                <div class="redemption-title">${escapeHtml(item.title)}</div>
                                <div class="redemption-time"><span>兑换时间</span>${formatDateTime(item.at)}</div>
                                <div class="redemption-time ${isUsed ? '' : 'pending'}"><span>核销时间</span>${isUsed ? formatDateTime(item.usedAt) : '尚未核销'}</div>
                              </div>
                              <div class="redemption-side">
                                <span class="redemption-cost">-${item.cost} 分</span>
                                <span class="redemption-status ${isUsed ? 'done' : ''}">${isUsed ? '已核销' : '待使用'}</span>
                                <button class="redemption-use" data-action="use-redemption" data-id="${item.id}">
                                  ${isUsed ? '撤销核销' : '核销'}
                                </button>
                              </div>
                            </article>
                          `;
                        })
                        .join('')}
                    </div>
                  `,
                )
                .join('')
            : renderEmpty()
        }
      </div>

      <div class="hint" style="margin-top:14px">核销只表示“这件奖励已经用掉了”，不会退回积分。撤销核销只恢复状态。</div>
    </div>
  `;
}
