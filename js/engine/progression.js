// 漸進性過負荷の自動計算。
// 「ダブルプログレッション」：目標レップ域の上限を全セットで達成したら重量を上げ、
// レップを下限に戻す。達成できていなければ回数を1つ増やす。

import { roundWeight, increment } from './plates.js';
import { historyFor, workSets } from './history.js';
import { isCompound } from '../data/exercises.js';
import { e1rm } from './onerm.js';

/** 履歴がない種目の初回重量をプロフィールから概算する */
export function estimateStartWeight(ex, profile, gym) {
  if (!ex || ex.bw || ex.time) return 0;
  const bw = Number(profile?.weight) || 65;
  const sexFactor = profile?.sex === 'female' ? 0.62 : 1;
  const expFactor = { beginner: 1, intermediate: 1.45, advanced: 1.85 }[profile?.experience] || 1;

  const byPattern = {
    squat: 0.55, hinge: 0.65, push_h: 0.45, push_v: 0.3,
    pull_h: 0.4, pull_v: 0.4, lunge: 0.22, iso: 0.1, core: 0.12, carry: 0.3
  };
  let frac = byPattern[ex.pattern] ?? 0.15;

  // 単関節は部位で大きく違う
  if (ex.pattern === 'iso') {
    const byMuscle = {
      biceps: 0.12, triceps: 0.12, side_delt: 0.05, rear_delt: 0.05, front_delt: 0.06,
      forearms: 0.1, calves: 0.6, quads: 0.35, hamstrings: 0.3, glutes: 0.4,
      adductors: 0.3, traps: 0.5, lats: 0.25, upper_back: 0.25, abs: 0.15, obliques: 0.1, neck: 0.03
    };
    frac = byMuscle[ex.muscle] ?? 0.12;
  }
  if (ex.equip === 'dumbbell' || ex.equip === 'kettlebell') frac *= ex.uni ? 0.32 : 0.42;
  if (ex.equip === 'machine' || ex.equip === 'cable') frac *= 1.1;
  if (ex.assist) return Math.max(0, roundWeight(bw * 0.4, ex, gym, 'near'));

  const raw = bw * frac * sexFactor * expFactor;
  return roundWeight(Math.max(raw, ex.bar || 0), ex, gym, 'down');
}

/** 直近セッションの「本番の重量」（最頻値。同数なら重いほう） */
function workingWeight(sets) {
  const counts = new Map();
  for (const s of sets) counts.set(s.w, (counts.get(s.w) || 0) + 1);
  let best = null, bestN = 0;
  for (const [w, n] of counts) {
    if (n > bestN || (n === bestN && w > best)) { best = w; bestN = n; }
  }
  return best ?? 0;
}

/**
 * 次回の目標を提案する。
 * @returns {{weight:number, reps:number, rir:number, reason:string, kind:string, last:object|null}}
 */
export function suggestNext(state, ex, item, gym, opts = {}) {
  const repLow = item?.repLow ?? 8;
  const repHigh = item?.repHigh ?? 12;
  const targetRir = item?.rir ?? 2;
  const hist = historyFor(state, ex.id, 4);

  if (hist.length === 0) {
    const w = estimateStartWeight(ex, state.profile, gym);
    return {
      weight: w, reps: repLow, rir: targetRir, kind: 'start', last: null,
      reason: '初回。体格からの概算なので、軽いと感じたら遠慮なく上げてください。'
    };
  }

  const last = hist[0];
  const sets = workSets(last.entry);
  if (sets.length === 0) {
    const w = estimateStartWeight(ex, state.profile, gym);
    return { weight: w, reps: repLow, rir: targetRir, kind: 'start', last: null, reason: '記録がありません。' };
  }

  const ww = workingWeight(sets);
  const atWeight = sets.filter(s => s.w === ww);
  const minReps = Math.min(...atWeight.map(s => s.reps || 0));
  const maxReps = Math.max(...sets.map(s => s.reps || 0));
  const rirs = sets.map(s => s.rir).filter(v => v !== null && v !== undefined);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const inc = progressionStep(ex, gym, ww);

  // 2回連続で下限に届いていない → デロード
  const failedStreak = countFailedStreak(hist, repLow);
  if (failedStreak >= 2) {
    const w = roundWeight(ww * 0.9, ex, gym, 'down');
    return {
      weight: Math.max(w, ex.bar || 0), reps: repLow, rir: targetRir, kind: 'deload', last,
      reason: `${failedStreak}回続けて${repLow}回に届いていません。10%落として立て直しましょう。`
    };
  }

  // 全セットで上限に到達し、余力もあった → 重量アップ
  const hitTop = minReps >= repHigh && atWeight.length >= 1;
  const feltEasy = avgRir === null ? true : avgRir >= targetRir;
  if (hitTop && feltEasy) {
    return {
      weight: roundWeight(ww + inc, ex, gym, 'up'), reps: repLow, rir: targetRir, kind: 'up', last,
      reason: `前回は全セット${repHigh}回を達成。${fmtInc(inc)}増やして${repLow}回から再スタート。`
    };
  }
  if (hitTop && !feltEasy) {
    return {
      weight: ww, reps: repHigh, rir: targetRir, kind: 'hold', last,
      reason: `${repHigh}回は達成しましたが余力が少なめ。同じ重量でもう一度、余裕を持って。`
    };
  }

  // 下限は超えている → 回数を1つ増やす
  if (minReps >= repLow) {
    const next = Math.min(repHigh, minReps + 1);
    return {
      weight: ww, reps: next, rir: targetRir, kind: 'reps', last,
      reason: `前回は${ww ? '' : ''}${minReps}回。今回は${next}回を目標に。全セット${repHigh}回できたら重量アップ。`
    };
  }

  // 下限未達 → 同じ重量でリトライ
  return {
    weight: ww, reps: repLow, rir: targetRir, kind: 'retry', last,
    reason: `前回は${minReps}回止まり。同じ重量で${repLow}回を目指しましょう。`
  };
}

function fmtInc(inc) {
  return (Math.round(inc * 100) / 100) + 'kg';
}

/** 1回あたりの増量幅。大きな種目ほど大きく、小さな種目は最小刻みで。 */
export function progressionStep(ex, gym, currentWeight = 0) {
  const step = increment(ex, gym);
  if (!isCompound(ex)) return step;
  // 重量が上がるほど %ベースにする（60kg以上なら約2.5%）
  const pctBased = currentWeight * 0.025;
  const n = Math.max(1, Math.round(pctBased / step));
  return step * Math.min(n, 2);
}

function countFailedStreak(hist, repLow) {
  let streak = 0;
  for (const h of hist) {
    const sets = workSets(h.entry);
    if (!sets.length) break;
    const maxReps = Math.max(...sets.map(s => s.reps || 0));
    if (maxReps < repLow) streak++; else break;
  }
  return streak;
}

/** 直近の推定1RMと、そこから見た伸び率（週あたり%） */
export function trend(state, exId, weeks = 8) {
  const hist = historyFor(state, exId, 20);
  const points = [];
  for (const h of hist) {
    let top = 0;
    for (const s of workSets(h.entry)) {
      const v = e1rm(s.w, s.reps, s.rir ?? 0);
      if (v > top) top = v;
    }
    if (top > 0) points.push({ date: h.session.date, value: top });
  }
  points.reverse();
  if (points.length < 2) return { slopePerWeek: 0, points, stalled: false };

  const cut = points.slice(-Math.max(3, Math.min(points.length, weeks)));
  const t0 = new Date(cut[0].date).getTime();
  const xs = cut.map(p => (new Date(p.date).getTime() - t0) / (7 * 86400000));
  const ys = cut.map(p => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const pct = my > 0 ? slope / my * 100 : 0;
  return {
    slopePerWeek: Math.round(slope * 100) / 100,
    pctPerWeek: Math.round(pct * 100) / 100,
    points,
    stalled: n >= 4 && pct < 0.2
  };
}
