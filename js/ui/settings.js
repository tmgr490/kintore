// 設定：プロフィール、器具プロファイル、種目ライブラリ、理論ガイド、データ管理。

import { esc, toast, openSheet, confirmSheet, stepper, empty, segmented } from './dom.js';
import { GOALS, GOAL_BY_ID, RM_TABLE, RIR_TABLE, PRINCIPLES, VOLUME_CONCEPTS, STRETCHES } from '../data/guide.js';
import { MUSCLES, MUSCLE_BY_ID, MUSCLE_GROUPS, EQUIPMENT } from '../data/muscles.js';
import { HOME_GYM, uid, exportJSON, importJSON, resetAll, invalidateExerciseIndex, hasLegacyData, importLegacyData, discardLegacyData } from '../store.js';
import { dumbbellRack, invalidatePlateCache, fmtWeight } from '../engine/plates.js';
import { openCustomExercise, openExerciseDetail } from './exercisePicker.js';
import { e1rm, weightForReps } from '../engine/onerm.js';

export const title = '設定';
export const subtitle = ctx => esc(ctx.gym?.name || '');

export function render(ctx) {
  const { state } = ctx;
  const goal = GOAL_BY_ID[state.profile.goal];
  const p = state.profile;

  return `
    <div class="card flush"><div class="list">
      <button class="list-item" data-act="profile">
        <span class="lead">👤</span>
        <span class="grow"><span class="t">プロフィール</span>
        <span class="s">${p.height}cm / ${p.weight}kg / ${expLabel(p.experience)}</span></span>
        <span class="trail">›</span></button>
      <button class="list-item" data-act="goal">
        <span class="lead">${goal?.icon || '🎯'}</span>
        <span class="grow"><span class="t">トレーニングの目的</span><span class="s">${esc(goal?.name || '')}</span></span>
        <span class="trail">›</span></button>
      <button class="list-item" data-act="pain">
        <span class="lead">🩹</span>
        <span class="grow"><span class="t">避けたい部位・痛み</span>
        <span class="s">${p.painAreas?.length ? p.painAreas.map(m => MUSCLE_BY_ID[m]?.name).join('・') : '設定なし'}</span></span>
        <span class="trail">›</span></button>
    </div></div>

    <div class="section-title">器具</div>
    <div class="card flush"><div class="list">
      ${state.gyms.map(g => `<button class="list-item" data-gym="${g.id}">
        <span class="lead">${g.id === state.settings.activeGymId ? '📍' : '🏢'}</span>
        <span class="grow"><span class="t">${esc(g.name)}</span>
        <span class="s">バー${g.barWeight}kg ・ ダンベル${g.dumbbell.min}〜${g.dumbbell.max}kg(${g.dumbbell.step}刻み)</span></span>
        <span class="trail">${g.id === state.settings.activeGymId ? '<span class="chip mint">使用中</span>' : ''}›</span>
      </button>`).join('')}
      <button class="list-item" data-act="addGym">
        <span class="lead">✚</span><span class="grow"><span class="t">場所を追加</span>
        <span class="s">自宅とジムで器具が違う場合に</span></span><span class="trail">›</span></button>
    </div></div>

    <div class="section-title">トレーニング中の挙動</div>
    <div class="card">
      <div class="switch-row">
        <span class="grow"><strong>レストタイマーを自動起動</strong><br><span class="tiny faint">セット完了と同時に休憩を測り始める</span></span>
        <label class="switch"><input type="checkbox" data-set="autoTimer" ${state.settings.autoTimer !== false ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="switch-row">
        <span class="grow"><strong>終了時に音を鳴らす</strong></span>
        <label class="switch"><input type="checkbox" data-set="restSound" ${state.settings.restSound !== false ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="switch-row">
        <span class="grow"><strong>終了時に振動</strong></span>
        <label class="switch"><input type="checkbox" data-set="restVibrate" ${state.settings.restVibrate !== false ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
      <div class="switch-row">
        <span class="grow"><strong>ウォームアップセットを自動で入れる</strong><br><span class="tiny faint">メイン重量から逆算して段階的に</span></span>
        <label class="switch"><input type="checkbox" data-set="showWarmup" ${state.settings.showWarmup !== false ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
      </div>
    </div>

    <div class="section-title">表示</div>
    <div class="card">
      <div class="field"><span class="field-label">テーマ</span>
        ${segmented('theme', [{ value: 'auto', label: '自動' }, { value: 'dark', label: 'ダーク' }, { value: 'light', label: 'ライト' }], state.settings.theme || 'auto')}</div>
      <div class="field" style="margin-bottom:0"><span class="field-label">単位</span>
        ${segmented('units', [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'ポンド(lb)' }], state.settings.units || 'kg')}</div>
    </div>

    <div class="section-title">参照</div>
    <div class="card flush"><div class="list">
      <button class="list-item" data-act="library">
        <span class="lead">📚</span><span class="grow"><span class="t">種目ライブラリ</span>
        <span class="s">${ctx.allExercises().length}種目 ・ 自作${state.customExercises.length}件</span></span><span class="trail">›</span></button>
      <button class="list-item" data-act="guide">
        <span class="lead">📖</span><span class="grow"><span class="t">トレーニング理論ガイド</span>
        <span class="s">%1RM早見表、RIR、MEV/MAV/MRV</span></span><span class="trail">›</span></button>
      <button class="list-item" data-act="calc">
        <span class="lead">🧮</span><span class="grow"><span class="t">1RM計算機</span>
        <span class="s">重量と回数から最大挙上重量を推定</span></span><span class="trail">›</span></button>
      <button class="list-item" data-act="stretch">
        <span class="lead">🧘</span><span class="grow"><span class="t">部位別ストレッチ</span></span><span class="trail">›</span></button>
    </div></div>

    <div class="section-title">データ</div>
    <div class="card flush"><div class="list">
      <button class="list-item" data-act="export">
        <span class="lead">⬇️</span><span class="grow"><span class="t">バックアップを書き出す</span>
        <span class="s">JSONファイルとして保存</span></span><span class="trail">›</span></button>
      <button class="list-item" data-act="import">
        <span class="lead">⬆️</span><span class="grow"><span class="t">バックアップを読み込む</span>
        <span class="s">現在のデータは置き換わります</span></span><span class="trail">›</span></button>
      ${hasLegacyData() ? `<button class="list-item" data-act="legacy">
        <span class="lead">🗃️</span><span class="grow"><span class="t">旧アプリの記録を取り込む</span>
        <span class="s">この端末に残っている過去のデータ</span></span><span class="trail">›</span></button>` : ''}
      <button class="list-item" data-act="reset">
        <span class="lead">🗑️</span><span class="grow"><span class="t" style="color:var(--danger)">すべてのデータを削除</span></span><span class="trail">›</span></button>
    </div></div>

    <div class="card">
      <p class="tiny faint" style="margin:0">記録はこの端末のブラウザ内（localStorage）にのみ保存されます。サーバーには一切送信されません。
      ブラウザのデータを消すと記録も消えるので、ときどきバックアップを書き出してください。</p>
      <p class="tiny faint" style="margin:8px 0 0">ホーム画面に追加するとアプリのように全画面で使え、オフラインでも動きます。</p>
    </div>
    <input type="file" id="importFile" accept="application/json,.json" style="display:none">
  `;
}

const expLabel = e => ({ beginner: '1年未満', intermediate: '1〜3年', advanced: '3年以上' }[e] || '');

// ---- イベント -----------------------------------------------------------

export function bind(root, ctx) {
  root.addEventListener('change', e => {
    const key = e.target.dataset?.set;
    if (key) {
      ctx.update(s => { s.settings[key] = e.target.checked; });
      return;
    }
    if (e.target.id === 'importFile' && e.target.files?.[0]) {
      const file = e.target.files[0];
      file.text().then(async text => {
        const ok = await confirmSheet('現在のデータをこのファイルの内容で置き換えます。よろしいですか？', { okLabel: '読み込む', danger: true });
        if (!ok) return;
        try {
          importJSON(text);
          toast('読み込みました', 'good');
          ctx.refresh();
        } catch (err) {
          toast('ファイルを読み込めませんでした: ' + esc(err.message), 'danger', 5000);
        }
      });
      e.target.value = '';
    }
  });

  root.addEventListener('click', async e => {
    const theme = e.target.closest('[data-theme]');
    if (theme) { ctx.update(s => { s.settings.theme = theme.dataset.theme; }); ctx.refresh(); return; }
    const units = e.target.closest('[data-units]');
    if (units) { ctx.update(s => { s.settings.units = units.dataset.units; }); ctx.refresh(); return; }
    const gym = e.target.closest('[data-gym]');
    if (gym) { openGym(ctx, gym.dataset.gym); return; }

    const act = e.target.closest('[data-act]')?.dataset.act;
    switch (act) {
      case 'profile': openProfile(ctx); break;
      case 'goal': openGoal(ctx); break;
      case 'pain': openPain(ctx); break;
      case 'addGym': {
        const id = uid();
        ctx.update(s => { s.gyms.push({ ...HOME_GYM(), id, name: '新しい場所' }); });
        openGym(ctx, id);
        break;
      }
      case 'library': openLibrary(ctx); break;
      case 'guide': openGuide(ctx); break;
      case 'calc': openCalculator(ctx); break;
      case 'stretch': openStretch(ctx); break;
      case 'export': doExport(ctx); break;
      case 'import': root.querySelector('#importFile').click(); break;
      case 'legacy': {
        const ok = await confirmSheet('旧アプリの記録を新しい形式に取り込みます。', { okLabel: '取り込む' });
        if (!ok) break;
        const res = importLegacyData();
        if (res.error) toast('取り込みに失敗しました', 'danger');
        else { discardLegacyData(); toast(`${res.imported}日分を取り込みました`, 'good'); }
        ctx.refresh();
        break;
      }
      case 'reset': {
        const ok = await confirmSheet('すべての記録・メニュー・設定を削除して初期状態に戻します。この操作は取り消せません。先にバックアップを書き出すことをおすすめします。',
          { okLabel: 'すべて削除', danger: true });
        if (!ok) break;
        const ok2 = await confirmSheet('本当によろしいですか？', { okLabel: '削除する', danger: true, title: '最終確認' });
        if (!ok2) break;
        resetAll();
        invalidateExerciseIndex();
        location.hash = '';
        location.reload();
        break;
      }
    }
  });
}

function doExport(ctx) {
  try {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kintore-backup-${ctx.today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('バックアップを書き出しました', 'good');
  } catch (err) {
    toast('書き出しに失敗しました', 'danger');
    console.error(err);
  }
}

// ---- プロフィール --------------------------------------------------------

function openProfile(ctx) {
  const p = ctx.state.profile;
  openSheet({
    title: 'プロフィール', size: 'full',
    body: `
      <div class="field"><label>名前（任意）</label><input class="input" name="name" value="${esc(p.name || '')}"></div>
      <div class="field"><span class="field-label">性別</span>
        <div class="opt-grid" data-opt="sex">
          ${[['male', '男性'], ['female', '女性'], ['other', '回答しない']].map(([v, l]) =>
            `<button class="opt ${p.sex === v ? 'on' : ''}" data-val="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="field-row">
        <div class="field"><span class="field-label">身長</span>${stepper({ name: 'height', value: p.height, step: 1, min: 120, max: 230, suffix: 'cm' })}</div>
        <div class="field"><span class="field-label">体重</span>${stepper({ name: 'weight', value: p.weight, step: 0.5, min: 30, max: 220, suffix: 'kg' })}</div>
      </div>
      <div class="field"><span class="field-label">年齢</span>${stepper({ name: 'age', value: p.age, step: 1, min: 12, max: 99, suffix: '歳' })}</div>
      <div class="field"><span class="field-label">筋トレ歴</span>
        <div class="opt-grid" data-opt="experience">
          ${[['beginner', '1年未満'], ['intermediate', '1〜3年'], ['advanced', '3年以上']].map(([v, l]) =>
            `<button class="opt ${p.experience === v ? 'on' : ''}" data-val="${v}">${l}</button>`).join('')}
        </div></div>
      <p class="tiny faint">体重は自重種目のボリューム計算と、履歴のない種目の初回重量の推定に使われます。</p>`,
    actions: '<button class="btn primary" data-act="save">保存</button>',
    onMount(root, close) {
      let draft = { ...p };
      root.addEventListener('click', e => {
        const o = e.target.closest('[data-opt] [data-val]');
        if (o) {
          const key = o.closest('[data-opt]').dataset.opt;
          draft[key] = o.dataset.val;
          [...o.parentElement.children].forEach(b => b.classList.toggle('on', b === o));
          return;
        }
        if (!e.target.closest('[data-act="save"]')) return;
        const g = n => root.querySelector(`[name="${n}"]`)?.value;
        ctx.update(s => {
          Object.assign(s.profile, {
            name: g('name') ?? '',
            sex: draft.sex, experience: draft.experience,
            height: Number(g('height')) || s.profile.height,
            weight: Number(g('weight')) || s.profile.weight,
            age: Number(g('age')) || s.profile.age
          });
        });
        close();
        toast('保存しました', 'good');
        ctx.refresh();
      });
    }
  });
}

function openGoal(ctx) {
  openSheet({
    title: 'トレーニングの目的', size: 'full',
    body: `<p class="small muted">新しく追加する種目のレップ域・休憩時間・目標RIRの初期値が変わります。既存のメニューは変わりません。</p>
      ${GOALS.map(g => `<button class="card prog-card ${ctx.state.profile.goal === g.id ? 'accent' : ''}" data-goal="${g.id}">
        <div class="pl"><span style="font-size:20px">${g.icon}</span><h3>${esc(g.name)}</h3></div>
        <p>${esc(g.desc)}</p>
        <p class="tiny faint" style="margin-top:6px">${esc(g.intensity)} / ${g.reps[0]}〜${g.reps[1]}回 / 休憩${g.rest[0]}〜${g.rest[1]}秒 / RIR${g.rir}</p>
      </button>`).join('')}`,
    onMount(root, close) {
      root.addEventListener('click', e => {
        const id = e.target.closest('[data-goal]')?.dataset.goal;
        if (!id) return;
        ctx.update(s => { s.profile.goal = id; });
        close();
        toast('目的を変更しました', 'good');
        ctx.refresh();
      });
    }
  });
}

function openPain(ctx) {
  openSheet({
    title: '避けたい部位', size: 'full',
    body: `<p class="small muted">痛みや故障がある部位を選ぶと、その部位を使う種目に注意マークが付き、代替種目を提案します。</p>
      <div class="opt-grid" style="margin-top:12px" id="painGrid">
        ${MUSCLES.map(m => `<button class="opt ${ctx.state.profile.painAreas?.includes(m.id) ? 'on' : ''}" data-m="${m.id}">${esc(m.name)}</button>`).join('')}
      </div>
      <div class="note warn" style="margin-top:14px"><span class="ic">⚠️</span><span>痛みが2週間以上続く、しびれがある、夜間も痛むといった場合は医療機関に相談してください。このアプリは医療的な助言をするものではありません。</span></div>`,
    actions: '<button class="btn primary" data-act="save">保存</button>',
    onMount(root, close) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (b) { b.classList.toggle('on'); return; }
        if (!e.target.closest('[data-act="save"]')) return;
        const list = [...root.querySelectorAll('#painGrid .opt.on')].map(b => b.dataset.m);
        ctx.update(s => { s.profile.painAreas = list; });
        close();
        toast('保存しました', 'good');
        ctx.refresh();
      });
    }
  });
}

// ---- 器具プロファイル ----------------------------------------------------

const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

function openGym(ctx, gymId) {
  const build = () => {
    const g = ctx.state.gyms.find(x => x.id === gymId);
    if (!g) return '';
    const rack = dumbbellRack(g);
    return `
      <div class="field"><label>場所の名前</label><input class="input" id="gName" value="${esc(g.name)}"></div>

      <div class="section-title">バー</div>
      <div class="field-row">
        <div class="field"><span class="field-label">バーベル</span>${stepper({ name: 'barWeight', value: g.barWeight, step: 2.5, min: 5, max: 30, suffix: 'kg' })}</div>
        <div class="field"><span class="field-label">EZバー</span>${stepper({ name: 'ezBarWeight', value: g.ezBarWeight, step: 0.5, min: 2, max: 20, suffix: 'kg' })}</div>
      </div>

      <div class="section-title">プレート（左右合わせた枚数）</div>
      <p class="tiny faint" style="margin-bottom:8px">持っている枚数を入れると、提案される重量が「実際に組める重量」に丸められます。</p>
      ${PLATE_SIZES.map(w => {
        const p = g.plates.find(x => Number(x.w) === w);
        return `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
          <span style="font-weight:700;width:64px"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${plateColor(w)};margin-right:6px"></i>${w}kg</span>
          <div class="grow" style="max-width:190px">${stepper({ name: `plate_${w}`, value: p?.count || 0, step: 2, min: 0, max: 20, suffix: '枚' })}</div>
        </div>`;
      }).join('')}

      <div class="section-title">ダンベル</div>
      <div class="field-row">
        <div class="field"><span class="field-label">最小</span>${stepper({ name: 'dbMin', value: g.dumbbell.min, step: 0.5, min: 0.5, max: 50, suffix: 'kg' })}</div>
        <div class="field"><span class="field-label">最大</span>${stepper({ name: 'dbMax', value: g.dumbbell.max, step: 1, min: 2, max: 120, suffix: 'kg' })}</div>
        <div class="field"><span class="field-label">刻み</span>${stepper({ name: 'dbStep', value: g.dumbbell.step, step: 0.5, min: 0.5, max: 10, suffix: 'kg' })}</div>
      </div>
      <p class="tiny faint">用意されている重量: ${rack.slice(0, 16).join(' / ')}${rack.length > 16 ? ' …' : ''}</p>

      <div class="section-title">マシン・ケーブルの刻み</div>
      <div class="field-row">
        <div class="field"><span class="field-label">マシン</span>${stepper({ name: 'machineStep', value: g.machineStep, step: 0.5, min: 0.5, max: 20, suffix: 'kg' })}</div>
        <div class="field"><span class="field-label">ケーブル</span>${stepper({ name: 'cableStep', value: g.cableStep, step: 0.5, min: 0.5, max: 20, suffix: 'kg' })}</div>
      </div>

      <button class="btn block" data-act="activate" style="margin-top:14px">${g.id === ctx.state.settings.activeGymId ? '使用中' : 'ここを使用中にする'}</button>
      ${ctx.state.gyms.length > 1 ? '<button class="btn ghost block" data-act="del" style="margin-top:8px;color:var(--danger)">この場所を削除</button>' : ''}`;
  };

  const save = root => {
    const g = n => Number(root.querySelector(`[name="${n}"]`)?.value);
    const name = root.querySelector('#gName')?.value.trim();
    ctx.update(s => {
      const gym = s.gyms.find(x => x.id === gymId);
      if (!gym) return;
      if (name) gym.name = name;
      gym.barWeight = g('barWeight') || gym.barWeight;
      gym.ezBarWeight = g('ezBarWeight') || gym.ezBarWeight;
      gym.plates = PLATE_SIZES.map(w => ({ w, count: g(`plate_${w}`) || 0 })).filter(p => p.count > 0);
      gym.dumbbell = {
        min: g('dbMin') || gym.dumbbell.min,
        max: g('dbMax') || gym.dumbbell.max,
        step: g('dbStep') || gym.dumbbell.step
      };
      gym.machineStep = g('machineStep') || gym.machineStep;
      gym.cableStep = g('cableStep') || gym.cableStep;
    });
    invalidatePlateCache();
  };

  openSheet({
    title: '器具の設定', size: 'full', body: build(),
    actions: '<button class="btn primary" data-act="save">保存</button>',
    onMount(root, close) {
      root.addEventListener('click', async e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'save') { save(root); close(); toast('保存しました', 'good'); ctx.refresh(); }
        else if (act === 'activate') {
          save(root);
          ctx.update(s => { s.settings.activeGymId = gymId; });
          close(); toast('使用中の場所を変更しました', 'good'); ctx.refresh();
        } else if (act === 'del') {
          const ok = await confirmSheet('この場所の設定を削除します。', { okLabel: '削除', danger: true });
          if (!ok) return;
          ctx.update(s => {
            s.gyms = s.gyms.filter(x => x.id !== gymId);
            if (s.settings.activeGymId === gymId) s.settings.activeGymId = s.gyms[0].id;
          });
          close(); ctx.refresh();
        }
      });
    }
  });
}

const plateColor = w => ({
  25: '#d9453d', 20: '#3a6be0', 15: '#e8a417', 10: '#2f9e56',
  5: '#c8ccd4', 2.5: '#8b93a1', 1.25: '#5e6675', 0.5: '#454b57'
}[w] || '#6d7cff');

// ---- 種目ライブラリ ------------------------------------------------------

function openLibrary(ctx) {
  let group = 'all';
  let query = '';

  const build = () => {
    const q = query.trim().toLowerCase();
    const list = ctx.allExercises().filter(e => {
      if (group === 'custom') return e.custom;
      if (group !== 'all') {
        const g = MUSCLE_GROUPS.find(x => x.id === group);
        if (!g || !g.members.includes(e.muscle)) return false;
      }
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || (MUSCLE_BY_ID[e.muscle]?.name || '').includes(q);
    });
    return `
      <input class="input" type="search" id="libSearch" placeholder="種目名・部位で検索" value="${esc(query)}" autocomplete="off">
      <div class="chips" style="margin-top:9px">
        <button class="chip ${group === 'all' ? 'on' : ''}" data-g="all">すべて(${ctx.allExercises().length})</button>
        ${MUSCLE_GROUPS.map(g => `<button class="chip ${group === g.id ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}
        <button class="chip ${group === 'custom' ? 'on' : ''}" data-g="custom">自作</button>
      </div>
      <div class="list" style="margin-top:6px">
        ${list.length ? list.map(e => `<button class="list-item" data-ex="${esc(e.id)}">
          <span class="grow"><span class="t">${esc(e.name)}${e.custom ? ' <span class="chip" style="font-size:10px;padding:1px 6px">自作</span>' : ''}</span>
          <span class="s">${esc(MUSCLE_BY_ID[e.muscle]?.name || '')} ・ ${esc(EQUIPMENT[e.equip] || e.equip)}</span></span>
          <span class="trail">›</span></button>`).join('') : empty('🔍', '見つかりません')}
      </div>
      <button class="btn block ghost" style="margin-top:10px" data-act="new">＋ 自作の種目を追加</button>`;
  };

  openSheet({
    title: '種目ライブラリ', size: 'full', body: build(),
    onMount(root, close) {
      const rerender = () => {
        root.querySelector('.sheet-body').innerHTML = build();
        const s = root.querySelector('#libSearch');
        if (s && query) { s.focus(); s.setSelectionRange(query.length, query.length); }
      };
      root.addEventListener('input', e => { if (e.target.id === 'libSearch') { query = e.target.value; rerender(); } });
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-g]');
        if (g) { group = g.dataset.g; rerender(); return; }
        const ex = e.target.closest('[data-ex]');
        if (ex) { openExerciseDetail(ctx, ex.dataset.ex); return; }
        if (e.target.closest('[data-act="new"]')) openCustomExercise(ctx, () => rerender());
      });
    }
  });
}

// ---- ガイド ---------------------------------------------------------------

function openGuide(ctx) {
  openSheet({
    title: 'トレーニング理論ガイド', size: 'full',
    body: `
      <div class="section-title">原則</div>
      ${PRINCIPLES.map(p => `<div class="card"><div class="card-head"><h3>${esc(p.title)}</h3></div>
        <p class="small muted">${esc(p.body)}</p></div>`).join('')}

      <div class="section-title">目的別のパラメータ</div>
      <div class="table-wrap"><table class="g">
        <tr><th>目的</th><th>強度</th><th>回数</th><th>セット</th><th>休憩</th><th>RIR</th></tr>
        ${GOALS.map(g => `<tr>
          <td>${g.icon} ${esc(g.name)}</td><td>${esc(g.intensity)}</td>
          <td>${g.reps[0]}〜${g.reps[1]}</td><td>${g.sets[0]}〜${g.sets[1]}</td>
          <td>${g.rest[0]}〜${g.rest[1]}秒</td><td>${g.rir}</td></tr>`).join('')}
      </table></div>

      <div class="section-title">%1RM と反復回数</div>
      <div class="table-wrap"><table class="g">
        <tr><th>%1RM</th><th>反復回数の目安</th></tr>
        ${RM_TABLE.map(r => `<tr><td>${r.pct}%</td><td>${r.reps}回</td></tr>`).join('')}
      </table></div>

      <div class="section-title">RIR / RPE 早見表</div>
      <div class="table-wrap"><table class="g">
        <tr><th>RIR</th><th>RPE</th><th>感覚</th></tr>
        ${RIR_TABLE.map(r => `<tr><td>${r.rir}</td><td>${r.rpe}</td><td>${esc(r.label)}</td></tr>`).join('')}
      </table></div>
      ${RIR_TABLE.map(r => `<div class="note"><span class="ic">RIR${r.rir}</span><span>${esc(r.note)}</span></div>`).join('')}

      <div class="section-title">週あたりボリュームの指標</div>
      ${VOLUME_CONCEPTS.map(c => `<div class="note"><span class="ic">${esc(c.key)}</span><span><strong>${esc(c.name)}</strong>：${esc(c.desc)}</span></div>`).join('')}
      <div class="table-wrap"><table class="g">
        <tr><th>部位</th><th>MEV</th><th>MAV</th><th>MRV</th></tr>
        ${MUSCLES.filter(m => m.mev > 0).map(m => `<tr><td>${esc(m.name)}</td><td>${m.mev}</td><td>${m.mav}</td><td>${m.mrv}</td></tr>`).join('')}
      </table></div>
      <p class="tiny faint" style="margin-top:10px">数値は一般的な目安です。個人差が大きいので、自分の回復具合とパフォーマンスを見ながら調整してください。</p>`
  });
}

function openCalculator(ctx) {
  const units = ctx.state.settings.units;
  const calc = (w, r) => {
    const one = e1rm(w, r, 0);
    return `<div class="stat-grid" style="margin-top:12px">
        <div class="stat"><div class="v">${fmtWeight(one, units)}</div><div class="k">推定1RM</div></div>
      </div>
      <div class="table-wrap" style="margin-top:12px"><table class="g">
        <tr><th>%1RM</th><th>重量</th><th>おおよその回数</th></tr>
        ${[100, 95, 90, 85, 80, 75, 70, 65, 60].map(p => `<tr>
          <td>${p}%</td><td><strong>${fmtWeight(one * p / 100, units)}</strong></td>
          <td>${RM_TABLE.reduce((best, x) => Math.abs(x.pct - p) < Math.abs(best.pct - p) ? x : best).reps}回</td>
        </tr>`).join('')}
      </table></div>
      <div class="section-title">レップ数別の目標重量</div>
      <div class="chips">${[1, 3, 5, 8, 10, 12, 15].map(r =>
        `<span class="chip">${r}回 ${fmtWeight(weightForReps(one, r), units)}</span>`).join('')}</div>`;
  };

  openSheet({
    title: '1RM計算機', size: 'full',
    body: `<div class="field-row">
        <div class="field"><span class="field-label">挙げた重量</span>${stepper({ name: 'cw', value: 60, step: 2.5, min: 1, max: 500, suffix: 'kg' })}</div>
        <div class="field"><span class="field-label">回数</span>${stepper({ name: 'cr', value: 8, step: 1, min: 1, max: 30, suffix: '回' })}</div>
      </div>
      <div id="calcOut">${calc(60, 8)}</div>
      <p class="tiny faint" style="margin-top:12px">Epley式とBrzycki式の平均で推定しています。回数が多いほど誤差が大きくなるので、10回以下での測定が正確です。</p>`,
    onMount(root) {
      const upd = () => {
        const w = Number(root.querySelector('[name="cw"]').value) || 0;
        const r = Number(root.querySelector('[name="cr"]').value) || 1;
        root.querySelector('#calcOut').innerHTML = calc(w, r);
      };
      root.addEventListener('input', upd);
      root.addEventListener('change', upd);
    }
  });
}

function openStretch(ctx) {
  openSheet({
    title: '部位別ストレッチ', size: 'full',
    body: `<p class="small muted">トレーニング後や休養日に。反動をつけず、痛気持ちいいところで止めて呼吸を続けます。</p>
      ${MUSCLES.filter(m => STRETCHES[m.id]).map(m => `
        <div class="card">
          <div class="card-head"><h3>${esc(m.name)}</h3></div>
          ${STRETCHES[m.id].map(s => `<div class="row between small">
            <span>${esc(s.name)}</span><span class="faint nowrap">${s.sec}秒</span></div>
            ${s.note ? `<p class="tiny faint" style="margin:2px 0 0">${esc(s.note)}</p>` : ''}`).join('')}
        </div>`).join('')}`
  });
}

