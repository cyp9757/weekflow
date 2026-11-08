import {
  computeBalance,
  ledgerSummary,
  poolOdds,
} from '../../shared/domain.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, pct } from '../lib/format.js';

function formatHistoryTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderReward(ctx, reward) {
  const balance = ctx.balance;
  const enough = balance >= reward.cost;
  return `
    <div class="reward-row-wrap">
      <div class="reward-item">
        <div class="reward-icon">${escapeHtml(reward.icon)}</div>
        <div class="reward-copy">
          <div class="reward-title">${escapeHtml(reward.title)}</div>
          ${reward.note ? `<div class="reward-note">${escapeHtml(reward.note)}</div>` : ''}
        </div>
        <div class="reward-actions">
          <button class="icon-btn small" data-action="edit-reward" data-id="${reward.id}" title="编辑奖励" aria-label="编辑奖励：${escapeHtml(reward.title)}">${icon('edit', 12)}</button>
          <button class="icon-btn small row-delete" data-action="delete-reward" data-id="${reward.id}" title="删除奖励" aria-label="删除奖励：${escapeHtml(reward.title)}">${icon('trash', 12)}</button>
        </div>
        <div class="reward-cost">
          <strong>${reward.cost} 分</strong>
          <button class="reward-redeem" data-action="redeem-reward" data-id="${reward.id}" ${enough ? '' : 'disabled'}>
            ${enough ? '兑换' : `差 ${reward.cost - balance}`}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderPool(ctx, pool) {
  const odds = poolOdds(pool);
  const jackpot = Math.max(...pool.prizes.map((prize) => prize.points));
  const enough = ctx.balance >= pool.cost;
  const expanded = ctx.ui.expandedPools.has(pool.id);
  const ordered = [...odds.prizes].sort((a, b) => b.probability - a.probability);
  return `
    <article class="pool-card">
      <div class="pool-top">
        <div class="pool-icon">${escapeHtml(pool.icon)}</div>
        <div style="min-width:0;flex:1">
          <div class="pool-name">${escapeHtml(pool.title)}</div>
          <div class="pool-sub">${escapeHtml(pool.subtitle || '小概率的大收益，大概率一场空。')}</div>
        </div>
        <div class="pool-jackpot">
          <span>TOP PRIZE</span>
          <strong>${jackpot.toLocaleString('zh-CN')}</strong>
        </div>
      </div>
      <div class="pool-meta">
        <span>${pool.prizes.length} 种结果</span>
        <span class="dot"></span>
        <span>长期回报 ${pct(odds.rtp, 1)}</span>
        <span class="dot"></span>
        <button class="text-button" data-action="toggle-pool-odds" data-id="${pool.id}">${expanded ? '收起概率' : '查看概率'}</button>
      </div>
      ${
        expanded
          ? `<div class="pool-odds">
              ${ordered
                .map(
                  (prize) => `
                <div class="odds-row">
                  <span class="label">${escapeHtml(prize.label)}</span>
                  <span class="bar"><span style="width:${Math.max(1, prize.probability * 100)}%"></span></span>
                  <span class="prob">${(prize.probability * 100).toFixed(1)}%</span>
                  <span class="prize">${prize.points ? `+${prize.points}` : '空'}</span>
                </div>`,
                )
                .join('')}
            </div>`
          : ''
      }
      <div class="pool-draw-row">
        <span class="pool-cost">${pool.cost} 分 / 次</span>
        <span class="spacer"></span>
        <button class="btn btn-secondary btn-sm" data-action="edit-pool" data-id="${pool.id}" aria-label="编辑奖池" title="编辑奖池">${icon('edit', 12)}</button>
        <button class="btn btn-secondary btn-sm" data-action="delete-pool" data-id="${pool.id}" aria-label="删除奖池" title="删除奖池">${icon('trash', 12)}</button>
        <button class="btn btn-primary btn-sm" data-action="draw-pool" data-id="${pool.id}" ${enough ? '' : 'disabled'}>
          ${icon('dice', 13)} ${enough ? '抽一次' : `差 ${pool.cost - ctx.balance} 分`}
        </button>
      </div>
    </article>
  `;
}

function renderRedemptions(ctx) {
  const items = [...(ctx.state.redemptions || [])].sort((a, b) =>
    String(b.at).localeCompare(String(a.at)),
  );
  return `
    <div class="section redemption-section">
      <div class="section-head">
        <span class="section-title">我的兑换</span>
        <span class="section-count">${items.length}</span>
        <span class="section-rule"></span>
      </div>
      ${
        items.length
          ? `<div class="redemption-list">${items
              .map((item) => {
                const used = Boolean(item.usedAt);
                return `
                  <div class="redemption-row ${used ? 'used' : ''}">
                    <span class="redemption-icon">${used ? icon('check', 13) : '🎁'}</span>
                    <div class="redemption-copy">
                      <div class="redemption-title">${escapeHtml(item.title)}</div>
                      <div class="redemption-meta">${formatHistoryTime(item.at)} · ${item.cost} 分 · ${used ? `已核销 ${formatHistoryTime(item.usedAt)}` : '待使用'}</div>
                    </div>
                    <button class="redemption-use" data-action="use-redemption" data-id="${item.id}">
                      ${used ? '撤销核销' : '核销'}
                    </button>
                  </div>
                `;
              })
              .join('')}</div>`
          : '<div class="hint" style="padding:12px 2px">还没有兑换记录。兑换奖励后会出现在这里，使用时点“核销”。</div>'
      }
    </div>
  `;
}

function renderHistory(ctx) {
  const tab = ctx.ui.rewardsTab || 'rewards';
  const source = (ctx.state.ledger || []).filter(
    (entry) => tab === 'all' || entry.kind !== 'task',
  );
  const entries = [...source]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 40);
  if (!entries.length) {
    return `<div class="hint" style="text-align:center;padding:24px 0">${tab === 'all' ? '还没有积分记录。完成第一件任务就会开始。' : '还没有兑换或抽奖记录。'}</div>`;
  }
  return entries
    .map((entry) => {
      const iconName =
        entry.kind === 'task'
          ? 'check'
          : entry.kind === 'habit'
            ? 'sun'
            : entry.kind === 'bonus'
              ? 'sparkles'
              : entry.kind === 'redeem'
              ? 'gift'
              : entry.kind === 'lottery'
                ? 'dice'
                : 'sliders';
      return `
        <div class="history-row">
          ${icon(iconName, 12)}
          <span class="history-title">${escapeHtml(entry.note || '积分变动')}</span>
          <span class="history-time">${formatHistoryTime(entry.at)}</span>
          <span class="history-amount ${entry.amount < 0 ? 'negative' : entry.amount > 0 ? 'positive' : ''}">
            ${entry.amount > 0 ? '+' : ''}${entry.amount}
          </span>
        </div>
      `;
    })
    .join('');
}

export function renderRewards(ctx) {
  const summary = ledgerSummary(ctx.state);
  const rewards = [...ctx.state.rewards]
    .filter((reward) => !reward.archived)
    .sort((a, b) => a.cost - b.cost);
  const tab = ctx.ui.rewardsTab || 'rewards';
  const balance = summary.balance;

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Rewards</div>
          <h1 class="page-title">奖励</h1>
          <div class="page-sub">完成一周，换一点真实的快乐。</div>
        </div>
        <button class="icon-btn" data-action="new-reward" aria-label="添加奖励">${icon('plus', 16)}</button>
      </div>

      <section class="wallet">
        <div class="wallet-kicker">AVAILABLE POINTS</div>
        <div class="wallet-balance"><strong style="${balance < 0 ? 'color:var(--danger)' : ''}">${balance.toLocaleString('zh-CN')}</strong><span>积分</span></div>
        <div class="wallet-stats">
          <span>累计获得 <b>${summary.earned}</b></span>
          <span>已花掉 <b>${summary.spent}</b></span>
          <span>每日 <b>${summary.habitPoints || 0}</b> 分</span>
          <span>待办 <b>${summary.bonusPoints || 0}</b> 分</span>
          <span>抽奖 <b>${summary.drawCount}</b> 次</span>
        </div>
        <div class="wallet-spark">${icon('sparkles', 22)}</div>
      </section>

      <div class="section">
        <div class="section-head">
          <span class="section-title">兑换清单</span>
          <span class="section-count">${rewards.length}</span>
          <span class="section-rule"></span>
          <button class="section-action" data-action="new-reward">${icon('plus', 12)} 自定义</button>
        </div>
        ${
          rewards.length
            ? rewards.map((reward) => renderReward(ctx, reward)).join('')
            : `<div class="empty" style="padding:18px">
                <div class="empty-title">还没有奖励</div>
                <div class="empty-copy">写下一个真的会让你开心的东西。别写“继续努力”。</div>
                <div class="empty-actions"><button class="btn btn-primary btn-sm" data-action="new-reward">${icon('plus', 13)} 添加第一个奖励</button></div>
              </div>`
        }
      </div>

      ${renderRedemptions(ctx)}

      <div class="section">
        <div class="section-head">
          <span class="section-title">奖池</span>
          <span class="section-count">${ctx.state.pools.length}</span>
          <span class="section-rule"></span>
          <button class="section-action" data-action="new-pool">${icon('plus', 12)} 自建奖池</button>
        </div>
        ${ctx.state.pools.map((pool) => renderPool(ctx, pool)).join('')}
        ${
          !ctx.state.pools.length
            ? `<div class="hint" style="padding:8px 2px">奖池能放大积分，也能吞掉积分。想清楚再放。</div>`
            : ''
        }
      </div>

      <div class="section">
        <div class="section-head">
          <span class="section-title">积分流水</span>
          <span class="section-rule"></span>
          <div class="chip-row">
            <button class="chip ${tab === 'rewards' ? 'active' : ''}" data-action="rewards-tab" data-tab="rewards">奖励流水</button>
            <button class="chip ${tab === 'all' ? 'active' : ''}" data-action="rewards-tab" data-tab="all">全部</button>
          </div>
        </div>
        ${renderHistory(ctx)}
      </div>
      <div class="hint" style="margin-top:14px">积分只在本地记账。奖池概率独立，长期回报率只用于展示期望，不保证任何一次结果。</div>
    </div>
  `;
}
