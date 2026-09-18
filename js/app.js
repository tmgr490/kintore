// アプリの起動・タブ切り替え・再描画の管理。

import * as store from './store.js';
import { $, $$, bindSteppers, toast, closeAllSheets } from './ui/dom.js';
import { initTimer, unlockAudio, stopTimer } from './ui/timer.js';

import * as home from './ui/home.js';
import * as session from './ui/session.js';
import * as plan from './ui/plan.js';
import * as stats from './ui/stats.js';
import * as settings from './ui/settings.js';
import * as onboarding from './ui/onboarding.js';

const VIEWS = { home, session, plan, stats, settings };
const TABS = ['home', 'session', 'plan', 'stats', 'settings'];

let current = 'home';
let rendering = false;

export const ctx = {
  get state() { return store.getState(); },
  get gym() { return store.activeGym(); },
  get today() { return store.todayStr(); },
  exerciseById: store.exerciseById,
  allExercises: store.allExercises,
  update: store.update,
  refresh,
  go,
  toast
};

function applyTheme() {
  const t = store.getState().settings?.theme || 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}

export function go(tab, opts = {}) {
  if (!TABS.includes(tab)) tab = 'home';
  current = tab;
  if (location.hash !== '#/' + tab) {
    history[opts.replace ? 'replaceState' : 'pushState'](null, '', '#/' + tab);
  }
  closeAllSheets();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  refresh();
}

export function refresh() {
  if (rendering) return;
  rendering = true;
  try {
    const state = store.getState();

    if (!state.onboarded) {
      document.body.classList.add('onboarding');
      $('#tabbar').style.display = 'none';
      $('#appbar').style.display = 'none';
      $('#restBar').style.display = 'none';
      mount(onboarding.render(ctx), onboarding.bind, ctx);
      return;
    }

    document.body.classList.remove('onboarding');
    $('#tabbar').style.display = '';
    $('#appbar').style.display = '';
    $('#restBar').style.display = '';

    const view = VIEWS[current] || home;
    const title = typeof view.title === 'function' ? view.title(ctx) : view.title;
    const sub = view.subtitle ? view.subtitle(ctx) : '';
    $('#appbar').innerHTML =
      `<h1 id="appTitle">${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>`;

    mount(view.render(ctx), view.bind, ctx);

    for (const btn of $$('.tabbtn')) btn.classList.toggle('on', btn.dataset.tab === current);
    updateBadge();
  } catch (err) {
    console.error('描画に失敗しました', err);
    $('#view').innerHTML = `<div class="card warn">
      <h2>表示中に問題が発生しました</h2>
      <p class="small muted">${String(err && err.message || err)}</p>
      <p class="small muted">データは保存されています。設定タブからバックアップを書き出せます。</p>
      <button class="btn" onclick="location.reload()">再読み込み</button>
    </div>`;
  } finally {
    rendering = false;
  }
}

/**
 * 描画のたびに新しいコンテナを作り、そこにイベントを結び付ける。
 * #view に直接結び付けるとリスナーが再描画のたびに積み重なってしまう。
 */
function mount(html, bind, ctx) {
  const host = $('#view');
  const el = document.createElement('div');
  el.className = 'view-root';
  el.innerHTML = html;
  host.replaceChildren(el);
  bind?.(el, ctx);
}

function updateBadge() {
  const s = store.getState();
  const btn = $('.tabbtn[data-tab="session"]');
  if (!btn) return;
  btn.querySelector('.badge')?.remove();
  if (s.activeSession) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = '●';
    btn.appendChild(b);
  }
}

function bindShell() {
  $('#tabbar').addEventListener('click', e => {
    const btn = e.target.closest('.tabbtn');
    if (btn) go(btn.dataset.tab);
  });

  window.addEventListener('hashchange', () => {
    const tab = location.hash.replace('#/', '');
    if (TABS.includes(tab) && tab !== current) { current = tab; refresh(); }
  });

  document.addEventListener('pointerdown', unlockAudio, { once: true });

  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });

  bindSteppers(document);
  store.onStoreError(msg => toast(msg, 'danger', 5000));
}

// ---- Service Worker -----------------------------------------------------
// push されたコードがリロードで必ず反映されるよう、更新を検出したら即座に
// 新しい Worker に切り替える（キャッシュはオフライン時の保険としてだけ使う）。
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          sw.postMessage({ type: 'SKIP_WAITING' });
          toast('アプリを更新しました。次回の読み込みから反映されます。', 'good');
        }
      });
    });
  }).catch(err => console.warn('Service Worker を登録できませんでした', err));
}

// ---- 起動 ---------------------------------------------------------------
function boot() {
  store.load();
  applyTheme();
  bindShell();
  initTimer({
    onDone() {
      if (current === 'session') refresh();
    }
  });

  const tab = location.hash.replace('#/', '');
  current = TABS.includes(tab) ? tab : (store.getState().activeSession ? 'session' : 'home');

  store.subscribe(() => { applyTheme(); updateBadge(); });
  refresh();
  registerSW();

  // 進行中のセッションが無いのにタイマーが残っていたら止める
  if (!store.getState().activeSession) stopTimer();
}

boot();

// 開発時の確認用（コンソールから状態を覗ける）
window.kintore = { store, ctx, refresh, go };
