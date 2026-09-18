// レストタイマー。終了時刻を基準にするのでタブを閉じていても／
// スマホがスリープしても、戻ってきた時に正しい残り時間を表示する。

import { $, fmtClock, haptic } from './dom.js';

const KEY = 'kintore.timer';
let state = null;   // { endAt, total, next, label }
let tick = null;
let onFinish = null;

function els() {
  return {
    bar: $('#restBar'), time: $('#restTime'), next: $('#restNext'),
    label: $('#restLabel'), prog: $('#restProgress')
  };
}

export function initTimer({ onDone } = {}) {
  onFinish = onDone;
  const e = els();
  $('#restSkip')?.addEventListener('click', () => stopTimer());
  $('#restMinus')?.addEventListener('click', () => addTime(-15));
  $('#restPlus')?.addEventListener('click', () => addTime(15));
  e.time?.addEventListener('click', () => addTime(30));

  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && saved.endAt > Date.now()) { state = saved; run(); }
  } catch { /* 復元できなくても問題ない */ }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

export function startTimer(seconds, { next = '', label = '休憩中', settings = {} } = {}) {
  state = {
    endAt: Date.now() + seconds * 1000,
    total: seconds, next, label,
    sound: settings.restSound !== false,
    vibrate: settings.restVibrate !== false,
    fired: false
  };
  persist();
  run();
}

export function addTime(sec) {
  if (!state) return;
  state.endAt += sec * 1000;
  state.total = Math.max(state.total + sec, 5);
  if (state.endAt > Date.now()) state.fired = false;
  persist();
  render();
  haptic(10);
}

export function stopTimer() {
  state = null;
  clearInterval(tick); tick = null;
  sessionStorage.removeItem(KEY);
  els().bar?.classList.remove('on');
}

export const timerRunning = () => !!state;
export const timerRemaining = () => (state ? Math.max(0, (state.endAt - Date.now()) / 1000) : 0);

function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量なし */ }
}

function run() {
  clearInterval(tick);
  render();
  tick = setInterval(render, 250);
}

function render() {
  const e = els();
  if (!e.bar) return;
  if (!state) { e.bar.classList.remove('on'); return; }

  const left = (state.endAt - Date.now()) / 1000;
  e.bar.classList.add('on');
  e.next.textContent = state.next || '';
  e.label.textContent = state.label;

  if (left <= 0) {
    const over = Math.min(999, Math.round(-left));
    e.time.textContent = '+' + fmtClock(over);
    e.time.classList.add('over');
    e.prog.style.width = '100%';
    if (!state.fired) {
      state.fired = true;
      persist();
      notifyDone();
      if (onFinish) onFinish();
    }
    // 2分以上放置されたら自動で閉じる
    if (over > 120) stopTimer();
    return;
  }

  e.time.classList.remove('over');
  e.time.textContent = fmtClock(left);
  e.prog.style.width = `${Math.max(0, Math.min(100, (1 - left / state.total) * 100))}%`;
}

function notifyDone() {
  if (state?.vibrate) haptic([120, 80, 120]);
  if (state?.sound) beep();
}

let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.18, 0.36].forEach((t, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1046 : 784;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.28, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.2);
    });
  } catch { /* 音が出せない環境では黙って無視 */ }
}

/** iOS はユーザー操作の中でしか音を鳴らせないので、最初のタップで解錠しておく */
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* 非対応 */ }
}
