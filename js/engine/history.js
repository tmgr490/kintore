// セッション履歴の検索・集計。他のエンジンから共通で使う。

import { e1rm, effectiveLoad } from './onerm.js';

/** 日付の新しい順に並べたセッション */
export function sortedSessions(state) {
  return [...state.sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
}

/** ある種目の実績を新しい順に返す。[{session, entry}] */
export function historyFor(state, exId, limit = 50) {
  const out = [];
  for (const s of sortedSessions(state)) {
    const entry = s.entries?.find(e => e.exId === exId);
    if (entry && entry.sets.some(x => x.done)) {
      out.push({ session: s, entry });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** その種目の直近の実績（1件） */
export function lastPerformance(state, exId) {
  return historyFor(state, exId, 1)[0] || null;
}

/** 本番セット（ウォームアップ以外）だけ */
export const workSets = entry => (entry?.sets || []).filter(s => s.done && s.type !== 'warmup');

/** その種目の全期間ベスト */
export function bestFor(state, exId, bodyWeight = 70) {
  let best1rm = 0, bestWeight = 0, bestReps = 0, bestVolume = 0, best1rmDate = null, bestWeightDate = null;
  for (const { session, entry } of historyFor(state, exId, 9999)) {
    let sessionVol = 0;
    for (const s of workSets(entry)) {
      const load = effectiveLoad(s, { bw: false }, bodyWeight);
      const est = e1rm(load, s.reps, s.rir ?? 0);
      if (est > best1rm) { best1rm = est; best1rmDate = session.date; }
      if (load > bestWeight) { bestWeight = load; bestWeightDate = session.date; }
      if (s.reps > bestReps) bestReps = s.reps;
      sessionVol += load * (s.reps || 0);
    }
    if (sessionVol > bestVolume) bestVolume = sessionVol;
  }
  return { best1rm, bestWeight, bestReps, bestVolume, best1rmDate, bestWeightDate };
}

/** 推定1RMの推移（古い順） */
export function e1rmSeries(state, exId) {
  const out = [];
  for (const { session, entry } of historyFor(state, exId, 9999)) {
    let top = 0;
    for (const s of workSets(entry)) {
      const est = e1rm(s.w, s.reps, s.rir ?? 0);
      if (est > top) top = est;
    }
    if (top > 0) out.push({ date: session.date, value: top });
  }
  return out.reverse();
}

/** 指定日を含む週の開始日（月曜はじまり）を返す */
export function weekStart(dateStr, startDow = 1) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const diff = (dow - startDow + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 連続記録（ストリーク）: 直近何週間続けてトレーニングしているか */
export function weekStreak(state, today) {
  const weeks = new Set(state.sessions.map(s => weekStart(s.date)));
  let streak = 0;
  let w = weekStart(today);
  // 今週まだ実施していない場合は先週から数える
  if (!weeks.has(w)) w = addDays(w, -7);
  while (weeks.has(w)) { streak++; w = addDays(w, -7); }
  return streak;
}

/** 連続日数ではなく「直近30日の実施日数」 */
export function sessionsInLastDays(state, today, days) {
  const from = addDays(today, -days + 1);
  return state.sessions.filter(s => s.date >= from && s.date <= today);
}
