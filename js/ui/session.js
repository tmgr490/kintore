// 記録（筋トレ中）：セット単位の高速入力、レストタイマー、プレート計算、PR検知。

import { esc, num, empty, toast, openSheet, confirmSheet, haptic, relDate, fmtDuration } from './dom.js';
import { uid, todayStr } from '../store.js';
import { fmtWeight, plateBreakdown, barWeight, increment } from '../engine/plates.js';
import { prContext, checkSetPRs, PR_LABEL, sessionSummary } from '../engine/analysis.js';
import { historyFor, workSets } from '../engine/history.js';
import { restSeconds } from '../engine/planner.js';
import { buildWarmup } from '../engine/warmup.js';
import { suggestNext } from '../engine/progression.js';
import { sessionFeedback } from '../engine/autoreg.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { GOAL_BY_ID, STRETCHES } from '../data/guide.js';
import { startTimer, stopTimer } from './timer.js';
import { openPicker, openSwap, openExerciseDetail } from './exercisePicker.js';

export const title = '記録';
export const subtitle = ctx => {
  const a = ctx.state.activeSession;
  if (!a) return '';
  const done = a.entries.reduce((s, e) => s + e.sets.filter(x => x.done && x.type !== 'warmup').length, 0);
  const total = a.entries.reduce((s, e) => s + e.sets.filter(x => x.type !== 'warmup').length, 0);
  return `${a.name} ・ ${done}/${total}セット`;
};

export const resumeAvailable = ctx => !!ctx.state.activeSession;

const SET_TYPES = {
  warmup: { label: 'ウォームアップ', short: 'W', color: 'warn' },
  work: { label: '本番', short: '', color: '' },
  drop: { label: 'ドロップセット', short: 'D', color: '' },
  amrap: { label: 'AMRAP（限界まで）', short: 'A', color: 'mint' },
  fail: { label: '失敗', short: 'F', color: 'danger' }
};

// ---- セッションの作成 ---------------------------------------------------

export function startSession(ctx, plan) {
  const now = new Date().toISOString();
  const showWarmup = ctx.state.settings.showWarmup !== false;

  const entries = (plan.items || []).map(it => {
    const sets = [];
    if (showWarmup) {
      for (const w of it.warmup) sets.push(mkSet(w.w, w.reps, null, 'warmup'));
    }
    for (let i = 0; i < it.sets; i++) {
      sets.push(mkSet(it.suggestion.weight, it.suggestion.reps, it.rir, 'work'));
    }
    return {
      exId: it.exId, note: '', supersetId: null,
      targetSets: it.sets, repLow: it.repLow, repHigh: it.repHigh, rir: it.rir,
      rest: it.rest, sets
    };
  });

  ctx.update(s => {
    s.activeSession = {
      id: uid(), date: todayStr(), routineId: plan.routine?.id || null,
      name: plan.name || plan.routine?.name || 'フリートレーニング',
      startedAt: now, endedAt: null,
      condition: plan.adj ? { readiness: plan.adj.readiness } : null,
      sessionRpe: null, note: '', entries
    };
  });
  ctx.go('session');
  toast('開始しました。セットを終えたら ✓ をタップ', 'good');
}

function mkSet(w, reps, rir, type = 'work') {
  return { w: Number(w) || 0, reps: Number(reps) || 0, rir: rir ?? null, type, done: false, ts: null };
}

// ---- 描画 ---------------------------------------------------------------

export function render(ctx) {
  const a = ctx.state.activeSession;
  if (!a) return renderIdle(ctx);

  const units = ctx.state.settings.units;
  const doneSets = a.entries.reduce((s, e) => s + e.sets.filter(x => x.done && x.type !== 'warmup').length, 0);
  const totalSets = a.entries.reduce((s, e) => s + e.sets.filter(x => x.type !== 'warmup').length, 0);
  const volume = a.entries.reduce((sum, e) => {
    const ex = ctx.exerciseById(e.exId);
    if (!ex || ex.time) return sum;
    return sum + e.sets.filter(x => x.done && x.type !== 'warmup')
      .reduce((v, x) => v + (x.w || 0) * (x.reps || 0), 0);
  }, 0);
  const elapsed = a.startedAt ? Math.round((Date.now() - new Date(a.startedAt)) / 60000) : 0;

  return `
    <div class="card accent">
      <div class="row between" style="margin-bottom:8px">
        <div><div class="tiny faint">実施中</div><div style="font-weight:800;font-size:17px">${esc(a.name)}</div></div>
        <button class="icon-btn" data-act="sessionMenu" aria-label="メニュー">⋯</button>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="v">${doneSets}<span class="faint" style="font-size:13px">/${totalSets}</span></div><div class="k">セット</div></div>
        <div class="stat"><div class="v">${num(Math.round(volume))}</div><div class="k">総ボリューム(kg)</div></div>
        <div class="stat"><div class="v">${elapsed}</div><div class="k">経過(分)</div></div>
      </div>
    </div>

    ${renderVolumeBars(ctx, a)}

    ${a.entries.map((e, i) => renderEntry(ctx, e, i, units)).join('')}

    <button class="btn block ghost" data-act="addEx" style="margin-top:4px">＋ 種目を追加</button>
    <button class="btn mint block lg" data-act="finish" style="margin-top:10px">トレーニングを終える</button>
    <button class="btn ghost block" data-act="discard" style="margin-top:8px">このセッションを破棄</button>
  `;
}

function renderIdle(ctx) {
  const recent = [...ctx.state.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return `
    ${empty('📝', '実施中のセッションはありません', 'ホームの「トレーニング開始」から始めるか、ここからメニューを選べます。',
      '<button class="btn primary" data-act="pick">メニューを選んで開始</button>')}
    ${recent.length ? `<div class="section-title">最近のトレーニング</div>
      <div class="card flush"><div class="list">
        ${recent.map(s => {
          const sets = (s.entries || []).reduce((n, e) => n + e.sets.filter(x => x.done && x.type !== 'warmup').length, 0);
          return `<button class="list-item" data-session="${s.id}">
            <span class="lead">🏋️</span>
            <span class="grow"><span class="t">${esc(s.name)}</span>
            <span class="s">${relDate(s.date, ctx.today)} ・ ${(s.entries || []).length}種目 ・ ${sets}セット</span></span>
            <span class="trail">›</span>
          </button>`;
        }).join('')}
      </div></div>` : ''}`;
}

function renderVolumeBars(ctx, a) {
  const totals = {};
  for (const e of a.entries) {
    const ex = ctx.exerciseById(e.exId);
    if (!ex) continue;
    const n = e.sets.filter(x => x.done && x.type !== 'warmup').length;
    if (!n) continue;
    totals[ex.muscle] = (totals[ex.muscle] || 0) + n;
  }
  const rows = Object.entries(totals).sort((x, y) => y[1] - x[1]);
  if (!rows.length) return '';
  return `<div class="card">
    <div class="card-head"><h2>今日の部位別セット数</h2></div>
    <div class="chips">${rows.map(([m, n]) => `<span class="chip mint">${esc(MUSCLE_BY_ID[m]?.name || m)} ${n}</span>`).join('')}</div>
  </div>`;
}

function renderEntry(ctx, entry, idx, units) {
  const ex = ctx.exerciseById(entry.exId);
  if (!ex) return '';
  const work = entry.sets.filter(s => s.type !== 'warmup');
  const allDone = work.length > 0 && work.every(s => s.done);
  const last = historyFor(ctx.state, entry.exId, 1)[0];
  const isTime = !!ex.time;
  const showWeight = !isTime;

  return `<div class="ex-card ${allDone ? 'done' : ''}" data-entry="${idx}">
    <button class="ex-head" data-act="exDetail" data-ex="${esc(ex.id)}">
      <span class="idx ${allDone ? 'done' : ''}">${allDone ? '✓' : idx + 1}</span>
      <span class="grow">
        <span class="ex-name">${esc(ex.name)}${entry.supersetId ? ' <span class="chip mint" style="font-size:10px;padding:1px 6px">SS</span>' : ''}</span>
        <span class="ex-sub">${esc(MUSCLE_BY_ID[ex.muscle]?.name || '')} ・ 目標 ${entry.repLow}〜${entry.repHigh}${isTime ? '秒' : '回'} RIR${entry.rir ?? '-'}</span>
      </span>
      <span class="trail faint">›</span>
    </button>
    <div class="ex-body">
      ${last ? `<div class="prev-hint"><strong class="faint">前回 ${relDate(last.session.date, ctx.today)}</strong>
        ${workSets(last.entry).map(s => `<span class="chip">${isTime ? s.reps + '秒' : fmtWeight(s.w, units) + '×' + s.reps}</span>`).join('')}
        <button class="btn sm ghost" data-act="copyPrev" data-entry="${idx}">前回をコピー</button>
      </div>` : ''}

      <div class="set-head">
        <span>#</span><span>${showWeight ? (units === 'lb' ? 'lb' : 'kg') : ''}</span><span>${isTime ? '秒' : '回数'}</span><span>RIR</span><span></span>
      </div>
      ${entry.sets.map((s, si) => renderSet(entry, s, si, idx, units, showWeight, isTime)).join('')}

      <div class="row" style="gap:7px;margin-top:9px;flex-wrap:wrap">
        <button class="btn sm" data-act="addSet" data-entry="${idx}">＋ セット</button>
        ${showWeight && barWeight(ex, ctx.gym) > 0 ? `<button class="btn sm" data-act="plates" data-entry="${idx}">🍩 プレート</button>` : ''}
        <button class="btn sm" data-act="swapEx" data-entry="${idx}">⇄ 差し替え</button>
        <button class="btn sm ghost" data-act="entryMenu" data-entry="${idx}">⋯</button>
      </div>
      ${entry.note ? `<div class="note" style="margin-top:9px"><span class="ic">📝</span><span>${esc(entry.note)}</span></div>` : ''}
    </div>
  </div>`;
}

function renderSet(entry, s, si, ei, units, showWeight, isTime) {
  const t = SET_TYPES[s.type] || SET_TYPES.work;
  const w = units === 'lb' ? Math.round(s.w * 2.20462 * 10) / 10 : s.w;
  return `<div class="set-row ${s.done ? 'filled' : ''}" data-set="${si}" data-entry="${ei}">
    <button class="sn ${s.type === 'warmup' ? 'warm' : ''}" data-act="setType" data-entry="${ei}" data-set="${si}">
      ${t.short || (entry.sets.slice(0, si + 1).filter(x => x.type !== 'warmup').length || si + 1)}
    </button>
    ${showWeight
      ? `<input type="number" inputmode="decimal" step="0.5" value="${w || ''}" data-field="w" placeholder="0">`
      : '<span></span>'}
    <input type="number" inputmode="numeric" step="1" value="${s.reps || ''}" data-field="reps" placeholder="${isTime ? '秒' : '0'}">
    <select data-field="rir">
      <option value="" ${s.rir == null ? 'selected' : ''}>—</option>
      ${[0, 1, 2, 3, 4, 5].map(v => `<option value="${v}" ${s.rir === v ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
    <button class="set-check ${s.done ? 'on' : ''}" data-act="toggleSet" data-entry="${ei}" data-set="${si}" aria-label="完了">✓</button>
  </div>`;
}

// ---- イベント -----------------------------------------------------------

export function bind(root, ctx) {
  root.addEventListener('change', e => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    const row = input.closest('[data-set]');
    const ei = Number(row.dataset.entry), si = Number(row.dataset.set);
    const field = input.dataset.field;
    ctx.update(s => {
      const set = s.activeSession?.entries?.[ei]?.sets?.[si];
      if (!set) return;
      if (field === 'rir') set.rir = input.value === '' ? null : Number(input.value);
      else if (field === 'w') {
        const v = Number(input.value) || 0;
        set.w = ctx.state.settings.units === 'lb' ? Math.round(v * 0.45359237 * 100) / 100 : v;
      } else set.reps = Number(input.value) || 0;
    }, { silent: true });
  });

  root.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    const sessBtn = e.target.closest('[data-session]');
    if (sessBtn) { openPastSession(ctx, sessBtn.dataset.session); return; }
    if (!el) return;
    const act = el.dataset.act;
    const ei = el.dataset.entry !== undefined ? Number(el.dataset.entry) : null;
    const si = el.dataset.set !== undefined ? Number(el.dataset.set) : null;

    switch (act) {
      case 'toggleSet': toggleSet(ctx, ei, si); break;
      case 'setType': openSetTypeSheet(ctx, ei, si); break;
      case 'addSet': addSet(ctx, ei); break;
      case 'copyPrev': copyPrevious(ctx, ei); break;
      case 'plates': openPlateSheet(ctx, ei); break;
      case 'swapEx': swapEntry(ctx, ei); break;
      case 'entryMenu': openEntryMenu(ctx, ei); break;
      case 'exDetail': openExerciseDetail(ctx, el.dataset.ex); break;
      case 'addEx': addExercise(ctx); break;
      case 'finish': finishSession(ctx); break;
      case 'sessionMenu': openSessionMenu(ctx); break;
      case 'discard': {
        const ok = await confirmSheet('このセッションの記録を破棄します。元に戻せません。', { okLabel: '破棄する', danger: true });
        if (ok) { ctx.update(s => { s.activeSession = null; }); stopTimer(); toast('破棄しました'); ctx.refresh(); }
        break;
      }
      case 'pick': {
        const home = await import('./home.js');
        home.openRoutinePicker(ctx);
        break;
      }
    }
  });
}

function withScroll(ctx, fn) {
  const y = window.scrollY;
  fn();
  ctx.refresh();
  window.scrollTo(0, y);
}

function toggleSet(ctx, ei, si) {
  const a = ctx.state.activeSession;
  const entry = a?.entries?.[ei];
  const set = entry?.sets?.[si];
  if (!set) return;
  const ex = ctx.exerciseById(entry.exId);
  const turningOn = !set.done;

  // 入力欄の現在値を取り込んでから確定する
  const row = document.querySelector(`.set-row[data-entry="${ei}"][data-set="${si}"]`);
  if (row) {
    const wEl = row.querySelector('[data-field="w"]');
    const rEl = row.querySelector('[data-field="reps"]');
    const rirEl = row.querySelector('[data-field="rir"]');
    ctx.update(s => {
      const st = s.activeSession.entries[ei].sets[si];
      if (wEl) {
        const v = Number(wEl.value) || 0;
        st.w = ctx.state.settings.units === 'lb' ? Math.round(v * 0.45359237 * 100) / 100 : v;
      }
      if (rEl) st.reps = Number(rEl.value) || 0;
      if (rirEl) st.rir = rirEl.value === '' ? null : Number(rirEl.value);
    }, { silent: true });
  }

  if (turningOn && !(ctx.state.activeSession.entries[ei].sets[si].reps > 0)) {
    toast('回数を入力してください', 'warn');
    return;
  }

  let prs = [];
  if (turningOn && set.type !== 'warmup' && ex) {
    const best = prContext(ctx.state, entry.exId, ctx.state.activeSession.id, ctx.state.profile.weight);
    prs = checkSetPRs(best, { ...ctx.state.activeSession.entries[ei].sets[si], done: true });
  }

  withScroll(ctx, () => {
    ctx.update(s => {
      const st = s.activeSession.entries[ei].sets[si];
      st.done = turningOn;
      st.ts = turningOn ? new Date().toISOString() : null;
    });
  });

  haptic(turningOn ? 14 : 8);

  if (turningOn) {
    for (const pr of prs) {
      toast(`🏆 ${PR_LABEL[pr.type]}！ ${ex.name} ${pr.type === 'reps' ? pr.value + '回' : fmtWeight(pr.value, ctx.state.settings.units)}`, 'pr', 4200);
    }
    if (ctx.state.settings.autoTimer !== false && set.type !== 'warmup') {
      const next = nextSetHint(ctx, ei, si);
      startTimer(entry.rest || 120, { next, settings: ctx.state.settings });
    }
  }
}

function nextSetHint(ctx, ei, si) {
  const a = ctx.state.activeSession;
  const units = ctx.state.settings.units;
  const entry = a.entries[ei];
  for (let i = si + 1; i < entry.sets.length; i++) {
    const s = entry.sets[i];
    if (s.done) continue;
    const ex = ctx.exerciseById(entry.exId);
    return `次: ${ex?.name || ''} ${ex?.time ? s.reps + '秒' : fmtWeight(s.w, units) + ' × ' + s.reps + '回'}${s.rir != null ? `（RIR${s.rir}）` : ''}`;
  }
  for (let j = ei + 1; j < a.entries.length; j++) {
    const e2 = a.entries[j];
    const s = e2.sets.find(x => !x.done);
    if (s) {
      const ex = ctx.exerciseById(e2.exId);
      return `次の種目: ${ex?.name || ''} ${ex?.time ? s.reps + '秒' : fmtWeight(s.w, units) + ' × ' + s.reps + '回'}`;
    }
  }
  return '全セット完了！お疲れさまでした';
}

function addSet(ctx, ei) {
  withScroll(ctx, () => {
    ctx.update(s => {
      const entry = s.activeSession.entries[ei];
      const lastWork = [...entry.sets].reverse().find(x => x.type !== 'warmup');
      entry.sets.push(mkSet(lastWork?.w ?? 0, lastWork?.reps ?? entry.repLow ?? 8, entry.rir ?? null, 'work'));
    });
  });
}

function copyPrevious(ctx, ei) {
  const entry = ctx.state.activeSession.entries[ei];
  const last = historyFor(ctx.state, entry.exId, 1)[0];
  if (!last) return;
  const prev = workSets(last.entry);
  if (!prev.length) return;
  withScroll(ctx, () => {
    ctx.update(s => {
      const e = s.activeSession.entries[ei];
      const warm = e.sets.filter(x => x.type === 'warmup');
      e.sets = [...warm, ...prev.map(p => mkSet(p.w, p.reps, p.rir, 'work'))];
    });
  });
  toast('前回の内容をコピーしました', 'good');
}

function openSetTypeSheet(ctx, ei, si) {
  const set = ctx.state.activeSession.entries[ei].sets[si];
  openSheet({
    title: 'セットの種類',
    body: `<div class="list">
      ${Object.entries(SET_TYPES).map(([k, v]) => `<button class="list-item" data-type="${k}">
        <span class="lead">${v.short || '●'}</span>
        <span class="grow"><span class="t">${esc(v.label)}</span></span>
        <span class="trail">${set.type === k ? '✓' : ''}</span></button>`).join('')}
      <button class="list-item" data-type="__delete"><span class="lead">🗑️</span>
        <span class="grow"><span class="t" style="color:var(--danger)">このセットを削除</span></span></button>
    </div>`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-type]')?.dataset.type;
        if (!t) return;
        close();
        withScroll(ctx, () => {
          ctx.update(s => {
            const entry = s.activeSession.entries[ei];
            if (t === '__delete') entry.sets.splice(si, 1);
            else entry.sets[si].type = t;
          });
        });
      });
    }
  });
}

function openPlateSheet(ctx, ei) {
  const entry = ctx.state.activeSession.entries[ei];
  const ex = ctx.exerciseById(entry.exId);
  const units = ctx.state.settings.units;
  const target = entry.sets.find(s => !s.done && s.type !== 'warmup')?.w
    || entry.sets[entry.sets.length - 1]?.w || 0;

  const render = w => {
    const b = plateBreakdown(w, ex, ctx.gym);
    if (!b) return '<p class="small muted">この種目はバーを使いません。</p>';
    return `
      <div class="plate-viz">
        <div class="plate-bar"></div>
        ${b.perSide.slice().reverse().flatMap(p => Array.from({ length: p.n }, () =>
          `<div class="plate" style="height:${plateHeight(p.w)}px;background:${plateColor(p.w)}">${p.w}</div>`)).join('') || '<span class="tiny faint" style="padding:0 8px">プレートなし</span>'}
        <div class="plate-collar"></div>
      </div>
      <div class="kv" style="margin-top:12px">
        <dt>バー</dt><dd>${fmtWeight(b.bar, units)}</dd>
        <dt>片側</dt><dd>${b.perSide.map(p => `${p.w}×${p.n}`).join(' + ') || 'なし'}</dd>
        <dt>合計</dt><dd>${fmtWeight(b.achieved, units)}</dd>
        ${Math.abs(b.diff) > 0.01 ? `<dt>目標との差</dt><dd style="color:var(--warn)">${b.diff > 0 ? '+' : ''}${b.diff}kg</dd>` : ''}
      </div>`;
  };

  openSheet({
    title: 'プレート計算',
    body: `<div class="field"><span class="field-label">合計重量</span>
      <div class="row" style="gap:6px">
        <button class="btn" data-adj="-1">−</button>
        <input class="input mono center" id="plateW" type="number" inputmode="decimal" step="0.5" value="${target}" style="text-align:center;font-size:19px;font-weight:800">
        <button class="btn" data-adj="1">＋</button>
      </div></div>
      <div id="plateOut">${render(target)}</div>
      <p class="tiny faint" style="margin-top:10px">${esc(ctx.gym.name)}のプレート構成で計算しています。設定タブで手持ちの器具に合わせられます。</p>`,
    onMount(root) {
      const input = root.querySelector('#plateW');
      const out = root.querySelector('#plateOut');
      const step = increment(ex, ctx.gym);
      const upd = () => { out.innerHTML = render(Number(input.value) || 0); };
      input.addEventListener('input', upd);
      root.addEventListener('click', e => {
        const d = e.target.closest('[data-adj]');
        if (!d) return;
        input.value = Math.max(0, Math.round(((Number(input.value) || 0) + step * Number(d.dataset.adj)) * 100) / 100);
        upd();
      });
    }
  });
}

const plateColor = w => ({
  25: '#d9453d', 20: '#3a6be0', 15: '#e8a417', 10: '#2f9e56',
  5: '#c8ccd4', 2.5: '#8b93a1', 1.25: '#5e6675'
}[w] || '#6d7cff');
const plateHeight = w => Math.max(26, Math.min(74, 26 + w * 2));

function swapEntry(ctx, ei) {
  const entry = ctx.state.activeSession.entries[ei];
  openSwap(ctx, entry.exId, newId => {
    const ex = ctx.exerciseById(newId);
    const sug = suggestNext(ctx.state, ex, entry, ctx.gym);
    withScroll(ctx, () => {
      ctx.update(s => {
        const e = s.activeSession.entries[ei];
        e.exId = newId;
        e.rest = restSeconds(ex, e, GOAL_BY_ID[s.profile.goal]);
        // 未完了のセットだけ新しい種目の推奨値に置き換える
        for (const st of e.sets) {
          if (!st.done) { st.w = st.type === 'warmup' ? Math.round(sug.weight * 0.5 * 2) / 2 : sug.weight; st.reps = sug.reps; }
        }
      });
    });
    toast(`${ex.name} に差し替えました`, 'good');
  });
}

function addExercise(ctx) {
  const exclude = new Set(ctx.state.activeSession.entries.map(e => e.exId));
  openPicker(ctx, {
    title: '種目を追加', exclude,
    onPick(id) {
      const ex = ctx.exerciseById(id);
      if (!ex) return;
      const goal = GOAL_BY_ID[ctx.state.profile.goal];
      const item = { sets: 3, repLow: goal?.reps[0] ?? 8, repHigh: goal?.reps[1] ?? 12, rir: goal?.rir ?? 2 };
      const sug = suggestNext(ctx.state, ex, item, ctx.gym);
      const warm = ctx.state.settings.showWarmup !== false ? buildWarmup(sug.weight, ex, ctx.gym, { goal: ctx.state.profile.goal }) : [];
      withScroll(ctx, () => {
        ctx.update(s => {
          s.activeSession.entries.push({
            exId: id, note: '', supersetId: null,
            targetSets: item.sets, repLow: item.repLow, repHigh: item.repHigh, rir: item.rir,
            rest: restSeconds(ex, item, goal),
            sets: [
              ...warm.map(w => mkSet(w.w, w.reps, null, 'warmup')),
              ...Array.from({ length: item.sets }, () => mkSet(sug.weight, sug.reps, item.rir, 'work'))
            ]
          });
        });
      });
    }
  });
}

function openEntryMenu(ctx, ei) {
  const entry = ctx.state.activeSession.entries[ei];
  const ex = ctx.exerciseById(entry.exId);
  openSheet({
    title: ex?.name || '種目',
    body: `<div class="field"><label>この種目のメモ</label>
        <textarea class="input" id="entryNote" placeholder="重かった、フォームが崩れた、など">${esc(entry.note || '')}</textarea></div>
      <div class="field"><label>休憩時間（秒）</label>
        <input class="input" id="entryRest" type="number" inputmode="numeric" step="15" min="15" max="600" value="${entry.rest}"></div>
      <div class="list" style="margin-top:8px">
        <button class="list-item" data-m="superset"><span class="lead">🔗</span>
          <span class="grow"><span class="t">${entry.supersetId ? 'スーパーセットを解除' : '次の種目とスーパーセット'}</span>
          <span class="s">交互に行い、休憩は最後にまとめて取る</span></span></button>
        <button class="list-item" data-m="up"><span class="lead">⬆️</span><span class="grow"><span class="t">順番を上げる</span></span></button>
        <button class="list-item" data-m="down"><span class="lead">⬇️</span><span class="grow"><span class="t">順番を下げる</span></span></button>
        <button class="list-item" data-m="remove"><span class="lead">🗑️</span>
          <span class="grow"><span class="t" style="color:var(--danger)">この種目を削除</span></span></button>
      </div>`,
    actions: '<button class="btn primary" data-m="save">保存して閉じる</button>',
    onMount(root, close) {
      root.addEventListener('click', e => {
        const m = e.target.closest('[data-m]')?.dataset.m;
        if (!m) return;
        const note = root.querySelector('#entryNote')?.value ?? entry.note;
        const rest = Number(root.querySelector('#entryRest')?.value) || entry.rest;
        close();
        withScroll(ctx, () => {
          ctx.update(s => {
            const list = s.activeSession.entries;
            const e2 = list[ei];
            e2.note = note;
            e2.rest = rest;
            if (m === 'remove') list.splice(ei, 1);
            else if (m === 'up' && ei > 0) { [list[ei - 1], list[ei]] = [list[ei], list[ei - 1]]; }
            else if (m === 'down' && ei < list.length - 1) { [list[ei + 1], list[ei]] = [list[ei], list[ei + 1]]; }
            else if (m === 'superset') {
              if (e2.supersetId) {
                const gid = e2.supersetId;
                for (const x of list) if (x.supersetId === gid) x.supersetId = null;
              } else if (list[ei + 1]) {
                const gid = uid();
                e2.supersetId = gid;
                list[ei + 1].supersetId = gid;
                e2.rest = 20;
              } else {
                toast('次に種目がありません', 'warn');
              }
            }
          });
        });
      });
    }
  });
}

function openSessionMenu(ctx) {
  const a = ctx.state.activeSession;
  openSheet({
    title: 'セッション',
    body: `<div class="field"><label>セッション名</label>
        <input class="input" id="sName" value="${esc(a.name)}"></div>
      <div class="field"><label>メモ</label>
        <textarea class="input" id="sNote" placeholder="体調、ジムの混み具合、気づいたこと">${esc(a.note || '')}</textarea></div>`,
    actions: '<button class="btn primary" data-m="save">保存</button>',
    onMount(root, close) {
      root.addEventListener('click', e => {
        if (!e.target.closest('[data-m="save"]')) return;
        const name = root.querySelector('#sName').value.trim() || a.name;
        const note = root.querySelector('#sNote').value;
        ctx.update(s => { s.activeSession.name = name; s.activeSession.note = note; });
        close();
        ctx.refresh();
      });
    }
  });
}

// ---- 終了とサマリー ------------------------------------------------------

async function finishSession(ctx) {
  const a = ctx.state.activeSession;
  const done = a.entries.reduce((n, e) => n + e.sets.filter(x => x.done && x.type !== 'warmup').length, 0);
  if (done === 0) {
    const ok = await confirmSheet('完了したセットがありません。セッションを破棄しますか？', { okLabel: '破棄する', danger: true });
    if (ok) { ctx.update(s => { s.activeSession = null; }); stopTimer(); ctx.go('home'); }
    return;
  }

  openSheet({
    title: 'お疲れさまでした', size: 'auto',
    body: `
      <p class="small muted">今日の追い込み具合を教えてください。次回の重量とセット数の調整に使います。</p>
      <div class="field" style="margin-top:12px">
        <span class="field-label">セッションRPE（1=楽勝 / 10=限界）</span>
        <div class="opt-grid" id="rpeGrid">
          ${[5, 6, 7, 8, 9, 10].map(v => `<button class="opt" data-rpe="${v}">${v}</button>`).join('')}
        </div>
      </div>
      <div class="field"><label>メモ（任意）</label>
        <textarea class="input" id="finNote" placeholder="次回への申し送り">${esc(a.note || '')}</textarea></div>`,
    actions: '<button class="btn ghost" data-m="back">戻る</button><button class="btn mint" data-m="save">記録して終了</button>',
    onMount(root, close) {
      let rpe = 8;
      root.querySelector('[data-rpe="8"]').classList.add('on');
      root.addEventListener('click', e => {
        const r = e.target.closest('[data-rpe]');
        if (r) {
          rpe = Number(r.dataset.rpe);
          root.querySelectorAll('[data-rpe]').forEach(b => b.classList.toggle('on', b === r));
          return;
        }
        const m = e.target.closest('[data-m]')?.dataset.m;
        if (m === 'back') return close();
        if (m !== 'save') return;
        const note = root.querySelector('#finNote').value;
        close();
        commitSession(ctx, rpe, note);
      });
    }
  });
}

function commitSession(ctx, rpe, note) {
  const a = ctx.state.activeSession;
  const finished = {
    ...a,
    endedAt: new Date().toISOString(),
    sessionRpe: rpe,
    note,
    entries: a.entries
      .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
      .filter(e => e.sets.length > 0)
  };

  ctx.update(s => {
    s.sessions.push(finished);
    s.sessions.sort((x, y) => x.date.localeCompare(y.date));
    s.activeSession = null;
  });
  stopTimer();
  ctx.refresh();
  showSummary(ctx, finished, rpe);
}

export function showSummary(ctx, session, rpe) {
  const sum = sessionSummary(ctx.state, session, ctx.exerciseById, ctx.state.profile.weight);
  const units = ctx.state.settings.units;
  const plannedSets = (session.entries || []).reduce((n, e) => n + (e.targetSets || e.sets.length), 0);
  const fb = sessionFeedback(rpe ?? session.sessionRpe ?? 8, plannedSets, sum.totalSets);
  const muscles = Object.entries(sum.perMuscle).sort((a, b) => b[1] - a[1]);
  const stretches = [...new Set(muscles.slice(0, 5).map(([m]) => m))]
    .flatMap(m => (STRETCHES[m] || []).map(s => ({ ...s, muscle: m })));

  openSheet({
    title: 'トレーニングまとめ', size: 'full',
    body: `
      <div class="stat-grid">
        <div class="stat"><div class="v">${num(sum.totalVolume)}</div><div class="k">総ボリューム(kg)</div>
          ${sum.volumeDelta != null ? `<div class="d ${sum.volumeDelta >= 0 ? 'up' : 'down'}">${sum.volumeDelta >= 0 ? '+' : ''}${sum.volumeDelta}% vs前回</div>` : ''}</div>
        <div class="stat"><div class="v">${sum.totalSets}</div><div class="k">セット</div></div>
        <div class="stat"><div class="v">${sum.totalReps}</div><div class="k">総レップ</div></div>
        <div class="stat"><div class="v">${sum.duration ?? '—'}</div><div class="k">所要(分)</div></div>
      </div>

      ${sum.prs.length ? `<div class="section-title">🏆 自己ベスト更新</div>
        ${sum.prs.map(p => `<div class="note good"><span class="ic">🏆</span><span>
          <strong>${esc(p.exName)}</strong> ${esc(PR_LABEL[p.type])}：
          ${p.type === 'reps' ? p.value + '回' : fmtWeight(p.value, units)}
          <span class="faint">（これまで ${p.type === 'reps' ? p.prev + '回' : fmtWeight(p.prev, units)}）</span>
        </span></div>`).join('')}` : ''}

      <div class="section-title">部位別セット数</div>
      <div class="chips">${muscles.map(([m, n]) => `<span class="chip">${esc(MUSCLE_BY_ID[m]?.name || m)} ${num(n, 1)}</span>`).join('')}</div>

      <div class="section-title">次回への申し送り</div>
      <div class="note ${fb.tone === 'warn' ? 'warn' : 'good'}"><span class="ic">➡️</span><span>${esc(fb.text)}</span></div>

      ${stretches.length ? `<div class="section-title">クールダウン（今日鍛えた部位）</div>
        ${stretches.map(s => `<div class="note"><span class="ic">🧘</span><span><strong>${esc(s.name)}</strong> ${s.sec}秒${s.note ? `<br><span class="tiny faint">${esc(s.note)}</span>` : ''}</span></div>`).join('')}` : ''}

      <div class="note" style="margin-top:14px"><span class="ic">🍚</span><span>トレーニング後2時間以内にタンパク質20〜40gと炭水化物を。今日の回復が明日の伸びになります。</span></div>`,
    actions: '<button class="btn primary" data-m="close">閉じる</button>',
    onMount(root, close) {
      root.addEventListener('click', e => { if (e.target.closest('[data-m="close"]')) { close(); ctx.go('home'); } });
    }
  });
}

/** 過去のセッションを見る */
export function openPastSession(ctx, sessionId) {
  const session = ctx.state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const units = ctx.state.settings.units;
  const sum = sessionSummary(ctx.state, session, ctx.exerciseById, ctx.state.profile.weight);

  openSheet({
    title: session.name, size: 'full',
    body: `
      <div class="tiny faint">${esc(relDate(session.date, ctx.today))} ・ ${esc(session.date)}${session.sessionRpe ? ` ・ RPE${session.sessionRpe}` : ''}</div>
      <div class="stat-grid" style="margin-top:10px">
        <div class="stat"><div class="v">${num(sum.totalVolume)}</div><div class="k">ボリューム(kg)</div></div>
        <div class="stat"><div class="v">${sum.totalSets}</div><div class="k">セット</div></div>
        <div class="stat"><div class="v">${fmtDuration(sum.duration)}</div><div class="k">所要</div></div>
      </div>
      ${session.note ? `<div class="note" style="margin-top:10px"><span class="ic">📝</span><span>${esc(session.note)}</span></div>` : ''}
      <div class="section-title">内容</div>
      ${(session.entries || []).map(e => {
        const ex = ctx.exerciseById(e.exId);
        return `<div class="card">
          <div class="card-head"><h3>${esc(ex?.name || e.exId)}</h3></div>
          <div class="chips">${e.sets.map(s =>
            `<span class="chip ${s.type === 'warmup' ? '' : 'mint'}">${ex?.time ? s.reps + '秒' : fmtWeight(s.w, units) + '×' + s.reps}${s.rir != null ? ` R${s.rir}` : ''}</span>`).join('')}</div>
          ${e.note ? `<p class="tiny faint" style="margin-top:6px">${esc(e.note)}</p>` : ''}
        </div>`;
      }).join('')}
      <button class="btn ghost block" data-m="delete" style="margin-top:12px">この記録を削除</button>`,
    onMount(root, close) {
      root.addEventListener('click', async e => {
        if (!e.target.closest('[data-m="delete"]')) return;
        const ok = await confirmSheet('この日の記録を削除します。元に戻せません。', { okLabel: '削除する', danger: true });
        if (!ok) return;
        ctx.update(s => { s.sessions = s.sessions.filter(x => x.id !== sessionId); });
        close();
        toast('削除しました');
        ctx.refresh();
      });
    }
  });
}

