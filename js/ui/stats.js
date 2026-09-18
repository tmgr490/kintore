// 分析（筋トレ後）：推移グラフ、ボリューム、バランス、停滞とデロード、自己ベスト。

import { esc, num, empty, segmented, openSheet, relDate, fmtDuration, toast } from './dom.js';
import { lineChart, hBars, vBars, heatmap } from './charts.js';
import { weeklyStatus, setsByMuscle, balance, balanceAdvice } from '../engine/volume.js';
import { deloadSuggestion, allTimePRs } from '../engine/analysis.js';
import { e1rmSeries, weekStart, addDays, daysBetween, weekStreak, workSets } from '../engine/history.js';
import { trend } from '../engine/progression.js';
import { fmtWeight } from '../engine/plates.js';
import { effectiveLoad } from '../engine/onerm.js';
import { VOLUME_CONCEPTS } from '../data/guide.js';
import { openPastSession } from './session.js';
import { openExerciseDetail } from './exercisePicker.js';

export const title = '分析';
export const subtitle = ctx => `${ctx.state.sessions.length}回のトレーニング`;

const RANGES = [
  { value: '28', label: '4週' },
  { value: '84', label: '12週' },
  { value: 'all', label: '全期間' }
];
let range = '84';
let chartExId = null;

export function render(ctx) {
  const { state, today } = ctx;
  if (!state.sessions.length) {
    return empty('📊', 'まだ記録がありません',
      'トレーニングを1回記録すると、ここに推移・ボリューム・自己ベストが表示されます。',
      '<button class="btn primary" data-act="goHome">ホームへ</button>');
  }

  const from = range === 'all'
    ? state.sessions.map(s => s.date).sort()[0]
    : addDays(today, -Number(range) + 1);

  return `
    ${segmented('range', RANGES, range)}
    ${renderOverview(ctx, from)}
    ${renderHeatmap(ctx)}
    ${renderVolumeTrend(ctx, from)}
    ${renderMuscleVolume(ctx, from)}
    ${renderBalance(ctx, from)}
    ${renderDeload(ctx)}
    ${renderE1rm(ctx)}
    ${renderPRs(ctx)}
    ${renderBody(ctx)}
    ${renderRecent(ctx)}
  `;
}

function inRange(s, from, to) { return s.date >= from && s.date <= to; }

function renderOverview(ctx, from) {
  const { state, today } = ctx;
  const list = state.sessions.filter(s => inRange(s, from, today));
  const bodyWeight = state.profile.weight;
  let sets = 0, volume = 0, minutes = 0;
  for (const s of list) {
    for (const e of s.entries || []) {
      const ex = ctx.exerciseById(e.exId);
      const ws = workSets(e);
      sets += ws.length;
      if (ex && !ex.time) for (const st of ws) volume += effectiveLoad(st, ex, bodyWeight) * (st.reps || 0);
    }
    if (s.startedAt && s.endedAt) minutes += Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000);
  }
  const days = range === 'all' ? Math.max(1, daysBetween(from, today) + 1) : Number(range);
  const perWeek = Math.round(list.length / days * 7 * 10) / 10;

  return `<div class="card">
    <div class="stat-grid">
      <div class="stat"><div class="v">${list.length}</div><div class="k">回</div><div class="d">週${perWeek}回</div></div>
      <div class="stat"><div class="v">${num(sets)}</div><div class="k">総セット</div></div>
      <div class="stat"><div class="v">${num(volume / 1000, 1)}</div><div class="k">総ボリューム(t)</div></div>
      <div class="stat"><div class="v">${weekStreak(ctx.state, today)}</div><div class="k">連続週</div></div>
      <div class="stat"><div class="v">${fmtDuration(minutes)}</div><div class="k">合計時間</div></div>
    </div>
  </div>`;
}

function renderHeatmap(ctx) {
  const count = {};
  for (const s of ctx.state.sessions) count[s.date] = (count[s.date] || 0) + 1;
  return `<div class="card">
    <div class="card-head"><h2>実施カレンダー</h2><span class="tiny faint">直近18週</span></div>
    ${heatmap(count, ctx.today)}
  </div>`;
}

function renderVolumeTrend(ctx, from) {
  const weeks = {};
  const bodyWeight = ctx.state.profile.weight;
  for (const s of ctx.state.sessions) {
    if (!inRange(s, from, ctx.today)) continue;
    const w = weekStart(s.date);
    let v = 0;
    for (const e of s.entries || []) {
      const ex = ctx.exerciseById(e.exId);
      if (!ex || ex.time) continue;
      for (const st of workSets(e)) v += effectiveLoad(st, ex, bodyWeight) * (st.reps || 0);
    }
    weeks[w] = (weeks[w] || 0) + v;
  }
  const items = Object.entries(weeks).sort().map(([w, v]) => ({
    label: `${new Date(w).getMonth() + 1}/${new Date(w).getDate()}`,
    value: Math.round(v / 1000 * 10) / 10
  }));
  if (items.length < 2) return '';
  const last = items[items.length - 1]?.value ?? 0;
  const prev = items[items.length - 2]?.value ?? 0;
  const delta = prev > 0 ? Math.round((last - prev) / prev * 100) : null;

  return `<div class="card">
    <div class="card-head"><h2>週間ボリュームの推移</h2>
      ${delta != null ? `<span class="chip ${delta >= 0 ? 'mint' : 'warn'}">先週比 ${delta >= 0 ? '+' : ''}${delta}%</span>` : ''}</div>
    ${vBars(items, { unit: 't' })}
    <p class="tiny faint" style="margin-top:6px">重量×回数の合計（トン）。右肩上がりなら漸進性過負荷ができています。</p>
  </div>`;
}

function renderMuscleVolume(ctx, from) {
  const weekly = weeklyStatus(ctx.state, ctx.exerciseById, ctx.today);
  const period = setsByMuscle(ctx.state, ctx.exerciseById, from, ctx.today);
  const items = weekly
    .filter(w => w.sets > 0 || (period[w.muscle.id] || 0) > 0)
    .sort((a, b) => b.sets - a.sets)
    .map(w => ({
      label: w.muscle.name,
      value: w.sets,
      max: w.muscle.mrv,
      tone: w.status === 'over' ? 'danger' : w.status === 'high' ? 'mint' : w.status === 'ok' ? '' : 'warn'
    }));

  return `<div class="card">
    <div class="card-head"><h2>今週の部位別セット数</h2>
      <button class="more" data-act="volumeHelp">MEV/MAVとは？</button></div>
    ${items.length ? hBars(items, { unit: '' }) : '<p class="small faint">今週はまだ記録がありません。</p>'}
    <div class="row wrap tiny faint" style="gap:10px;margin-top:8px">
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--warn)"></i> 不足</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--accent)"></i> 適正</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--mint)"></i> 高ボリューム</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--danger)"></i> 過多</span>
    </div>
  </div>`;
}

function renderBalance(ctx, from) {
  const b = balance(ctx.state, ctx.exerciseById, from, ctx.today);
  const tips = balanceAdvice(b);
  if (b.push + b.pull + b.upper + b.lower === 0) return '';
  const pair = (a, c, la, lc) => {
    const t = a + c || 1;
    return `<div style="margin-bottom:11px">
      <div class="row between tiny" style="margin-bottom:4px">
        <span style="font-weight:650">${la} ${a}</span><span style="font-weight:650">${lc} ${c}</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width:${a / t * 100}%"></div></div>
    </div>`;
  };
  return `<div class="card">
    <div class="card-head"><h2>筋肉バランス</h2></div>
    ${pair(b.push, b.pull, '押す', '引く')}
    ${pair(b.upper, b.lower, '上半身', '下半身')}
    ${pair(b.front, b.back, '体の前面', '体の背面')}
    ${tips.map(t => `<div class="note ${t.level === 'warn' ? 'warn' : t.level === 'good' ? 'good' : ''}">
      <span class="ic">${t.level === 'warn' ? '⚠️' : t.level === 'good' ? '✅' : '💡'}</span><span>${esc(t.text)}</span></div>`).join('')}
  </div>`;
}

function renderDeload(ctx) {
  const d = deloadSuggestion(ctx.state, ctx.exerciseById, ctx.today);
  if (!d.reasons.length) return '';
  const cls = d.recommended ? 'warn' : d.watch ? '' : 'good';
  return `<div class="card ${cls}">
    <div class="card-head"><h2>${d.recommended ? '🛑 デロードをおすすめします' : d.watch ? '⚠️ 疲労がたまってきています' : '✅ 疲労管理は良好'}</h2></div>
    ${d.reasons.map(r => `<div class="note"><span class="ic">・</span><span>${esc(r)}</span></div>`).join('')}
    ${d.recommended || d.watch ? `<button class="btn block" data-act="deloadHow" style="margin-top:8px">デロード週のやり方を見る</button>` : ''}
    ${d.stalled.length ? `<div class="section-title">停滞中の種目</div>
      <div class="list" style="margin:0 -14px">
        ${d.stalled.slice(0, 5).map(s => `<button class="list-item" data-ex="${esc(s.ex.id)}">
          <span class="grow"><span class="t">${esc(s.ex.name)}</span>
          <span class="s">直近の伸び ${s.pctPerWeek >= 0 ? '+' : ''}${s.pctPerWeek}%／週 ・ 最終 ${relDate(s.lastDate, ctx.today)}</span></span>
          <span class="trail">›</span></button>`).join('')}
      </div>` : ''}
  </div>`;
}

function renderE1rm(ctx) {
  const ids = new Set();
  for (const s of ctx.state.sessions) for (const e of s.entries || []) ids.add(e.exId);
  const options = [...ids]
    .map(id => ({ id, ex: ctx.exerciseById(id), n: e1rmSeries(ctx.state, id).length }))
    .filter(o => o.ex && o.n >= 1)
    .sort((a, b) => b.n - a.n);
  if (!options.length) return '';

  const sel = chartExId && options.some(o => o.id === chartExId) ? chartExId : options[0].id;
  const series = e1rmSeries(ctx.state, sel);
  const t = trend(ctx.state, sel);
  const ex = ctx.exerciseById(sel);
  const units = ctx.state.settings.units;
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const growth = first > 0 ? Math.round((last - first) / first * 100) : 0;

  return `<div class="card">
    <div class="card-head"><h2>推定1RMの推移</h2></div>
    <select class="input" id="chartEx" style="margin-bottom:10px">
      ${options.map(o => `<option value="${esc(o.id)}" ${o.id === sel ? 'selected' : ''}>${esc(o.ex.name)}（${o.n}回）</option>`).join('')}
    </select>
    ${lineChart(series, { unit: units })}
    <div class="row between small" style="margin-top:8px">
      <span class="faint">現在 <strong style="color:var(--text)">${fmtWeight(last, units)}</strong></span>
      <span class="${growth >= 0 ? 'mint' : ''}" style="color:${growth >= 0 ? 'var(--mint)' : 'var(--danger)'}">
        期間中 ${growth >= 0 ? '+' : ''}${growth}%${t.pctPerWeek != null ? ` ・ 週${t.pctPerWeek >= 0 ? '+' : ''}${t.pctPerWeek}%` : ''}</span>
    </div>
    ${t.stalled ? `<div class="note warn" style="margin-top:8px"><span class="ic">⚠️</span><span>${esc(ex.name)}は伸びが鈍化しています。レップ域を変える・種目を替える・デロードのいずれかを試しましょう。</span></div>` : ''}
    <p class="tiny faint" style="margin-top:6px">RIR（余力）を記録していると、限界まで追い込まなかったセットも正しく換算されます。</p>
  </div>`;
}

function renderPRs(ctx) {
  const prs = allTimePRs(ctx.state, ctx.exerciseById, 12);
  if (!prs.length) return '';
  const units = ctx.state.settings.units;
  return `<div class="card flush">
    <div style="padding:14px 14px 4px"><h2 style="font-size:15px">自己ベスト（推定1RM）</h2></div>
    <div class="list">
      ${prs.map(p => `<button class="list-item" data-ex="${esc(p.ex.id)}">
        <span class="lead">🏆</span>
        <span class="grow"><span class="t">${esc(p.ex.name)}</span>
        <span class="s">${fmtWeight(p.set.w, units)} × ${p.set.reps}回 ・ ${relDate(p.date, ctx.today)}</span></span>
        <span class="trail"><strong style="color:var(--text)">${fmtWeight(p.e1rm, units)}</strong>›</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderBody(ctx) {
  const log = ctx.state.bodyLog.filter(b => b.weight != null);
  if (log.length < 1) return '';
  const points = log.map(b => ({ date: b.date, value: b.weight }));
  const fat = ctx.state.bodyLog.filter(b => b.bodyFat != null).map(b => ({ date: b.date, value: b.bodyFat }));
  const first = points[0].value, last = points[points.length - 1].value;
  return `<div class="card">
    <div class="card-head"><h2>体重の推移</h2>
      <span class="chip ${last >= first ? 'mint' : 'warn'}">${last > first ? '+' : ''}${Math.round((last - first) * 10) / 10}kg</span></div>
    ${lineChart(points, { unit: 'kg', id: 'bw' })}
    ${fat.length >= 2 ? `<div class="section-title">体脂肪率</div>${lineChart(fat, { unit: '%', id: 'bf' })}` : ''}
    <button class="btn sm block ghost" data-act="logBody" style="margin-top:8px">今日の体重を記録</button>
  </div>`;
}

function renderRecent(ctx) {
  const recent = [...ctx.state.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  return `<div class="card flush">
    <div style="padding:14px 14px 4px"><h2 style="font-size:15px">最近のトレーニング</h2></div>
    <div class="list">
      ${recent.map(s => `<button class="list-item" data-session="${s.id}">
        <span class="lead">🏋️</span>
        <span class="grow"><span class="t">${esc(s.name)}</span>
        <span class="s">${relDate(s.date, ctx.today)} ・ ${(s.entries || []).length}種目${s.sessionRpe ? ` ・ RPE${s.sessionRpe}` : ''}</span></span>
        <span class="trail">›</span></button>`).join('')}
    </div>
  </div>`;
}

// ---- イベント -----------------------------------------------------------

export function bind(root, ctx) {
  root.addEventListener('change', e => {
    if (e.target.id === 'chartEx') { chartExId = e.target.value; ctx.refresh(); }
  });

  root.addEventListener('click', async e => {
    const seg = e.target.closest('[data-range]');
    if (seg) { range = seg.dataset.range; ctx.refresh(); return; }

    const sess = e.target.closest('[data-session]');
    if (sess) { openPastSession(ctx, sess.dataset.session); return; }

    const ex = e.target.closest('[data-ex]');
    if (ex) { openExerciseDetail(ctx, ex.dataset.ex); return; }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'volumeHelp') openVolumeHelp();
    else if (act === 'deloadHow') openDeloadHow(ctx);
    else if (act === 'goHome') ctx.go('home');
    else if (act === 'logBody') {
      const home = await import('./home.js');
      home.openBodyLog(ctx);
    }
  });
}

function openVolumeHelp() {
  openSheet({
    title: 'ボリュームの考え方', size: 'full',
    body: `
      <p class="small muted">1セット＝限界近くまで追い込んだ本番セット。補助的に使われる部位は0.5セットとして数えています。</p>
      ${VOLUME_CONCEPTS.map(c => `<div class="card">
        <div class="card-head"><h3>${esc(c.key)} — ${esc(c.name)}</h3></div>
        <p class="small muted">${esc(c.desc)}</p></div>`).join('')}
      <div class="note"><span class="ic">💡</span><span>迷ったら「各部位 週10〜20セット、週2回に分ける」から始めてください。ほとんどの人にとってこれが最も伸びます。</span></div>`
  });
}

function openDeloadHow(ctx) {
  const d = deloadSuggestion(ctx.state, ctx.exerciseById, ctx.today);
  openSheet({
    title: 'デロード週のやり方', size: 'full',
    body: `
      <p class="small muted">デロードは「サボり」ではなく、溜まった疲労を抜いて次のサイクルで伸びるための工程です。1週間で十分です。</p>
      <div class="section-title">やること</div>
      ${d.plan.map((p, i) => `<div class="note"><span class="ic">${i + 1}</span><span>${esc(p)}</span></div>`).join('')}
      <div class="section-title">やらないこと</div>
      <div class="note warn"><span class="ic">✕</span><span>完全に休む（かえって戻りが悪くなります。軽く動かし続けるほうが回復は早い）</span></div>
      <div class="note warn"><span class="ic">✕</span><span>食事を極端に減らす（回復に必要なエネルギーが足りなくなります）</span></div>
      <button class="btn primary block" data-act="mark" style="margin-top:14px">今週をデロード週として記録する</button>`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        if (!e.target.closest('[data-act="mark"]')) return;
        const from = weekStart(ctx.today);
        ctx.update(s => { s.deloads.push({ from, to: addDays(from, 6), reason: 'manual' }); });
        close();
        toast('デロード週として記録しました', 'good');
        ctx.refresh();
      });
    }
  });
}

