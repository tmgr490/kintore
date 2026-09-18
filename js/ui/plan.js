// 予定：週間スケジュール、カレンダー、ルーティンの編集、プログラムの切り替え。

import { esc, num, empty, toast, openSheet, confirmSheet, fmtDate } from './dom.js';
import { DAY_NAMES, PROGRAM_TEMPLATES } from '../data/programs.js';
import { applyProgram, blankRoutine, templateById, estimateWeeklySets } from '../engine/program.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { GOAL_BY_ID } from '../data/guide.js';
import { openPicker, openExerciseDetail } from './exercisePicker.js';
import { openPastSession } from './session.js';

export const title = '予定';
export const subtitle = ctx => {
  const t = templateById(ctx.state.programId);
  return t ? t.name : `${ctx.state.routines.length}個のメニュー`;
};

let calMonth = null; // 'YYYY-MM'

export function render(ctx) {
  return `
    ${renderWeek(ctx)}
    ${renderCalendar(ctx)}
    ${renderRoutines(ctx)}
    <div class="section-title">プログラム</div>
    <div class="card flush"><div class="list">
      <button class="list-item" data-act="templates">
        <span class="lead">📚</span>
        <span class="grow"><span class="t">分割法テンプレートから選び直す</span>
        <span class="s">${esc(templateById(ctx.state.programId)?.name || '未設定')}</span></span>
        <span class="trail">›</span>
      </button>
      <button class="list-item" data-act="newRoutine">
        <span class="lead">✚</span>
        <span class="grow"><span class="t">メニューを自分で作る</span><span class="s">空のメニューに種目を追加していく</span></span>
        <span class="trail">›</span>
      </button>
    </div></div>`;
}

function renderWeek(ctx) {
  const todayDow = new Date(ctx.today + 'T12:00:00').getDay();
  const order = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまり
  return `<div class="card">
    <div class="card-head"><h2>週間スケジュール</h2><span class="chip">${ctx.state.schedule.filter(Boolean).length}日／週</span></div>
    <div class="list" style="margin:0 -14px">
      ${order.map(d => {
        const r = ctx.state.routines.find(x => x.id === ctx.state.schedule[d]);
        return `<button class="list-item" data-day="${d}">
          <span class="lead" style="font-weight:800;color:${d === todayDow ? 'var(--accent-text)' : 'inherit'}">${DAY_NAMES[d]}</span>
          <span class="grow">
            <span class="t" style="${r ? '' : 'color:var(--text-faint)'}">${esc(r ? r.name : '休養日')}</span>
            ${r ? `<span class="s">${r.items.length}種目 ・ ${r.items.reduce((s, i) => s + i.sets, 0)}セット</span>` : ''}
          </span>
          <span class="trail">${d === todayDow ? '<span class="chip mint">今日</span>' : ''}›</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderCalendar(ctx) {
  const month = calMonth || ctx.today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = first.getDay();
  const days = new Date(y, m, 0).getDate();
  const byDate = {};
  for (const s of ctx.state.sessions) (byDate[s.date] = byDate[s.date] || []).push(s);

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push('<span class="day out"></span>');
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const done = byDate[date];
    const dow = new Date(y, m - 1, d).getDay();
    const planned = !!ctx.state.schedule[dow];
    cells.push(`<button class="day ${date === ctx.today ? 'today' : ''} ${planned && !done ? 'planned' : ''}" data-date="${date}">
      ${d}${done ? '<span class="dot"></span>' : ''}
    </button>`);
  }

  const count = Object.keys(byDate).filter(d => d.startsWith(month)).length;
  return `<div class="card">
    <div class="card-head">
      <button class="icon-btn" data-cal="-1">‹</button>
      <h2 class="center grow">${y}年${m}月<span class="tiny faint" style="font-weight:500"> ・ ${count}回</span></h2>
      <button class="icon-btn" data-cal="1">›</button>
    </div>
    <div class="cal">
      ${DAY_NAMES.map(d => `<span class="dow">${d}</span>`).join('')}
      ${cells.join('')}
    </div>
  </div>`;
}

function renderRoutines(ctx) {
  if (!ctx.state.routines.length) {
    return `<div class="card">${empty('📋', 'メニューがありません', 'テンプレートから選ぶか、自分で作成しましょう。')}</div>`;
  }
  return `<div class="section-title">メニュー一覧</div>
    ${ctx.state.routines.map(r => {
      const muscles = {};
      for (const it of r.items) {
        const ex = ctx.exerciseById(it.exId);
        if (ex) muscles[ex.muscle] = (muscles[ex.muscle] || 0) + it.sets;
      }
      const top = Object.entries(muscles).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const days = ctx.state.schedule.map((id, i) => id === r.id ? DAY_NAMES[i] : null).filter(Boolean);
      return `<button class="card prog-card" data-routine="${r.id}">
        <div class="pl"><h3>${esc(r.name)}</h3>${days.length ? `<span class="chip">${days.join('・')}</span>` : ''}</div>
        <p>${r.items.length}種目 ・ ${r.items.reduce((s, i) => s + i.sets, 0)}セット</p>
        <div class="chips" style="margin-top:6px">${top.map(([mm, n]) => `<span class="chip">${esc(MUSCLE_BY_ID[mm]?.name || mm)} ${n}</span>`).join('')}</div>
      </button>`;
    }).join('')}`;
}

// ---- イベント -----------------------------------------------------------

export function bind(root, ctx) {
  root.addEventListener('click', e => {
    const cal = e.target.closest('[data-cal]');
    if (cal) {
      const base = calMonth || ctx.today.slice(0, 7);
      const [y, m] = base.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(cal.dataset.cal), 1);
      calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ctx.refresh();
      return;
    }
    const day = e.target.closest('[data-day]');
    if (day) { openDayAssign(ctx, Number(day.dataset.day)); return; }

    const date = e.target.closest('[data-date]');
    if (date) { openDate(ctx, date.dataset.date); return; }

    const r = e.target.closest('[data-routine]');
    if (r) { openRoutineEditor(ctx, r.dataset.routine); return; }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'templates') openTemplates(ctx);
    else if (act === 'newRoutine') {
      let id;
      ctx.update(s => { const nr = blankRoutine(); id = nr.id; s.routines.push(nr); });
      openRoutineEditor(ctx, id);
    }
  });
}

function openDayAssign(ctx, dow) {
  const cur = ctx.state.schedule[dow];
  openSheet({
    title: `${DAY_NAMES[dow]}曜日の予定`,
    body: `<div class="list">
      <button class="list-item" data-set=""><span class="lead">😴</span>
        <span class="grow"><span class="t">休養日</span></span><span class="trail">${!cur ? '✓' : ''}</span></button>
      ${ctx.state.routines.map(r => `<button class="list-item" data-set="${r.id}">
        <span class="lead">📋</span>
        <span class="grow"><span class="t">${esc(r.name)}</span><span class="s">${r.items.length}種目</span></span>
        <span class="trail">${cur === r.id ? '✓' : ''}</span></button>`).join('')}
    </div>`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-set]');
        if (!b) return;
        const v = b.dataset.set || null;
        ctx.update(s => { s.schedule[dow] = v; });
        close();
        ctx.refresh();
      });
    }
  });
}

function openDate(ctx, date) {
  const sessions = ctx.state.sessions.filter(s => s.date === date);
  const dow = new Date(date + 'T12:00:00').getDay();
  const planned = ctx.state.routines.find(r => r.id === ctx.state.schedule[dow]);
  const body = sessions.length
    ? `<div class="list">${sessions.map(s => `<button class="list-item" data-open="${s.id}">
        <span class="lead">🏋️</span>
        <span class="grow"><span class="t">${esc(s.name)}</span>
        <span class="s">${(s.entries || []).length}種目 ・ ${(s.entries || []).reduce((n, e) => n + e.sets.length, 0)}セット${s.sessionRpe ? ` ・ RPE${s.sessionRpe}` : ''}</span></span>
        <span class="trail">›</span></button>`).join('')}</div>`
    : `<p class="small muted">この日の記録はありません。</p>
       ${planned ? `<div class="note"><span class="ic">🗓️</span><span>予定：${esc(planned.name)}</span></div>` : '<div class="note"><span class="ic">😴</span><span>休養日の設定です。</span></div>'}`;

  openSheet({
    title: fmtDate(date), body,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const id = e.target.closest('[data-open]')?.dataset.open;
        if (id) { close(); openPastSession(ctx, id); }
      });
    }
  });
}

function openTemplates(ctx) {
  openSheet({
    title: '分割法テンプレート', size: 'full',
    body: `<p class="small muted">選ぶと今のメニューと週間スケジュールが置き換わります（トレーニング記録はそのまま残ります）。</p>
      ${PROGRAM_TEMPLATES.map(t => {
        const sets = estimateWeeklySets(t, ctx.exerciseById);
        const top = Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return `<button class="card prog-card ${ctx.state.programId === t.id ? 'accent' : ''}" data-tpl="${t.id}">
          <div class="pl"><h3>${esc(t.name)}</h3><span class="chip">${esc(t.level)}</span><span class="chip">週${t.days}日</span></div>
          <p>${esc(t.desc)}</p>
          <div class="chips" style="margin-top:7px">${top.map(([m, n]) => `<span class="chip">${esc(MUSCLE_BY_ID[m]?.name || m)} ${num(n, 1)}</span>`).join('')}</div>
        </button>`;
      }).join('')}`,
    onMount(root, close) {
      root.addEventListener('click', async e => {
        const id = e.target.closest('[data-tpl]')?.dataset.tpl;
        if (!id) return;
        const t = templateById(id);
        const ok = await confirmSheet(`「${esc(t.name)}」に切り替えます。今のメニューと曜日の割り当ては置き換わります。`, { okLabel: '切り替える' });
        if (!ok) return;
        ctx.update(s => applyProgram(s, t));
        close();
        toast(`${t.name} に切り替えました`, 'good');
        ctx.refresh();
      });
    }
  });
}

// ---- ルーティン編集 ------------------------------------------------------

export function openRoutineEditor(ctx, routineId) {
  const build = () => {
    const r = ctx.state.routines.find(x => x.id === routineId);
    if (!r) return '<p>見つかりません</p>';
    const days = ctx.state.schedule.map((id, i) => id === routineId ? i : null).filter(v => v !== null);
    return `
      <div class="field"><label>メニュー名</label>
        <input class="input" id="rName" value="${esc(r.name)}"></div>

      <div class="field"><span class="field-label">実施する曜日</span>
        <div class="opt-grid" id="rDays">
          ${DAY_NAMES.map((d, i) => `<button class="opt ${days.includes(i) ? 'on' : ''}" data-day="${i}">${d}</button>`).join('')}
        </div></div>

      <div class="section-title">種目（${r.items.length}）</div>
      ${r.items.length ? r.items.map((it, i) => {
        const ex = ctx.exerciseById(it.exId);
        return `<div class="card" data-item="${i}">
          <div class="row between" style="margin-bottom:8px">
            <button class="grow" style="background:none;border:0;text-align:left;color:inherit;padding:0" data-detail="${esc(it.exId)}">
              <div style="font-weight:700">${esc(ex?.name || it.exId)}</div>
              <div class="tiny faint">${esc(MUSCLE_BY_ID[ex?.muscle]?.name || '')}</div>
            </button>
            <button class="icon-btn" data-mv="up" data-i="${i}" aria-label="上へ">↑</button>
            <button class="icon-btn" data-mv="down" data-i="${i}" aria-label="下へ">↓</button>
            <button class="icon-btn" data-mv="del" data-i="${i}" aria-label="削除">✕</button>
          </div>
          <div class="row" style="gap:7px">
            <label class="grow"><span class="field-label">セット</span>
              <input class="input center" type="number" min="1" max="12" value="${it.sets}" data-f="sets" data-i="${i}"></label>
            <label class="grow"><span class="field-label">回数（下限）</span>
              <input class="input center" type="number" min="1" max="60" value="${it.repLow}" data-f="repLow" data-i="${i}"></label>
            <label class="grow"><span class="field-label">回数（上限）</span>
              <input class="input center" type="number" min="1" max="60" value="${it.repHigh}" data-f="repHigh" data-i="${i}"></label>
            <label style="width:72px"><span class="field-label">RIR</span>
              <input class="input center" type="number" min="0" max="5" value="${it.rir}" data-f="rir" data-i="${i}"></label>
          </div>
        </div>`;
      }).join('') : '<p class="small faint">まだ種目がありません。</p>'}

      <button class="btn block" data-act="addItem" style="margin-top:8px">＋ 種目を追加</button>
      <button class="btn ghost block" data-act="delRoutine" style="margin-top:8px;color:var(--danger)">このメニューを削除</button>`;
  };

  openSheet({
    title: 'メニューを編集', size: 'full', body: build(),
    actions: '<button class="btn primary" data-act="close">完了</button>',
    onMount(root, close) {
      const rerender = () => { root.querySelector('.sheet-body').innerHTML = build(); };

      const saveName = () => {
        const el = root.querySelector('#rName');
        if (!el) return;
        ctx.update(s => {
          const r = s.routines.find(x => x.id === routineId);
          if (r) r.name = el.value.trim() || r.name;
        }, { silent: true });
      };

      root.addEventListener('change', e => {
        const f = e.target.dataset?.f;
        if (f) {
          const i = Number(e.target.dataset.i);
          const v = Number(e.target.value);
          ctx.update(s => {
            const it = s.routines.find(x => x.id === routineId)?.items[i];
            if (it && isFinite(v)) it[f] = v;
          }, { silent: true });
        } else if (e.target.id === 'rName') saveName();
      });

      root.addEventListener('click', async e => {
        const day = e.target.closest('[data-day]');
        if (day) {
          const d = Number(day.dataset.day);
          ctx.update(s => { s.schedule[d] = s.schedule[d] === routineId ? null : routineId; });
          rerender();
          return;
        }
        const detail = e.target.closest('[data-detail]');
        if (detail) { openExerciseDetail(ctx, detail.dataset.detail); return; }

        const mv = e.target.closest('[data-mv]');
        if (mv) {
          const i = Number(mv.dataset.i);
          ctx.update(s => {
            const items = s.routines.find(x => x.id === routineId).items;
            if (mv.dataset.mv === 'del') items.splice(i, 1);
            else if (mv.dataset.mv === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
            else if (mv.dataset.mv === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
          });
          rerender();
          return;
        }

        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'addItem') {
          saveName();
          const exclude = new Set(ctx.state.routines.find(x => x.id === routineId).items.map(i => i.exId));
          openPicker(ctx, {
            title: '種目を追加', exclude,
            onPick(id) {
              const goal = GOAL_BY_ID[ctx.state.profile.goal];
              ctx.update(s => {
                s.routines.find(x => x.id === routineId).items.push({
                  exId: id, sets: 3,
                  repLow: goal?.reps[0] ?? 8, repHigh: goal?.reps[1] ?? 12, rir: goal?.rir ?? 2
                });
              });
              rerender();
              ctx.refresh();
            }
          });
        } else if (act === 'delRoutine') {
          const ok = await confirmSheet('このメニューを削除します。過去の記録は残ります。', { okLabel: '削除する', danger: true });
          if (!ok) return;
          ctx.update(s => {
            s.routines = s.routines.filter(x => x.id !== routineId);
            s.schedule = s.schedule.map(id => id === routineId ? null : id);
          });
          close();
          ctx.refresh();
        } else if (act === 'close') {
          saveName();
          close();
          ctx.refresh();
        }
      });
    }
  });
}

