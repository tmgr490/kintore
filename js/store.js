// 永続化層。localStorage に1キーでまとめて保存し、購読者に変更を通知する。

import { BUILTIN_EXERCISES } from './data/exercises.js';

export const STORAGE_KEY = 'kintore.v1';
export const SCHEMA_VERSION = 1;

export const todayStr = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_GYM = () => ({
  id: uid(),
  name: 'ジム',
  barWeight: 20,
  ezBarWeight: 7.5,
  // 片側に用意できるプレート（kg）。同じ重さを複数持っている場合は個数も持つ。
  plates: [
    { w: 20, count: 4 }, { w: 15, count: 2 }, { w: 10, count: 2 },
    { w: 5, count: 2 }, { w: 2.5, count: 2 }, { w: 1.25, count: 2 }
  ],
  dumbbell: { min: 2.5, max: 50, step: 2.5 },
  machineStep: 2.5,
  cableStep: 2.5
});

export const HOME_GYM = () => ({
  id: uid(),
  name: '自宅',
  barWeight: 20,
  ezBarWeight: 7.5,
  plates: [{ w: 10, count: 2 }, { w: 5, count: 2 }, { w: 2.5, count: 2 }, { w: 1.25, count: 2 }],
  dumbbell: { min: 2, max: 24, step: 2 },
  machineStep: 5,
  cableStep: 5
});

function defaultState() {
  const gym = DEFAULT_GYM();
  return {
    schemaVersion: SCHEMA_VERSION,
    onboarded: false,
    profile: {
      name: '',
      sex: 'male',
      age: 30,
      height: 170,
      weight: 65,
      experience: 'beginner', // beginner | intermediate | advanced
      goal: 'hypertrophy',
      painAreas: []           // 避けたい部位（muscle id）
    },
    settings: {
      theme: 'auto',          // auto | dark | light
      units: 'kg',            // kg | lb
      restSound: true,
      restVibrate: true,
      autoTimer: true,
      showWarmup: true,
      activeGymId: gym.id,
      weekStart: 1            // 1=月曜はじまり
    },
    gyms: [gym],
    customExercises: [],
    exerciseMeta: {},         // exId -> { note, favorite, hidden }
    programId: null,
    routines: [],
    schedule: [null, null, null, null, null, null, null],
    sessions: [],             // 完了したセッション（新しい順に並べない。日付でソートして使う）
    activeSession: null,
    bodyLog: [],
    checkins: [],
    deloads: []               // { from, to, reason }
  };
}

function migrate(state) {
  if (!state || typeof state !== 'object') return defaultState();
  const base = defaultState();
  // 浅いマージ＋ネストしたオブジェクトの補完。将来のキー追加でも壊れないようにする。
  const merged = { ...base, ...state };
  merged.profile = { ...base.profile, ...(state.profile || {}) };
  merged.settings = { ...base.settings, ...(state.settings || {}) };
  if (!Array.isArray(merged.gyms) || merged.gyms.length === 0) merged.gyms = base.gyms;
  merged.gyms = merged.gyms.map(g => ({ ...DEFAULT_GYM(), ...g }));
  if (!merged.gyms.some(g => g.id === merged.settings.activeGymId)) {
    merged.settings.activeGymId = merged.gyms[0].id;
  }
  for (const k of ['customExercises', 'routines', 'sessions', 'bodyLog', 'checkins', 'deloads']) {
    if (!Array.isArray(merged[k])) merged[k] = [];
  }
  if (!Array.isArray(merged.schedule) || merged.schedule.length !== 7) merged.schedule = [...base.schedule];
  if (!merged.exerciseMeta || typeof merged.exerciseMeta !== 'object') merged.exerciseMeta = {};
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

let state = defaultState();
const listeners = new Set();
let saveTimer = null;

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch (e) {
    console.warn('保存データを読み込めませんでした。初期状態から開始します。', e);
    state = defaultState();
  }
  return state;
}

export const getState = () => state;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存に失敗しました（容量超過の可能性）', e);
    notifyError('保存に失敗しました。設定からデータを書き出してください。');
  }
}

let errorHandler = null;
export const onStoreError = fn => { errorHandler = fn; };
const notifyError = msg => { if (errorHandler) errorHandler(msg); };

/** state を書き換える。fn の中で直接 state を変更してよい。 */
export function update(fn, { silent = false } = {}) {
  fn(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 150);
  if (!silent) emit();
  return state;
}

/** 保存だけ即座に行う（画面を閉じる直前など） */
export function flush() {
  clearTimeout(saveTimer);
  persist();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

export function replaceState(next) {
  state = migrate(next);
  flush();
  emit();
}

export function resetAll() {
  state = defaultState();
  flush();
  emit();
}

// ---- 種目 -------------------------------------------------------------

/** 組み込み＋自作をまとめた種目一覧 */
export function allExercises() {
  return [...BUILTIN_EXERCISES, ...state.customExercises];
}

let exIndex = null;
let exIndexSource = null;
export function exerciseById(id) {
  if (exIndexSource !== state.customExercises) {
    exIndex = Object.fromEntries(allExercises().map(e => [e.id, e]));
    exIndexSource = state.customExercises;
  }
  return exIndex[id] || null;
}
export function invalidateExerciseIndex() { exIndexSource = null; }

export const activeGym = () =>
  state.gyms.find(g => g.id === state.settings.activeGymId) || state.gyms[0];

// ---- 旧アプリ（wt_*）からの取り込み ------------------------------------

const OLD_KEYS = { logs: 'wt_logs', profile: 'wt_profile', exercises: 'wt_exercises' };

/** 旧アプリのデータが localStorage に残っているか */
export function hasLegacyData() {
  try {
    const raw = localStorage.getItem(OLD_KEYS.logs);
    if (!raw) return false;
    const logs = JSON.parse(raw);
    return logs && typeof logs === 'object' && Object.keys(logs).length > 0;
  } catch { return false; }
}

/**
 * 旧アプリの wt_logs { 'YYYY-MM-DD': [{exId,name,weight,reps,ts}] } を
 * 新形式のセッションに変換して取り込む。種目名が一致すれば既存種目に、
 * 一致しなければ自作種目として作る。
 */
export function importLegacyData() {
  let imported = 0, createdEx = 0;
  try {
    const logs = JSON.parse(localStorage.getItem(OLD_KEYS.logs) || '{}');
    const byName = new Map(allExercises().map(e => [e.name.replace(/\s/g, ''), e]));
    const existingDates = new Set(state.sessions.map(s => s.date));

    update(s => {
      for (const [date, rows] of Object.entries(logs)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        if (existingDates.has(date)) continue;
        const entries = new Map();
        for (const r of rows) {
          const key = (r.name || r.exId || '不明').replace(/\s/g, '');
          let ex = byName.get(key);
          if (!ex) {
            ex = {
              id: 'legacy_' + uid(), name: r.name || key, muscle: 'chest', sub: [],
              equip: 'other', pattern: 'iso', alts: [], tips: [],
              uni: false, bw: false, assist: false, time: false, bar: 0, custom: true, legacy: true
            };
            s.customExercises.push(ex);
            byName.set(key, ex);
            createdEx++;
          }
          if (!entries.has(ex.id)) entries.set(ex.id, { exId: ex.id, note: '', sets: [] });
          entries.get(ex.id).sets.push({
            w: Number(r.weight) || 0,
            reps: Number(r.reps) || 0,
            rir: null, type: 'work', done: true, ts: r.ts || null
          });
        }
        s.sessions.push({
          id: uid(), date, routineId: null, name: '旧アプリの記録',
          startedAt: null, endedAt: null, condition: null, sessionRpe: null,
          note: '旧アプリから取り込み', entries: [...entries.values()]
        });
        imported++;
      }
      s.sessions.sort((a, b) => a.date.localeCompare(b.date));
    });
    invalidateExerciseIndex();
  } catch (e) {
    console.error('旧データの取り込みに失敗しました', e);
    return { imported: 0, createdEx: 0, error: String(e) };
  }
  return { imported, createdEx };
}

export function discardLegacyData() {
  for (const k of Object.values(OLD_KEYS)) localStorage.removeItem(k);
  localStorage.removeItem('wt_routines');
  localStorage.removeItem('wt_active_routine');
}

// ---- 書き出し／読み込み ------------------------------------------------

export function exportJSON() {
  return JSON.stringify({ app: 'kintore', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const next = parsed && parsed.state ? parsed.state : parsed;
  if (!next || typeof next !== 'object') throw new Error('形式が違います');
  replaceState(next);
  invalidateExerciseIndex();
}
