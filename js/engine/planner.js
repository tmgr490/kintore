// 「今日のメニュー」を自動で組み立てる。

import { suggestNext } from './progression.js';
import { roundWeight } from './plates.js';
import { buildWarmup } from './warmup.js';
import { adjustment, sorenessVerdict } from './autoreg.js';
import { freshness, weeklyStatus } from './volume.js';
import { historyFor } from './history.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { GOAL_BY_ID } from '../data/guide.js';

/** 曜日に割り当てられたルーティン */
export function scheduledRoutine(state, date = new Date()) {
  const dow = date.getDay();
  const id = state.schedule?.[dow];
  return id ? state.routines.find(r => r.id === id) || null : null;
}

/** 最後に実施してから最も日が空いているルーティン */
export function mostOverdueRoutine(state) {
  if (!state.routines.length) return null;
  const lastDone = {};
  for (const s of state.sessions) {
    if (!s.routineId) continue;
    if (!lastDone[s.routineId] || s.date > lastDone[s.routineId]) lastDone[s.routineId] = s.date;
  }
  return [...state.routines].sort((a, b) => {
    const da = lastDone[a.id] || '0000-00-00';
    const db = lastDone[b.id] || '0000-00-00';
    return da.localeCompare(db);
  })[0];
}

/** 今日いちばん鍛えるべき部位（回復済み × 週ボリューム不足） */
export function priorityMuscles(state, exerciseById, today, limit = 4) {
  const fresh = freshness(state, exerciseById, new Date(today + 'T12:00:00'));
  const weekly = Object.fromEntries(weeklyStatus(state, exerciseById, today).map(w => [w.muscle.id, w]));
  return fresh
    .map(f => {
      const w = weekly[f.muscle.id];
      const deficit = w ? Math.max(0, f.muscle.mav - w.sets) / Math.max(1, f.muscle.mav) : 1;
      return { ...f, deficit, score: f.recovery / 100 * 0.6 + deficit * 0.4 };
    })
    .filter(f => f.muscle.mev > 0 || f.deficit > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 代替候補の種目一覧（登録された代替＋同じ動作パターン・同じ主働筋） */
export function alternativesFor(ex, allEx, gym) {
  if (!ex) return [];
  const byId = new Map(allEx.map(e => [e.id, e]));
  const seen = new Set([ex.id]);
  const out = [];
  for (const id of ex.alts || []) {
    const e = byId.get(id);
    if (e && !seen.has(e.id)) { out.push(e); seen.add(e.id); }
  }
  for (const e of allEx) {
    if (seen.has(e.id)) continue;
    if (e.muscle === ex.muscle && e.pattern === ex.pattern) { out.push(e); seen.add(e.id); }
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * 今日のメニューを組み立てる。
 * @returns {{source:string, routine:object|null, name:string, items:Array, adj:object, notes:Array}}
 */
export function buildTodayPlan(state, exerciseById, gym, today, condition) {
  const adj = adjustment(condition);
  const goal = GOAL_BY_ID[state.profile?.goal] || GOAL_BY_ID.hypertrophy;
  const notes = [];

  let routine = scheduledRoutine(state, new Date(today + 'T12:00:00'));
  let source = 'scheduled';
  if (!routine) {
    routine = mostOverdueRoutine(state);
    source = routine ? 'suggested' : 'none';
    if (routine) notes.push(`今日は予定が入っていません。いちばん間隔が空いている「${routine.name}」を提案します。`);
  }

  if (!routine) {
    return { source: 'none', routine: null, name: '', items: [], adj, notes, goal };
  }

  const items = (routine.items || []).map(item => {
    const ex = exerciseById(item.exId);
    if (!ex) return null;
    const sug = suggestNext(state, ex, item, gym);
    // コンディション調整をかけたあとも、必ず「実際に作れる重量」に丸める
    const adjWeight = adj.loadFactor === 1
      ? sug.weight
      : roundWeight(sug.weight * adj.loadFactor, ex, gym, 'down');
    const sets = Math.max(1, Math.round(item.sets * adj.setFactor));
    const verdict = sorenessVerdict(condition, ex.muscle);
    const painful = (state.profile?.painAreas || []).includes(ex.muscle);
    const rest = restSeconds(ex, item, goal);

    return {
      exId: ex.id,
      ex,
      sets,
      plannedSets: item.sets,
      repLow: item.repLow,
      repHigh: item.repHigh,
      rir: item.rir,
      suggestion: { ...sug, weight: adjWeight, rawWeight: sug.weight },
      warmup: state.settings?.showWarmup === false ? [] : buildWarmup(adjWeight, ex, gym, { goal: state.profile?.goal }),
      rest,
      flag: painful ? 'pain' : verdict === 'avoid' ? 'sore' : verdict === 'caution' ? 'caution' : null,
      lastDone: historyFor(state, ex.id, 1)[0]?.session?.date || null
    };
  }).filter(Boolean);

  if (adj.setFactor !== 1) {
    notes.push(adj.label);
  }
  const flagged = items.filter(i => i.flag === 'pain' || i.flag === 'sore');
  if (flagged.length) {
    notes.push(`${flagged.map(i => MUSCLE_BY_ID[i.ex.muscle]?.name).filter(Boolean).join('・')}に負担がかかる種目があります。差し替えるか軽めにしましょう。`);
  }

  return { source, routine, name: routine.name, items, adj, notes, goal };
}

/** 種目と目的から休憩秒数を決める（15秒単位に丸める） */
export function restSeconds(ex, item, goal) {
  const base = goal?.rest || [90, 180];
  const isBig = ex.pattern === 'squat' || ex.pattern === 'hinge' ||
    (ex.pattern === 'push_h' && ex.equip === 'barbell') || ex.pattern === 'push_v';
  const isIso = ex.pattern === 'iso' || ex.pattern === 'core';
  const raw = isIso ? Math.max(45, base[0] * 0.7) : isBig ? base[1] : (base[0] + base[1]) / 2;
  return Math.max(30, Math.round(raw / 15) * 15);
}

/** 予定の所要時間（分）をざっくり見積もる */
export function estimateDuration(items) {
  let sec = 300; // 一般ウォームアップ
  for (const it of items) {
    sec += it.warmup.length * 70;
    sec += it.sets * (40 + it.rest);
  }
  return Math.round(sec / 60);
}
