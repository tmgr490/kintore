// 画面づくりの小道具。テンプレート文字列でHTMLを組み立て、イベントは委譲で拾う。

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const cls = (...xs) => xs.filter(Boolean).join(' ');

export function num(v, digits = 0) {
  const n = Number(v) || 0;
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
}

export const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export function fmtDate(dateStr, { withDow = true, short = false } = {}) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1, day = d.getDate();
  const base = short ? `${m}/${day}` : `${d.getFullYear()}年${m}月${day}日`;
  return withDow ? `${base}(${DOW[d.getDay()]})` : base;
}

export function relDate(dateStr, today) {
  if (!dateStr) return '記録なし';
  const a = new Date(dateStr + 'T00:00:00').getTime();
  const b = new Date(today + 'T00:00:00').getTime();
  const d = Math.round((b - a) / 86400000);
  if (d === 0) return '今日';
  if (d === 1) return '昨日';
  if (d === 2) return '一昨日';
  if (d < 7) return `${d}日前`;
  if (d < 28) return `${Math.floor(d / 7)}週間前`;
  if (d < 365) return `${Math.floor(d / 30)}ヶ月前`;
  return `${Math.floor(d / 365)}年前`;
}

export function fmtDuration(min) {
  if (min == null) return '—';
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- トースト ---------------------------------------------------------

let toastRoot = null;
export function toast(msg, type = 'info', ms = 2600) {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'toast-root';
    document.body.appendChild(toastRoot);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = msg;
  toastRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

// ---- ボトムシート ------------------------------------------------------

let sheetStack = [];

export function openSheet({ title, body, actions = '', onMount, size = 'auto', id }) {
  const root = document.createElement('div');
  root.className = 'sheet-bg';
  root.innerHTML = `
    <div class="sheet sheet-${size}" role="dialog" aria-modal="true">
      <div class="sheet-grab"></div>
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn sheet-close" aria-label="閉じる">✕</button>
      </header>
      <div class="sheet-body">${body}</div>
      ${actions ? `<div class="sheet-actions">${actions}</div>` : ''}
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  const close = () => closeSheet(root);
  root.addEventListener('click', e => { if (e.target === root) close(); });
  root.querySelector('.sheet-close').addEventListener('click', close);
  sheetStack.push(root);
  requestAnimationFrame(() => root.classList.add('in'));
  if (onMount) onMount(root, close);
  if (id) root.dataset.sheetId = id;
  return { root, close };
}

export function closeSheet(root) {
  const el = root || sheetStack[sheetStack.length - 1];
  if (!el) return;
  el.classList.remove('in');
  sheetStack = sheetStack.filter(x => x !== el);
  if (!sheetStack.length) document.body.classList.remove('no-scroll');
  setTimeout(() => el.remove(), 220);
}

export function closeAllSheets() {
  [...sheetStack].forEach(closeSheet);
}

export function confirmSheet(message, { okLabel = 'OK', danger = false, title = '確認' } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    openSheet({
      title,
      body: `<p class="sheet-msg">${message}</p>`,
      actions: `
        <button class="btn ghost" data-act="cancel">キャンセル</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(okLabel)}</button>`,
      onMount(root, close) {
        // 背景タップや ✕ で閉じられた場合も「キャンセル」として解決する
        new MutationObserver((_, obs) => {
          if (!document.body.contains(root)) { obs.disconnect(); done(false); }
        }).observe(document.body, { childList: true });
        root.addEventListener('click', e => {
          const act = e.target.closest('[data-act]')?.dataset.act;
          if (act === 'ok') { done(true); close(); }
          else if (act === 'cancel') { done(false); close(); }
        });
      }
    });
  });
}

// ---- 数値ステッパー ----------------------------------------------------

/** data-step-target と組み合わせて使う +/- ボタン付き入力 */
export function stepper({ name, value, step = 1, min = 0, max = 9999, suffix = '', decimals = 1 }) {
  const v = Number(value) || 0;
  const shown = Number.isInteger(v) ? v : Math.round(v * 10 ** decimals) / 10 ** decimals;
  return `
    <div class="stepper" data-stepper="${esc(name)}" data-step="${step}" data-min="${min}" data-max="${max}">
      <button type="button" class="step-btn" data-dir="-1" aria-label="減らす">−</button>
      <label class="step-field">
        <input type="number" inputmode="decimal" name="${esc(name)}" value="${shown}" step="${step}" min="${min}" max="${max}">
        ${suffix ? `<span class="step-suffix">${esc(suffix)}</span>` : ''}
      </label>
      <button type="button" class="step-btn" data-dir="1" aria-label="増やす">＋</button>
    </div>`;
}

/** ページ全体で1回だけ呼ぶ。ステッパーの +/- を有効にする。 */
export function bindSteppers(root = document) {
  root.addEventListener('click', e => {
    const btn = e.target.closest('.stepper .step-btn');
    if (!btn) return;
    const wrap = btn.closest('.stepper');
    const input = wrap.querySelector('input');
    const step = Number(wrap.dataset.step) || 1;
    const min = Number(wrap.dataset.min);
    const max = Number(wrap.dataset.max);
    const dir = Number(btn.dataset.dir);
    let v = (Number(input.value) || 0) + step * dir;
    v = Math.round(v * 1000) / 1000;
    if (isFinite(min)) v = Math.max(min, v);
    if (isFinite(max)) v = Math.min(max, v);
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    haptic(8);
  });
}

export function haptic(ms = 12) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 非対応環境 */ }
}

/** 空状態のプレースホルダ */
export function empty(icon, title, sub = '', action = '') {
  return `<div class="empty">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${esc(title)}</div>
    ${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ''}
    ${action}
  </div>`;
}

export function segmented(name, options, active) {
  return `<div class="segmented" role="tablist">
    ${options.map(o => `<button role="tab" class="seg ${o.value === active ? 'on' : ''}" data-${name}="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
  </div>`;
}

export function bar(pct, tone = '') {
  const p = Math.max(0, Math.min(100, pct));
  return `<div class="bar"><div class="bar-fill ${tone}" style="width:${p}%"></div></div>`;
}
