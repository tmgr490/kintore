// 初回セットアップ。体格 → 目的 → プログラム → 器具 の4ステップ。

import { esc, stepper, toast } from './dom.js';
import { GOALS } from '../data/guide.js';
import { PROGRAM_TEMPLATES, DAY_NAMES } from '../data/programs.js';
import { applyProgram } from '../engine/program.js';
import { DEFAULT_GYM, HOME_GYM, hasLegacyData, importLegacyData, discardLegacyData } from '../store.js';

const STEPS = ['profile', 'goal', 'program', 'gym'];
let step = 0;
const draft = {
  profile: { sex: 'male', age: 30, height: 170, weight: 65, experience: 'beginner', goal: 'hypertrophy' },
  programId: 'fullbody3',
  gymKind: 'gym'
};

export function render(ctx) {
  const body = {
    profile: renderProfile(),
    goal: renderGoal(),
    program: renderProgram(),
    gym: renderGym()
  }[STEPS[step]];

  return `<div class="onb">
    <div class="dots">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="steps">${body}</div>
    <div class="onb-foot">
      ${step > 0 ? '<button class="btn ghost" data-nav="back">戻る</button>' : ''}
      <button class="btn primary grow" data-nav="next">${step === STEPS.length - 1 ? 'はじめる' : '次へ'}</button>
    </div>
  </div>`;
}

function renderProfile() {
  const p = draft.profile;
  return `
    <h1>ようこそ 💪</h1>
    <p class="lede">筋トレの<strong>前・最中・後</strong>をまるごと引き受けるノートです。<br>
    まず体格を教えてください。初回の重量提案に使います（あとから変更できます）。</p>

    <div class="field">
      <span class="field-label">性別</span>
      <div class="opt-grid">
        <button class="opt ${p.sex === 'male' ? 'on' : ''}" data-set="sex" data-val="male">男性</button>
        <button class="opt ${p.sex === 'female' ? 'on' : ''}" data-set="sex" data-val="female">女性</button>
        <button class="opt ${p.sex === 'other' ? 'on' : ''}" data-set="sex" data-val="other">回答しない</button>
      </div>
    </div>

    <div class="field-row">
      <div class="field"><span class="field-label">身長</span>${stepper({ name: 'height', value: p.height, step: 1, min: 120, max: 230, suffix: 'cm' })}</div>
      <div class="field"><span class="field-label">体重</span>${stepper({ name: 'weight', value: p.weight, step: 0.5, min: 30, max: 220, suffix: 'kg' })}</div>
    </div>
    <div class="field"><span class="field-label">年齢</span>${stepper({ name: 'age', value: p.age, step: 1, min: 12, max: 99, suffix: '歳' })}</div>

    <div class="field">
      <span class="field-label">筋トレ歴</span>
      <div class="opt-grid">
        <button class="opt ${p.experience === 'beginner' ? 'on' : ''}" data-set="experience" data-val="beginner"><span class="oi">🌱</span>1年未満</button>
        <button class="opt ${p.experience === 'intermediate' ? 'on' : ''}" data-set="experience" data-val="intermediate"><span class="oi">🌿</span>1〜3年</button>
        <button class="opt ${p.experience === 'advanced' ? 'on' : ''}" data-set="experience" data-val="advanced"><span class="oi">🌳</span>3年以上</button>
      </div>
    </div>`;
}

function renderGoal() {
  return `
    <h1>目的は？</h1>
    <p class="lede">レップ数・休憩時間・目標RIR（余力）の初期値が変わります。</p>
    ${GOALS.map(g => `
      <button class="card prog-card ${draft.profile.goal === g.id ? 'accent' : ''}" data-set="goal" data-val="${g.id}">
        <div class="pl"><span style="font-size:20px">${g.icon}</span><h3>${esc(g.name)}</h3></div>
        <p>${esc(g.desc)}</p>
        <p class="tiny faint" style="margin-top:6px">${esc(g.intensity)} / ${g.reps[0]}〜${g.reps[1]}回 / 休憩${g.rest[0]}〜${g.rest[1]}秒</p>
      </button>`).join('')}`;
}

function renderProgram() {
  return `
    <h1>分割法を選ぶ</h1>
    <p class="lede">週に何回行けるかで選んでください。あとから「予定」タブで自由に組み替えられます。</p>
    ${PROGRAM_TEMPLATES.map(t => `
      <button class="card prog-card ${draft.programId === t.id ? 'accent' : ''}" data-set="programId" data-val="${t.id}">
        <div class="pl">
          <h3>${esc(t.name)}</h3>
          <span class="chip">${esc(t.level)}</span>
        </div>
        <p>${esc(t.desc)}</p>
        <div class="row wrap tiny faint" style="margin-top:7px;gap:4px">
          ${t.schedule.map((k, i) => `<span class="chip" style="padding:2px 7px;font-size:10.5px">${DAY_NAMES[i]}${k ? '' : '休'}</span>`).join('')}
        </div>
      </button>`).join('')}`;
}

function renderGym() {
  return `
    <h1>どこで鍛える？</h1>
    <p class="lede">扱えるプレートやダンベルの刻みに合わせて、提案する重量を「実際に作れる重量」に丸めます。</p>
    <button class="card prog-card ${draft.gymKind === 'gym' ? 'accent' : ''}" data-set="gymKind" data-val="gym">
      <div class="pl"><span style="font-size:20px">🏢</span><h3>ジム</h3></div>
      <p>20kgバー＋1.25kgまでのプレート、ダンベル2〜50kg（2.5kg刻み）、マシンあり。</p>
    </button>
    <button class="card prog-card ${draft.gymKind === 'home' ? 'accent' : ''}" data-set="gymKind" data-val="home">
      <div class="pl"><span style="font-size:20px">🏠</span><h3>自宅</h3></div>
      <p>可変ダンベル中心。プレートは10kgまで。設定タブで手持ちの器具に合わせて細かく直せます。</p>
    </button>
    <div class="note" style="margin-top:14px">
      <span class="ic">🔒</span>
      <span>記録はすべてこの端末の中だけに保存されます。アカウント登録もサーバー送信もありません。バックアップは設定タブから書き出せます。</span>
    </div>`;
}

export function bind(root, ctx) {
  root.addEventListener('click', e => {
    const setBtn = e.target.closest('[data-set]');
    if (setBtn) {
      const { set, val } = setBtn.dataset;
      if (set === 'programId' || set === 'gymKind') draft[set] = val;
      else draft.profile[set] = val;
      ctx.refresh();
      return;
    }
    const nav = e.target.closest('[data-nav]')?.dataset.nav;
    if (nav === 'back') { captureInputs(root); step = Math.max(0, step - 1); ctx.refresh(); window.scrollTo(0, 0); }
    else if (nav === 'next') {
      captureInputs(root);
      if (step < STEPS.length - 1) { step++; ctx.refresh(); window.scrollTo(0, 0); }
      else finish(ctx);
    }
  });
}

function captureInputs(root) {
  for (const k of ['height', 'weight', 'age']) {
    const el = root.querySelector(`input[name="${k}"]`);
    if (el && el.value !== '') draft.profile[k] = Number(el.value);
  }
}

function finish(ctx) {
  const template = PROGRAM_TEMPLATES.find(t => t.id === draft.programId);
  const gym = draft.gymKind === 'home' ? HOME_GYM() : DEFAULT_GYM();
  gym.name = draft.gymKind === 'home' ? '自宅' : 'ジム';

  ctx.update(s => {
    Object.assign(s.profile, draft.profile);
    s.gyms = [gym];
    s.settings.activeGymId = gym.id;
    applyProgram(s, template);
    s.onboarded = true;
  });

  if (hasLegacyData()) {
    setTimeout(() => offerLegacyImport(ctx), 400);
  } else {
    toast('セットアップ完了。まずはホームを見てみましょう 💪', 'good');
  }
  step = 0;
  ctx.go('home', { replace: true });
}

async function offerLegacyImport(ctx) {
  const { confirmSheet } = await import('./dom.js');
  const ok = await confirmSheet(
    '以前のバージョンのトレーニング記録がこの端末に残っています。新しい形式に取り込みますか？',
    { title: '過去の記録が見つかりました', okLabel: '取り込む' }
  );
  if (ok) {
    const res = importLegacyData();
    if (res.error) toast('取り込みに失敗しました', 'danger');
    else {
      discardLegacyData();
      toast(`${res.imported}日分の記録を取り込みました`, 'good');
    }
  } else {
    discardLegacyData();
  }
  ctx.refresh();
}
