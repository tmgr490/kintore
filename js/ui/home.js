// ホーム（筋トレ前）：今日の予定、コンディション入力、今日のメニュー、部位の回復状況。

import { esc, num, fmtDate, relDate, bar, empty, toast, openSheet, confirmSheet, haptic } from './dom.js';
import { CONDITION_FIELDS, SORENESS_LEVELS, defaultCondition, readiness, adjustment } from '../engine/autoreg.js';
import { buildTodayPlan, estimateDuration, priorityMuscles } from '../engine/planner.js';
import { freshness, weeklyStatus } from '../engine/volume.js';
import { insights } from '../engine/analysis.js';
import { weekStreak, sessionsInLastDays } from '../engine/history.js';
import { fmtWeight } from '../engine/plates.js';
import { MUSCLES } from '../data/muscles.js';
import { startSession } from './session.js';
import { GENERAL_WARMUP } from '../data/guide.js';

export const title = '今日';
export const subtitle = ctx => fmtDate(ctx.today);

let condOpen = false;

export function todayCheckin(state, today) {
  return state.checkins.find(c => c.date === today) || null;
}

function conditionOf(ctx) {
  return todayCheckin(ctx.state, ctx.today)?.condition || defaultCondition();
}

export function render(ctx) {
  const { state, today } = ctx;
  const checkin = todayCheckin(state, today);
  const cond = conditionOf(ctx);
  const adj = adjustment(checkin ? cond : null);
  const plan = buildTodayPlan(state, ctx.exerciseById, ctx.gym, today, checkin ? cond : null);
  const doneToday = state.sessions.filter(s => s.date === today);
  const units = state.settings.units;

  return `
    ${renderHero(ctx, plan, doneToday, adj, checkin)}
    ${renderCondition(ctx, cond, checkin, adj)}
    ${renderPlan(ctx, plan, units)}
    ${renderInsights(ctx)}
    ${renderFreshness(ctx)}
    ${renderWeekly(ctx)}
    ${renderQuick(ctx)}
  `;
}

function renderHero(ctx, plan, doneToday, adj, checkin) {
  const { state, today } = ctx;
  const streak = weekStreak(state, today);
  const last30 = sessionsInLastDays(state, today, 30).length;
  const active = state.activeSession;

  if (active) {
    const n = active.entries.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0);
    return `<div class="hero">
      <div class="eyebrow">実施中</div>
      <h2>${esc(active.name)}</h2>
      <div class="meta">${n}セット完了 ・ ${relDate(active.date, today)}開始</div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn mint grow lg" data-act="resume">記録に戻る</button>
      </div>
    </div>`;
  }

  const isRest = plan.source === 'scheduled' && !plan.routine;
  const label = doneToday.length ? '今日はもう完了' : plan.routine ? (plan.source === 'scheduled' ? '今日の予定' : '今日のおすすめ') : '予定なし';
  const name = doneToday.length
    ? doneToday.map(s => s.name).join(' / ')
    : plan.routine ? plan.routine.name : '休養日';
  const mins = plan.items.length ? estimateDuration(plan.items) : 0;

  return `<div class="hero">
    <div class="eyebrow">${esc(label)}</div>
    <h2>${esc(name)}</h2>
    <div class="meta">
      ${plan.items.length ? `${plan.items.length}種目 ・ 約${mins}分 ・ ${plan.items.reduce((s, i) => s + i.sets, 0)}セット` : '今日はしっかり休んで回復させましょう'}
      ${streak > 0 ? ` ・ 🔥${streak}週連続` : ''}
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      ${doneToday.length
        ? `<button class="btn grow" data-act="start">もう1セッション行う</button>`
        : plan.items.length
          ? `<button class="btn mint grow lg" data-act="start">${checkin ? '' : ''}トレーニング開始</button>`
          : `<button class="btn grow" data-act="pick">メニューを選ぶ</button>`}
      ${plan.items.length ? `<button class="icon-btn" data-act="warmupGuide" aria-label="ウォームアップ">🤸</button>` : ''}
    </div>
    ${isRest && !doneToday.length ? '' : ''}
    <div class="tiny faint" style="margin-top:8px">直近30日で${last30}回トレーニング</div>
  </div>`;
}

function renderCondition(ctx, cond, checkin, adj) {
  const r = readiness(checkin ? cond : null);
  const sore = Object.entries(cond.soreness || {}).filter(([, v]) => v > 0);
  const tone = adj.tone === 'good' ? 'mint' : adj.tone === 'warn' ? 'warn' : 'danger';

  return `<div class="card ${checkin ? '' : 'accent'}">
    <div class="card-head">
      <h2>今日のコンディション</h2>
      <button class="more" data-act="toggleCond">${condOpen ? '閉じる' : checkin ? '編集' : '入力する'}</button>
    </div>
    ${checkin ? `
      <div class="ready-ring">
        ${ring(r, tone)}
        <div class="grow">
          <div style="font-weight:700;font-size:14px">準備度 ${r}%</div>
          <div class="small muted">${esc(adj.label)}</div>
          ${adj.loadFactor !== 1 ? `<div class="tiny faint" style="margin-top:3px">重量 ×${adj.loadFactor.toFixed(2)} ／ セット数 ×${adj.setFactor.toFixed(2)} で自動調整中</div>` : ''}
        </div>
      </div>
      ${sore.length ? `<div class="chips" style="margin-top:10px">${sore.map(([m, v]) =>
        `<span class="chip ${v >= 2 ? 'danger' : 'warn'}">${esc(MUSCLES.find(x => x.id === m)?.name || m)} ${esc(SORENESS_LEVELS[v].label)}</span>`).join('')}</div>` : ''}
    ` : `
      <p class="small muted">睡眠・疲労・筋肉痛を30秒で入力すると、今日の重量とセット数を自動で調整します。</p>
    `}
    ${condOpen ? conditionForm(cond) : ''}
  </div>`;
}

function conditionForm(cond) {
  return `<div style="margin-top:12px">
    <div class="cond-grid">
      ${CONDITION_FIELDS.map(f => `
        <div class="cond-item">
          <div class="cond-head">
            <span>${f.icon} ${esc(f.label)}</span>
            <span class="faint tiny">${esc(f.low)} → ${esc(f.high)}</span>
          </div>
          <div class="rate" data-rate="${f.key}">
            ${[1, 2, 3, 4, 5].map(v => `<button class="${cond[f.key] === v ? 'on' : ''}" data-val="${v}">${v}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <button class="btn block" style="margin-top:12px" data-act="soreness">
      筋肉痛の部位を選ぶ${Object.values(cond.soreness || {}).filter(v => v > 0).length ? `（${Object.values(cond.soreness).filter(v => v > 0).length}部位）` : ''}
    </button>
    <button class="btn primary block" style="margin-top:8px" data-act="saveCond">この内容で今日のメニューを調整</button>
  </div>`;
}

function ring(pct, tone) {
  const R = 26, C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const color = tone === 'mint' ? 'var(--mint)' : tone === 'warn' ? 'var(--warn)' : 'var(--danger)';
  return `<div class="ring">
    <svg width="62" height="62" viewBox="0 0 62 62">
      <circle cx="31" cy="31" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
      <circle cx="31" cy="31" r="${R}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
    </svg>
    <div class="rv">${pct}</div>
  </div>`;
}

function renderPlan(ctx, plan, units) {
  if (!plan.items.length) {
    if (!ctx.state.routines.length) {
      return `<div class="card">${empty('🗓️', 'メニューがまだありません', '「予定」タブでプログラムを選ぶと、曜日ごとのメニューが自動で作られます。',
        '<button class="btn primary" data-act="goPlan">プログラムを選ぶ</button>')}</div>`;
    }
    return `<div class="card">${empty('😴', '今日は休養日', '筋肉は休んでいる間に育ちます。物足りなければ下のボタンから追加できます。',
      '<button class="btn" data-act="pick">メニューを選んで行う</button>')}</div>`;
  }

  return `
    <div class="section-title">今日のメニュー</div>
    ${plan.notes.map(n => `<div class="note"><span class="ic">💡</span><span>${esc(n)}</span></div>`).join('')}
    ${plan.items.map((it, i) => {
      const s = it.suggestion;
      const w = it.ex.bw || it.ex.time ? '' : fmtWeight(s.weight, units);
      const repTxt = it.ex.time ? `${it.repLow}〜${it.repHigh}秒` : `${s.reps}回`;
      return `<div class="ex-card">
        <div class="ex-head" style="cursor:default">
          <span class="idx">${i + 1}</span>
          <span class="grow">
            <span class="ex-name">${esc(it.ex.name)}</span>
            <span class="ex-sub">${it.sets}セット × ${it.repLow}〜${it.repHigh}${it.ex.time ? '秒' : '回'} ・ RIR${it.rir} ・ 休憩${it.rest}秒${it.plannedSets !== it.sets ? `（予定${it.plannedSets}→${it.sets}に調整）` : ''}</span>
          </span>
          ${it.flag ? `<span class="chip ${it.flag === 'pain' ? 'danger' : 'warn'}">${it.flag === 'pain' ? '要注意' : '筋肉痛'}</span>` : ''}
          <button class="icon-btn" data-act="swap" data-ex="${esc(it.exId)}" aria-label="種目を差し替える">⇄</button>
        </div>
        <div class="ex-body">
          <div class="target-box">
            <div class="grow">
              <div class="tv">${w ? w + ' × ' : ''}${repTxt}</div>
              <div class="tr">${esc(s.reason)}</div>
            </div>
          </div>
          ${it.warmup.length ? `<div class="prev-hint">
            <strong class="faint">ウォームアップ</strong>
            ${it.warmup.map(x => `<span class="chip">${fmtWeight(x.w, units)}×${x.reps}</span>`).join('')}
          </div>` : ''}
          ${s.last ? `<div class="prev-hint">前回 ${relDate(s.last.session.date, ctx.today)}：
            ${s.last.entry.sets.filter(x => x.done && x.type !== 'warmup').map(x =>
              `<span class="chip">${it.ex.time ? x.reps + '秒' : fmtWeight(x.w, units) + '×' + x.reps}${x.rir != null ? ` <span class="faint">R${x.rir}</span>` : ''}</span>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
    }).join('')}
    <button class="btn mint block lg" data-act="start" style="margin-top:6px">このメニューで開始</button>
  `;
}

function renderInsights(ctx) {
  const list = insights(ctx.state, ctx.exerciseById, ctx.today);
  if (!list.length) return '';
  return `<div class="section-title">気づき</div>
    ${list.map(i => `<div class="note ${i.level === 'warn' ? 'warn' : i.level === 'good' ? 'good' : ''}">
      <span class="ic">${i.icon}</span><span>${esc(i.text)}</span></div>`).join('')}`;
}

function renderFreshness(ctx) {
  const list = freshness(ctx.state, ctx.exerciseById, new Date(ctx.today + 'T12:00:00'))
    .filter(f => f.muscle.mev > 0)
    .sort((a, b) => b.recovery - a.recovery);
  if (!ctx.state.sessions.length) return '';
  const top = priorityMuscles(ctx.state, ctx.exerciseById, ctx.today, 3);

  return `<div class="card">
    <div class="card-head"><h2>部位の回復状況</h2></div>
    ${top.length ? `<div class="note good"><span class="ic">🎯</span><span>次に鍛えるなら <strong>${top.map(t => esc(t.muscle.name)).join('・')}</strong>（回復済みでボリュームも不足しています）</span></div>` : ''}
    <div class="muscle-grid">
      ${list.slice(0, 12).map(f => `
        <div class="mcell">
          <div class="mn"><span>${esc(f.muscle.short)}</span><span class="faint">${f.recovery}%</span></div>
          <div class="mv">${f.lastDate ? relDate(f.lastDate, ctx.today) : '未実施'}</div>
          ${bar(f.recovery, f.recovery >= 90 ? 'mint' : f.recovery >= 50 ? '' : 'warn')}
        </div>`).join('')}
    </div>
  </div>`;
}

function renderWeekly(ctx) {
  const w = weeklyStatus(ctx.state, ctx.exerciseById, ctx.today).filter(x => x.sets > 0);
  if (!w.length) return '';
  const total = w.reduce((s, x) => s + x.sets, 0);
  return `<div class="card">
    <div class="card-head"><h2>今週のボリューム</h2><span class="chip">${num(total, 1)}セット</span></div>
    ${w.sort((a, b) => b.sets - a.sets).slice(0, 8).map(x => `
      <div style="margin-bottom:9px">
        <div class="row between tiny" style="margin-bottom:3px">
          <span style="font-weight:650">${esc(x.muscle.name)}</span>
          <span class="faint">${num(x.sets, 1)} / 目安${x.muscle.mav}セット</span>
        </div>
        ${bar(x.pct, x.status === 'over' ? 'danger' : x.status === 'high' ? 'mint' : x.status === 'ok' ? '' : 'warn')}
      </div>`).join('')}
    <button class="btn sm ghost block" data-act="goStats" style="margin-top:4px">分析タブで詳しく見る</button>
  </div>`;
}

function renderQuick(ctx) {
  const bodyToday = ctx.state.bodyLog.find(b => b.date === ctx.today);
  return `<div class="card flush">
    <div class="list">
      <button class="list-item" data-act="logBody">
        <span class="lead">⚖️</span>
        <span class="grow"><span class="t">体重・体組成を記録</span>
        <span class="s">${bodyToday ? `今日: ${bodyToday.weight}kg 記録済み` : '最終記録 ' + (ctx.state.bodyLog.length ? relDate(ctx.state.bodyLog[ctx.state.bodyLog.length - 1].date, ctx.today) : 'なし')}</span></span>
        <span class="trail">›</span>
      </button>
      <button class="list-item" data-act="warmupGuide">
        <span class="lead">🤸</span>
        <span class="grow"><span class="t">ウォームアップの手順</span><span class="s">トレーニング前の5〜7分</span></span>
        <span class="trail">›</span>
      </button>
      <button class="list-item" data-act="pick">
        <span class="lead">⚡</span>
        <span class="grow"><span class="t">別のメニューで始める</span><span class="s">予定外のトレーニングもここから</span></span>
        <span class="trail">›</span>
      </button>
    </div>
  </div>`;
}

// ---- イベント ----------------------------------------------------------

export function bind(root, ctx) {
  root.addEventListener('click', async e => {
    const rateBtn = e.target.closest('.rate button');
    if (rateBtn) {
      const key = rateBtn.closest('[data-rate]').dataset.rate;
      const val = Number(rateBtn.dataset.val);
      saveCondition(ctx, c => { c[key] = val; }, false);
      haptic(8);
      ctx.refresh();
      return;
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const el = e.target.closest('[data-act]');

    switch (act) {
      case 'toggleCond':
        condOpen = !condOpen;
        if (condOpen && !todayCheckin(ctx.state, ctx.today)) saveCondition(ctx, () => {}, false);
        ctx.refresh();
        break;

      case 'saveCond':
        condOpen = false;
        toast('コンディションを反映しました', 'good');
        ctx.refresh();
        break;

      case 'soreness':
        openSorenessSheet(ctx);
        break;

      case 'start': {
        const cond = todayCheckin(ctx.state, ctx.today)?.condition || null;
        const plan = buildTodayPlan(ctx.state, ctx.exerciseById, ctx.gym, ctx.today, cond);
        if (!plan.items.length) { toast('メニューがありません', 'warn'); break; }
        if (ctx.state.activeSession) {
          const ok = await confirmSheet('実施中のセッションがあります。破棄して新しく始めますか？', { okLabel: '新しく始める', danger: true });
          if (!ok) break;
        }
        startSession(ctx, plan);
        break;
      }

      case 'resume':
        ctx.go('session');
        break;

      case 'pick':
        openRoutinePicker(ctx);
        break;

      case 'swap':
        openSwapSheet(ctx, el.dataset.ex);
        break;

      case 'warmupGuide':
        openWarmupGuide(ctx);
        break;

      case 'logBody':
        openBodyLog(ctx);
        break;

      case 'goPlan': ctx.go('plan'); break;
      case 'goStats': ctx.go('stats'); break;
    }
  });
}

function saveCondition(ctx, mutate, notify = true) {
  ctx.update(s => {
    let c = s.checkins.find(x => x.date === ctx.today);
    if (!c) { c = { date: ctx.today, condition: defaultCondition() }; s.checkins.push(c); }
    mutate(c.condition);
  });
  if (notify) toast('保存しました', 'good');
}

function openSorenessSheet(ctx) {
  const cond = conditionOf(ctx);
  const body = `<p class="small muted">筋肉痛のある部位を選ぶと、その部位を使う種目に注意マークが付き、代替種目を提案します。</p>
    <div style="margin-top:10px">
      ${MUSCLES.map(m => `
        <div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border-soft)">
          <span style="font-weight:650;font-size:13.5px">${esc(m.name)}</span>
          <div class="row" style="gap:4px" data-sore="${m.id}">
            ${SORENESS_LEVELS.map(l => `<button class="chip ${(cond.soreness?.[m.id] || 0) === l.v ? 'on' : ''}" data-val="${l.v}">${esc(l.label)}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  openSheet({
    title: '筋肉痛の部位', body, size: 'full',
    actions: '<button class="btn primary" data-act="done">完了</button>',
    onMount(root, close) {
      root.addEventListener('click', e => {
        const btn = e.target.closest('[data-sore] .chip');
        if (btn) {
          const m = btn.closest('[data-sore]').dataset.sore;
          const v = Number(btn.dataset.val);
          saveCondition(ctx, c => {
            c.soreness = c.soreness || {};
            if (v === 0) delete c.soreness[m]; else c.soreness[m] = v;
          }, false);
          [...btn.parentElement.children].forEach(b => b.classList.toggle('on', b === btn));
          haptic(8);
          return;
        }
        if (e.target.closest('[data-act="done"]')) { close(); ctx.refresh(); }
      });
    }
  });
}

export function openRoutinePicker(ctx) {
  const rs = ctx.state.routines;
  const body = rs.length
    ? `<div class="list">${rs.map(r => `
        <button class="list-item" data-routine="${r.id}">
          <span class="lead">📋</span>
          <span class="grow"><span class="t">${esc(r.name)}</span>
          <span class="s">${r.items.length}種目 ・ ${r.items.reduce((s, i) => s + i.sets, 0)}セット</span></span>
          <span class="trail">›</span>
        </button>`).join('')}
        <button class="list-item" data-routine="__free">
          <span class="lead">✨</span>
          <span class="grow"><span class="t">自由に組む（空のセッション）</span><span class="s">その場で種目を足していく</span></span>
          <span class="trail">›</span>
        </button>
      </div>`
    : empty('📋', 'メニューがありません', '「予定」タブで作成できます。');

  openSheet({
    title: 'メニューを選ぶ', body,
    onMount(root, close) {
      root.addEventListener('click', async e => {
        const id = e.target.closest('[data-routine]')?.dataset.routine;
        if (!id) return;
        close();
        if (ctx.state.activeSession) {
          const ok = await confirmSheet('実施中のセッションを破棄して新しく始めますか？', { okLabel: '新しく始める', danger: true });
          if (!ok) return;
        }
        if (id === '__free') {
          startSession(ctx, { routine: null, name: 'フリートレーニング', items: [], adj: adjustment(null), goal: null });
        } else {
          const routine = ctx.state.routines.find(r => r.id === id);
          const cond = todayCheckin(ctx.state, ctx.today)?.condition || null;
          const saved = ctx.state.schedule;
          // 選んだルーティンで組み立てるため、一時的にそれを今日の予定として扱う
          const plan = buildPlanFor(ctx, routine, cond);
          void saved;
          startSession(ctx, plan);
        }
      });
    }
  });
}

function buildPlanFor(ctx, routine, cond) {
  const fake = { ...ctx.state, schedule: [...ctx.state.schedule] };
  fake.schedule[new Date(ctx.today + 'T12:00:00').getDay()] = routine.id;
  return buildTodayPlan(fake, ctx.exerciseById, ctx.gym, ctx.today, cond);
}

function openSwapSheet(ctx, exId) {
  import('./exercisePicker.js').then(m => m.openSwap(ctx, exId, newId => {
    ctx.update(s => {
      for (const r of s.routines) {
        for (const it of r.items) if (it.exId === exId) it.exId = newId;
      }
    });
    toast('種目を差し替えました', 'good');
    ctx.refresh();
  }));
}

function openWarmupGuide(ctx) {
  const cond = todayCheckin(ctx.state, ctx.today)?.condition || null;
  const plan = buildTodayPlan(ctx.state, ctx.exerciseById, ctx.gym, ctx.today, cond);
  const units = ctx.state.settings.units;
  openSheet({
    title: 'ウォームアップ', size: 'full',
    body: `
      <div class="section-title">全体（5〜7分）</div>
      ${GENERAL_WARMUP.map(w => `<div class="note"><span class="ic">▶</span><span><strong>${esc(w.name)}</strong> ${Math.round(w.sec / 60) || 1}分<br><span class="tiny faint">${esc(w.note)}</span></span></div>`).join('')}
      <div class="section-title">種目別（重量を段階的に上げる）</div>
      ${plan.items.filter(i => i.warmup.length).map(i => `
        <div class="card">
          <div class="card-head"><h3>${esc(i.ex.name)}</h3></div>
          <div class="chips">
            ${i.warmup.map(w => `<span class="chip">${fmtWeight(w.w, units)} × ${w.reps}回</span>`).join('')}
            <span class="chip mint">本番 ${fmtWeight(i.suggestion.weight, units)} × ${i.suggestion.reps}回</span>
          </div>
        </div>`).join('') || '<p class="small muted">今日は自重・時間種目のみなので、軽く動かして関節を温めれば十分です。</p>'}
      <div class="note warn" style="margin-top:12px"><span class="ic">💡</span><span>筋トレ前の静的ストレッチ（長く伸ばす系）は一時的に筋力を落とします。動的な動きで温めて、じっくり伸ばすのはトレーニング後にしましょう。</span></div>`
  });
}

export function openBodyLog(ctx) {
  const last = [...ctx.state.bodyLog].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const todayRow = ctx.state.bodyLog.find(b => b.date === ctx.today);
  const v = todayRow || last || {};
  const f = (k, label, suffix, step, min, max) => `
    <div class="field"><span class="field-label">${label}</span>
      <input class="input" type="number" inputmode="decimal" name="${k}" value="${v[k] ?? ''}" step="${step}" min="${min}" max="${max}" placeholder="${suffix}">
    </div>`;

  openSheet({
    title: '体重・体組成を記録', size: 'full',
    body: `
      <div class="field-row">
        ${f('weight', '体重 (kg)', 'kg', 0.1, 20, 300)}
        ${f('bodyFat', '体脂肪率 (%)', '%', 0.1, 2, 60)}
      </div>
      <div class="section-title">サイズ（任意・cm）</div>
      <div class="field-row">
        ${f('chest', '胸囲', 'cm', 0.1, 50, 200)}
        ${f('arm', '腕（力こぶ）', 'cm', 0.1, 15, 70)}
      </div>
      <div class="field-row">
        ${f('waist', 'ウエスト', 'cm', 0.1, 40, 200)}
        ${f('thigh', '太もも', 'cm', 0.1, 25, 100)}
      </div>
      <p class="tiny faint">体重はプロフィールにも反映され、自重種目のボリューム計算と初回重量の推定に使われます。</p>`,
    actions: '<button class="btn ghost" data-act="cancel">キャンセル</button><button class="btn primary" data-act="save">保存</button>',
    onMount(root, close) {
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (a === 'cancel') return close();
        if (a !== 'save') return;
        const g = k => {
          const el = root.querySelector(`[name="${k}"]`);
          const n = el && el.value !== '' ? Number(el.value) : null;
          return isFinite(n) ? n : null;
        };
        const row = {
          date: ctx.today, weight: g('weight'), bodyFat: g('bodyFat'),
          chest: g('chest'), arm: g('arm'), waist: g('waist'), thigh: g('thigh')
        };
        if (row.weight == null && row.bodyFat == null) { toast('体重か体脂肪率を入力してください', 'warn'); return; }
        ctx.update(s => {
          const i = s.bodyLog.findIndex(b => b.date === ctx.today);
          if (i >= 0) s.bodyLog[i] = row; else s.bodyLog.push(row);
          s.bodyLog.sort((a, b) => a.date.localeCompare(b.date));
          if (row.weight) s.profile.weight = row.weight;
        });
        close();
        toast('記録しました', 'good');
        ctx.refresh();
      });
    }
  });
}

