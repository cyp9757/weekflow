import {
  computeBalance,
  ledgerSummary,
  poolOdds,
  poolStock,
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
  const stock = poolStock(pool);
  const jackpot = Math.max(...pool.prizes.map((prize) => prize.points));
  const enough = ctx.balance >= pool.cost;
  const available = stock.remaining > 0;
  const expanded = ctx.ui.expandedPools.has(pool.id);
  const ordered = [...odds.prizes].sort((a, b) => b.probability - a.probability);
  const remainingFor = (prize) => Math.max(0, Number(pool.remainingCounts?.[prize.id]) || 0);
  const stockPct = stock.total ? Math.round((stock.remaining / stock.total) * 100) : 0;
  return `
    <article class="pool-card" data-pool-id="${pool.id}">
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
        <span>共 ${stock.total} 个奖品</span>
        <span class="dot"></span>
        <span>长期回报 ${pct(odds.rtp, 1)}</span>
        <span class="dot"></span>
        <button class="text-button" data-action="toggle-pool-odds" data-id="${pool.id}">${expanded ? '收起概率' : '查看概率'}</button>
      </div>
      <div class="pool-stock">
        <div class="pool-stock-label"><span>剩余奖品</span><strong>${stock.remaining} / ${stock.total}</strong></div>
        <div class="pool-stock-track"><span style="width:${stockPct}%"></span></div>
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
                  <span class="prize">${prize.points ? `+${prize.points}` : '空'} · 剩 ${remainingFor(prize)}</span>
                </div>`,
                )
                .join('')}
            </div>`
          : ''
      }
      <div class="pool-draw-row">
        <span class="pool-cost">${pool.cost} 分 / 次</span>
        <span class="spacer"></span>
        <button class="btn btn-secondary btn-sm" data-action="reset-pool" data-id="${pool.id}" aria-label="重置奖池" title="重置奖池">${icon('undo', 12)} 重置</button>
        <button class="btn btn-secondary btn-sm" data-action="edit-pool" data-id="${pool.id}" aria-label="编辑奖池" title="编辑奖池">${icon('edit', 12)}</button>
        <button class="btn btn-secondary btn-sm" data-action="delete-pool" data-id="${pool.id}" aria-label="删除奖池" title="删除奖池">${icon('trash', 12)}</button>
        <button class="btn btn-primary btn-sm" data-action="draw-pool" data-id="${pool.id}" ${enough && available ? '' : 'disabled'}>
          ${icon('dice', 13)} ${!available ? '已抽完' : enough ? '抽一次' : `差 ${pool.cost - ctx.balance} 分`}
        </button>
      </div>
    </article>
  `;
}

function renderHistory(ctx) {
  const tab = ctx.ui.ledgerTab || 'points';
  const source = (ctx.state.ledger || [])
    .filter((entry) => !entry.hiddenAt)
    .filter((entry) => (tab === 'lottery' ? entry.kind === 'lottery' : entry.kind !== 'lottery'))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const capped = source.slice(0, 200);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(capped.length / pageSize));
  const page = Math.min(Math.max(Number(ctx.ui.ledgerPage) || 0, 0), pages - 1);
  const entries = capped.slice(page * pageSize, (page + 1) * pageSize);
  if (!entries.length) {
    return `<div class="hint" style="text-align:center;padding:24px 0">${
      tab === 'lottery' ? '还没有奖池抽奖记录。' : '还没有积分或兑换记录。完成第一件任务就会开始。'
    }</div>`;
  }
  const rows = entries
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
  const pager = `
    <div class="ledger-pager">
      <button class="pager-btn" data-action="ledger-page" data-page="-1" ${page <= 0 ? 'disabled' : ''}>上一页</button>
      <span>第 ${page + 1} / ${pages} 页 · 显示最近 ${capped.length} 条${source.length > 200 ? '（最多 200 条）' : ''}</span>
      <button class="pager-btn" data-action="ledger-page" data-page="1" ${page >= pages - 1 ? 'disabled' : ''}>下一页</button>
    </div>
  `;
  return rows + pager;
}

export function renderRewards(ctx) {
  const summary = ledgerSummary(ctx.state);
  const rewards = [...ctx.state.rewards]
    .filter((reward) => !reward.archived)
    .sort((a, b) => a.cost - b.cost);
  const ledgerTab = ctx.ui.ledgerTab || 'points';
  const balance = summary.balance;

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Rewards</div>
          <h1 class="page-title">奖励</h1>
          <div class="page-sub">完成一周，换一点真实的快乐。</div>
        </div>
        <div class="page-head-actions">
          <button class="icon-btn" data-action="go-redemptions" aria-label="查看兑换记录" title="兑换记录">${icon('receipt', 16)}</button>
          <button class="icon-btn" data-action="new-reward" aria-label="添加奖励">${icon('plus', 16)}</button>
        </div>
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
          <span class="section-title">${ledgerTab === 'lottery' ? '奖池流水' : '积分与兑换'}</span>
          <span class="section-rule"></span>
          <div class="chip-row">
            <button class="chip ${ledgerTab === 'points' ? 'active' : ''}" data-action="ledger-tab" data-tab="points">积分 / 兑换</button>
            <button class="chip ${ledgerTab === 'lottery' ? 'active' : ''}" data-action="ledger-tab" data-tab="lottery">奖池</button>
          </div>
        </div>
        ${renderHistory(ctx)}
      </div>
      <div class="hint" style="margin-top:14px">奖池是有限库存：抽一个少一个，抽完需要重置；重置只清空该奖池的流水，不影响积分余额和其他流水。流水最多显示最近 200 条。</div>
    </div>
  `;
}
