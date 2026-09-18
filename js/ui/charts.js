// 依存ライブラリなしのSVGチャート。ダーク／ライト両対応（色はCSS変数を使う）。

import { esc } from './dom.js';

const W = 320, H = 130, PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 20;

/** 折れ線グラフ。points: [{date:'YYYY-MM-DD', value:number}] */
export function lineChart(points, { unit = '', height = H, id = 'c' + Math.random().toString(36).slice(2, 7) } = {}) {
  if (!points || points.length === 0) {
    return '<div class="empty"><div class="empty-sub">データがまだありません</div></div>';
  }
  if (points.length === 1) {
    return `<div class="center" style="padding:18px 0">
      <div class="big">${round(points[0].value)}${esc(unit)}</div>
      <div class="tiny faint">${esc(points[0].date)} ・ 2回目以降からグラフになります</div>
    </div>`;
  }

  const vals = points.map(p => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || Math.max(1, max * 0.1);
  min = Math.max(0, min - span * 0.15);
  max = max + span * 0.15;

  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const tSpan = t1 - t0 || 1;

  const x = p => PAD_L + (new Date(p.date).getTime() - t0) / tSpan * (W - PAD_L - PAD_R);
  const y = v => PAD_T + (1 - (v - min) / (max - min)) * (height - PAD_T - PAD_B);

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points[points.length - 1]).toFixed(1)},${height - PAD_B} L${x(points[0]).toFixed(1)},${height - PAD_B} Z`;

  const ticks = [max, (max + min) / 2, min];

  return `<svg class="chart" viewBox="0 0 ${W} ${height}" preserveAspectRatio="none" role="img">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.26"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${ticks.map(v => `<line class="grid-line" x1="${PAD_L}" y1="${y(v).toFixed(1)}" x2="${W - PAD_R}" y2="${y(v).toFixed(1)}"/>
      <text class="lbl" x="2" y="${(y(v) + 3).toFixed(1)}">${round(v)}</text>`).join('')}
    <path d="${area}" fill="url(#${id})"/>
    <path class="line" d="${d}"/>
    ${points.map(p => `<circle class="dot" cx="${x(p).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.6"><title>${esc(p.date)}: ${round(p.value)}${esc(unit)}</title></circle>`).join('')}
    <text class="lbl" x="${PAD_L}" y="${height - 5}">${short(points[0].date)}</text>
    <text class="lbl" x="${W - PAD_R}" y="${height - 5}" text-anchor="end">${short(points[points.length - 1].date)}</text>
  </svg>`;
}

/** 横棒グラフ。items: [{label, value, max?, tone?}] */
export function hBars(items, { unit = '', showValue = true } = {}) {
  if (!items.length) return '<div class="empty"><div class="empty-sub">データがありません</div></div>';
  const max = Math.max(...items.map(i => i.max ?? i.value), 1);
  return items.map(i => {
    const pct = Math.min(100, i.value / max * 100);
    return `<div style="margin-bottom:8px">
      <div class="row between tiny" style="margin-bottom:3px">
        <span style="font-weight:650">${esc(i.label)}</span>
        ${showValue ? `<span class="faint">${round(i.value)}${esc(unit)}${i.max ? ` / ${round(i.max)}` : ''}</span>` : ''}
      </div>
      <div class="bar"><div class="bar-fill ${i.tone || ''}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

/** 週ごとの縦棒グラフ。items: [{label, value}] */
export function vBars(items, { unit = '', height = 110 } = {}) {
  if (!items.length) return '<div class="empty"><div class="empty-sub">データがありません</div></div>';
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = (W - PAD_L - PAD_R) / items.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" preserveAspectRatio="none" role="img">
    <line class="grid-line" x1="${PAD_L}" y1="${height - PAD_B}" x2="${W - PAD_R}" y2="${height - PAD_B}"/>
    <text class="lbl" x="2" y="${PAD_T + 6}">${round(max)}</text>
    ${items.map((it, i) => {
      const h = (it.value / max) * (height - PAD_T - PAD_B);
      const x = PAD_L + i * bw + bw * 0.16;
      return `<rect class="barv ${it.tone || ''}" x="${x.toFixed(1)}" y="${(height - PAD_B - h).toFixed(1)}"
        width="${(bw * 0.68).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="2">
        <title>${esc(it.label)}: ${round(it.value)}${esc(unit)}</title></rect>`;
    }).join('')}
    ${items.map((it, i) => (i === 0 || i === items.length - 1 || items.length <= 6)
      ? `<text class="lbl" x="${(PAD_L + i * bw + bw / 2).toFixed(1)}" y="${height - 5}" text-anchor="middle">${esc(it.label)}</text>` : '').join('')}
  </svg>`;
}

/** 実施日のヒートマップ。dates: Set<'YYYY-MM-DD'>、直近 weeks 週ぶん */
export function heatmap(countByDate, today, weeks = 18) {
  const cells = [];
  const end = new Date(today + 'T00:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  // 週の頭（日曜）に揃える
  start.setDate(start.getDate() - start.getDay());

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const n = countByDate[key] || 0;
    const lvl = n === 0 ? '' : n === 1 ? 'l2' : n === 2 ? 'l3' : 'l4';
    cells.push(`<i class="${lvl}" title="${key}: ${n}回"></i>`);
  }
  return `<div class="heat">${cells.join('')}</div>`;
}

const round = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('ja-JP');
const short = d => { const x = new Date(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
