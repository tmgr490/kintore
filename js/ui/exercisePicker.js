// 種目を選ぶ／差し替えるシート。ライブラリ画面からも使う。

import { esc, openSheet, empty, toast, relDate } from './dom.js';
import { MUSCLE_GROUPS, MUSCLE_BY_ID, EQUIPMENT, PATTERNS } from '../data/muscles.js';
import { alternativesFor } from '../engine/planner.js';
import { historyFor, workSets, bestFor } from '../engine/history.js';
import { fmtWeight } from '../engine/plates.js';
import { e1rm } from '../engine/onerm.js';

function exRow(ex, extra = '') {
  const m = MUSCLE_BY_ID[ex.muscle];
  return `<button class="list-item" data-pick="${esc(ex.id)}">
    <span class="grow">
      <span class="t">${esc(ex.name)}</span>
      <span class="s">${esc(m?.name || '')} ・ ${esc(EQUIPMENT[ex.equip] || ex.equip)}${ex.uni ? ' ・ 片側' : ''}</span>
    </span>
    <span class="trail">${extra}›</span>
  </button>`;
}

/**
 * 種目選択シート。
 * @param {object} ctx
 * @param {{title?:string, onPick:Function, muscle?:string, exclude?:Set}} opts
 */
export function openPicker(ctx, { title = '種目を選ぶ', onPick, muscle = null, exclude = new Set() }) {
  let group = muscle ? (MUSCLE_GROUPS.find(g => g.members.includes(muscle))?.id || 'all') : 'all';
  let query = '';

  const list = () => {
    const all = ctx.allExercises().filter(e => !exclude.has(e.id) && !ctx.state.exerciseMeta?.[e.id]?.hidden);
    const q = query.trim().toLowerCase();
    return all.filter(e => {
      if (group !== 'all') {
        const g = MUSCLE_GROUPS.find(x => x.id === group);
        if (!g || !g.members.includes(e.muscle)) return false;
      }
      if (!q) return true;
      return e.name.toLowerCase().includes(q) ||
        (MUSCLE_BY_ID[e.muscle]?.name || '').includes(q) ||
        (EQUIPMENT[e.equip] || '').includes(q);
    });
  };

  const body = () => {
    const items = list();
    return `
      <input class="input" type="search" id="exSearch" placeholder="種目名・部位で検索" value="${esc(query)}" autocomplete="off">
      <div class="chips" style="margin-top:9px">
        <button class="chip ${group === 'all' ? 'on' : ''}" data-group="all">すべて</button>
        ${MUSCLE_GROUPS.map(g => `<button class="chip ${group === g.id ? 'on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="list" style="margin-top:6px">
        ${items.length ? items.map(e => exRow(e)).join('') : empty('🔍', '見つかりません', '検索語を変えるか、自作種目を追加してください。')}
      </div>
      <button class="btn block ghost" style="margin-top:10px" data-act="newEx">＋ 自作の種目を追加</button>`;
  };

  openSheet({
    title, size: 'full', body: body(),
    onMount(root, close) {
      const rerender = () => {
        root.querySelector('.sheet-body').innerHTML = body();
        const s = root.querySelector('#exSearch');
        if (s && query) { s.focus(); s.setSelectionRange(query.length, query.length); }
      };
      root.addEventListener('input', e => {
        if (e.target.id === 'exSearch') { query = e.target.value; rerender(); }
      });
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-group]');
        if (g) { group = g.dataset.group; rerender(); return; }
        const p = e.target.closest('[data-pick]');
        if (p) { close(); onPick(p.dataset.pick); return; }
        if (e.target.closest('[data-act="newEx"]')) {
          close();
          openCustomExercise(ctx, id => onPick(id));
        }
      });
    }
  });
}

/** 同じ動作・同じ部位の代替種目を出す */
export function openSwap(ctx, exId, onPick) {
  const ex = ctx.exerciseById(exId);
  if (!ex) return;
  const alts = alternativesFor(ex, ctx.allExercises(), ctx.gym);
  const cond = ctx.state.checkins.find(c => c.date === ctx.today)?.condition;

  openSheet({
    title: `${ex.name} の代わりに`, size: 'full',
    body: `
      <p class="small muted">器具が空いていない・痛みがある・飽きた、といったときに同じ効果の種目へ差し替えられます。記録はそのまま引き継がれます。</p>
      ${cond?.soreness?.[ex.muscle] >= 2 ? `<div class="note warn"><span class="ic">⚠️</span><span>${esc(MUSCLE_BY_ID[ex.muscle]?.name)}に強い筋肉痛があります。別部位の種目に替えるか、軽めにしましょう。</span></div>` : ''}
      <div class="section-title">おすすめの代替</div>
      <div class="list">${alts.map(a => exRow(a, `<span class="chip" style="margin-right:6px">${esc(PATTERNS[a.pattern]?.name || '')}</span>`)).join('') || empty('—', '候補がありません')}</div>
      <button class="btn block ghost" style="margin-top:10px" data-act="all">すべての種目から選ぶ</button>`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const p = e.target.closest('[data-pick]');
        if (p) { close(); onPick(p.dataset.pick); return; }
        if (e.target.closest('[data-act="all"]')) {
          close();
          openPicker(ctx, { title: '種目を選ぶ', onPick, muscle: ex.muscle });
        }
      });
    }
  });
}

/** 自作種目の作成・編集 */
export function openCustomExercise(ctx, onDone, editId = null) {
  const ex = editId ? ctx.exerciseById(editId) : null;
  const muscles = Object.values(MUSCLE_BY_ID);

  openSheet({
    title: ex ? '種目を編集' : '自作の種目を追加', size: 'full',
    body: `
      <div class="field"><label>種目名</label>
        <input class="input" name="name" value="${esc(ex?.name || '')}" placeholder="例: インクラインケーブルフライ"></div>
      <div class="field"><label>主に効かせる部位</label>
        <select class="input" name="muscle">
          ${muscles.map(m => `<option value="${m.id}" ${ex?.muscle === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
        </select></div>
      <div class="field"><label>器具</label>
        <select class="input" name="equip">
          ${Object.entries(EQUIPMENT).map(([k, v]) => `<option value="${k}" ${ex?.equip === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select></div>
      <div class="field"><label>動作パターン</label>
        <select class="input" name="pattern">
          ${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${ex?.pattern === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
        </select></div>
      <div class="switch-row">
        <span class="grow"><strong>片側ずつ行う</strong><br><span class="tiny faint">左右それぞれ記録する種目</span></span>
        <label class="switch"><input type="checkbox" name="uni" ${ex?.uni ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="switch-row">
        <span class="grow"><strong>自重種目</strong><br><span class="tiny faint">入力する重量は「追加した重り」になります</span></span>
        <label class="switch"><input type="checkbox" name="bw" ${ex?.bw ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="switch-row">
        <span class="grow"><strong>時間で記録する</strong><br><span class="tiny faint">プランクなど、回数ではなく秒数</span></span>
        <label class="switch"><input type="checkbox" name="time" ${ex?.time ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="field" style="margin-top:12px"><label>メモ（フォームの注意点など）</label>
        <textarea class="input" name="tips" placeholder="1行に1つ">${esc((ex?.tips || []).join('\n'))}</textarea></div>`,
    actions: `<button class="btn ghost" data-act="cancel">キャンセル</button><button class="btn primary" data-act="save">${ex ? '保存' : '追加'}</button>`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (a === 'cancel') return close();
        if (a !== 'save') return;
        const g = n => root.querySelector(`[name="${n}"]`);
        const name = g('name').value.trim();
        if (!name) { toast('種目名を入力してください', 'warn'); return; }
        const data = {
          name,
          muscle: g('muscle').value,
          sub: ex?.sub || [],
          equip: g('equip').value,
          pattern: g('pattern').value,
          uni: g('uni').checked,
          bw: g('bw').checked,
          time: g('time').checked,
          assist: false,
          bar: 0,
          alts: ex?.alts || [],
          tips: g('tips').value.split('\n').map(s => s.trim()).filter(Boolean),
          custom: true
        };
        let id = editId;
        ctx.update(s => {
          if (editId) {
            const i = s.customExercises.findIndex(x => x.id === editId);
            if (i >= 0) s.customExercises[i] = { ...s.customExercises[i], ...data };
          } else {
            id = 'custom_' + Math.random().toString(36).slice(2, 9);
            s.customExercises.push({ id, ...data });
          }
        });
        import('../store.js').then(m => m.invalidateExerciseIndex());
        close();
        toast(editId ? '保存しました' : '種目を追加しました', 'good');
        onDone?.(id);
        ctx.refresh();
      });
    }
  });
}

/** 種目の詳細（フォーム・履歴・ベスト） */
export function openExerciseDetail(ctx, exId) {
  const ex = ctx.exerciseById(exId);
  if (!ex) return;
  const units = ctx.state.settings.units;
  const hist = historyFor(ctx.state, exId, 12);
  const best = bestFor(ctx.state, exId, ctx.state.profile.weight);
  const meta = ctx.state.exerciseMeta?.[exId] || {};
  const alts = alternativesFor(ex, ctx.allExercises(), ctx.gym).slice(0, 6);

  openSheet({
    title: ex.name, size: 'full',
    body: `
      <div class="chips">
        <span class="chip">${esc(MUSCLE_BY_ID[ex.muscle]?.name || '')}</span>
        <span class="chip">${esc(EQUIPMENT[ex.equip] || ex.equip)}</span>
        <span class="chip">${esc(PATTERNS[ex.pattern]?.name || '')}</span>
        ${(ex.sub || []).map(m => `<span class="chip">補助: ${esc(MUSCLE_BY_ID[m]?.name || m)}</span>`).join('')}
      </div>

      ${best.best1rm > 0 ? `<div class="stat-grid" style="margin-top:12px">
        <div class="stat"><div class="v">${fmtWeight(best.best1rm, units)}</div><div class="k">推定1RM</div></div>
        <div class="stat"><div class="v">${fmtWeight(best.bestWeight, units)}</div><div class="k">最高重量</div></div>
        <div class="stat"><div class="v">${best.bestReps}</div><div class="k">最高回数</div></div>
      </div>` : ''}

      ${ex.tips?.length ? `<div class="section-title">フォームのポイント</div>
        ${ex.tips.map(t => `<div class="note"><span class="ic">✓</span><span>${esc(t)}</span></div>`).join('')}` : ''}

      <div class="section-title">自分用メモ</div>
      <textarea class="input" id="exNote" placeholder="シート位置、グリップ幅、痛みが出る角度など">${esc(meta.note || '')}</textarea>
      <button class="btn sm block" style="margin-top:7px" data-act="saveNote">メモを保存</button>

      ${alts.length ? `<div class="section-title">似た種目</div>
        <div class="chips">${alts.map(a => `<span class="chip">${esc(a.name)}</span>`).join('')}</div>` : ''}

      <div class="section-title">履歴</div>
      ${hist.length ? `<div class="list">${hist.map(h => {
        const sets = workSets(h.entry);
        const top = sets.reduce((m, s) => Math.max(m, e1rm(s.w, s.reps, s.rir ?? 0)), 0);
        return `<div class="list-item">
          <span class="grow">
            <span class="t">${relDate(h.session.date, ctx.today)}</span>
            <span class="s">${sets.map(s => ex.time ? `${s.reps}秒` : `${fmtWeight(s.w, units)}×${s.reps}`).join(' / ')}</span>
          </span>
          <span class="trail">${top ? fmtWeight(top, units) : ''}</span>
        </div>`;
      }).join('')}</div>` : '<p class="small faint">まだ記録がありません。</p>'}

      ${ex.custom ? '<button class="btn block ghost" style="margin-top:14px" data-act="edit">この種目を編集</button>' : ''}`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (a === 'saveNote') {
          const note = root.querySelector('#exNote').value;
          ctx.update(s => {
            s.exerciseMeta[exId] = { ...(s.exerciseMeta[exId] || {}), note };
          });
          toast('メモを保存しました', 'good');
        } else if (a === 'edit') {
          close();
          openCustomExercise(ctx, null, exId);
        }
      });
    }
  });
}
