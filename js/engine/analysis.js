// PR検出・停滞検知・デロード提案・気づきの生成。

import { e1rm, effectiveLoad } from './onerm.js';
import { historyFor, workSets, addDays, daysBetween, sortedSessions } from './history.js';
import { weeklyStatus, freshness } from './volume.js';
import { trend } from './progression.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';

/** 指定セッションを除いた、その種目の自己ベスト */
export function prContext(state, exId, excludeSessionId = null, bodyWeight = 70) {
  let best1rm = 0, bestWeight = 0, bestReps = 0, bestVolume = 0;
  for (const { session, entry } of historyFor(state, exId, 9999)) {
    if (excludeSessionId && session.id === excludeSessionId) continue;
    let vol = 0;
    for (const s of workSets(entry)) {
      const load = effectiveLoad(s, entry.ex || {}, bodyWeight);
      const est = e1rm(s.w, s.reps, s.rir ?? 0);
      if (est > best1rm) best1rm = est;
      if (s.w > bestWeight) bestWeight = s.w;
      if (s.reps > bestReps) bestReps = s.reps;
      vol += (s.w || 0) * (s.reps || 0);
    }
    if (vol > bestVolume) bestVolume = vol;
  }
  return { best1rm, bestWeight, bestReps, bestVolume };
}

export const PR_LABEL = {
  e1rm: '推定1RM更新',
  weight: '最高重量更新',
  reps: '最高回数更新',
  volume: '総ボリューム更新'
};

/** 1セットが自己ベストを更新したか */
export function checkSetPRs(best, set) {
  const out = [];
  if (!set || !set.done || !set.reps) return out;
  const est = e1rm(set.w, set.reps, set.rir ?? 0);
  if (best.best1rm > 0 && est > best.best1rm + 0.05) out.push({ type: 'e1rm', value: est, prev: best.best1rm });
  if (best.bestWeight > 0 && set.w > best.bestWeight) out.push({ type: 'weight', value: set.w, prev: best.bestWeight });
  if (best.bestReps > 0 && set.reps > best.bestReps && set.w >= best.bestWeight) {
    out.push({ type: 'reps', value: set.reps, prev: best.bestReps });
  }
  return out;
}

/** セッションのまとめ */
export function sessionSummary(state, session, exerciseById, bodyWeight = 70) {
  let totalVolume = 0, totalSets = 0, totalReps = 0;
  const perMuscle = {};
  const prs = [];

  for (const entry of session.entries || []) {
    const ex = exerciseById(entry.exId);
    if (!ex) continue;
    const sets = workSets(entry);
    totalSets += sets.length;
    const best = prContext(state, ex.id, session.id, bodyWeight);
    for (const s of sets) {
      totalReps += s.reps || 0;
      if (!ex.time) totalVolume += effectiveLoad(s, ex, bodyWeight) * (s.reps || 0);
      for (const pr of checkSetPRs(best, s)) prs.push({ ...pr, exId: ex.id, exName: ex.name });
    }
    perMuscle[ex.muscle] = (perMuscle[ex.muscle] || 0) + sets.length;
    for (const m of ex.sub || []) perMuscle[m] = (perMuscle[m] || 0) + sets.length * 0.5;
  }

  // 同じルーティンの前回と比較
  let prev = null;
  if (session.routineId) {
    prev = sortedSessions(state).find(s => s.routineId === session.routineId && s.id !== session.id && s.date <= session.date) || null;
  }
  let prevVolume = 0;
  if (prev) {
    for (const entry of prev.entries || []) {
      const ex = exerciseById(entry.exId);
      if (!ex || ex.time) continue;
      for (const s of workSets(entry)) prevVolume += effectiveLoad(s, ex, bodyWeight) * (s.reps || 0);
    }
  }

  const duration = session.startedAt && session.endedAt
    ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
    : null;

  // 同じ種目・同じ重量帯での重複PRは1つにまとめる
  const uniquePrs = [];
  const seen = new Set();
  for (const pr of prs.sort((a, b) => b.value - a.value)) {
    const k = pr.exId + ':' + pr.type;
    if (seen.has(k)) continue;
    seen.add(k);
    uniquePrs.push(pr);
  }

  return {
    totalVolume: Math.round(totalVolume),
    totalSets, totalReps, duration, perMuscle,
    prs: uniquePrs,
    prevVolume: Math.round(prevVolume),
    volumeDelta: prevVolume > 0 ? Math.round((totalVolume - prevVolume) / prevVolume * 100) : null,
    prevDate: prev?.date || null
  };
}

/** 停滞している種目を洗い出す */
export function stalledExercises(state, exerciseById, minSessions = 4) {
  const ids = new Set();
  for (const s of state.sessions.slice(-30)) for (const e of s.entries || []) ids.add(e.exId);
  const out = [];
  for (const id of ids) {
    const ex = exerciseById(id);
    if (!ex || ex.time || ex.pattern === 'core') continue;
    const t = trend(state, id);
    if (t.points.length >= minSessions && t.stalled) {
      out.push({ ex, ...t, lastDate: t.points[t.points.length - 1]?.date });
    }
  }
  return out.sort((a, b) => (a.pctPerWeek ?? 0) - (b.pctPerWeek ?? 0));
}

/**
 * デロード（回復週）を取るべきか判定する。
 * ・前回のデロードから週数が経っている
 * ・MRV超えの部位がある
 * ・停滞している種目が複数ある
 */
export function deloadSuggestion(state, exerciseById, today) {
  const reasons = [];
  let score = 0;

  const lastDeload = state.deloads?.length ? state.deloads[state.deloads.length - 1].to : null;
  const firstSession = state.sessions.length ? state.sessions.map(s => s.date).sort()[0] : null;
  const since = lastDeload || firstSession;
  const weeksSince = since ? Math.floor(daysBetween(since, today) / 7) : 0;
  if (weeksSince >= 8) { score += 2; reasons.push(`${weeksSince}週間デロードを取っていません（目安は4〜8週に1回）。`); }
  else if (weeksSince >= 6) { score += 1; reasons.push(`前回のデロードから${weeksSince}週です。`); }

  const weekly = weeklyStatus(state, exerciseById, today);
  const over = weekly.filter(w => w.status === 'over');
  if (over.length) {
    score += over.length >= 2 ? 2 : 1;
    reasons.push(`${over.map(w => w.muscle.name).join('・')}が回復可能量（MRV）を超えています。`);
  }

  const stalled = stalledExercises(state, exerciseById);
  if (stalled.length >= 3) { score += 2; reasons.push(`${stalled.length}種目で伸びが止まっています。`); }
  else if (stalled.length >= 1) { score += 1; reasons.push(`${stalled.map(s => s.ex.name).slice(0, 3).join('・')}が停滞気味です。`); }

  // 直近のセッションRPEが高止まり
  const recent = sortedSessions(state).slice(0, 4).map(s => s.sessionRpe).filter(v => v != null);
  if (recent.length >= 3 && recent.reduce((a, b) => a + b, 0) / recent.length >= 9) {
    score += 2; reasons.push('直近のセッションが連続してRPE9以上。疲労が抜けていません。');
  }

  return {
    recommended: score >= 3,
    watch: score === 2,
    score, reasons, stalled,
    plan: [
      'セット数を通常の50〜60%に減らす（種目は変えない）',
      '重量は通常の90%前後、RIRは3以上を保つ',
      '1週間続けたら元のボリュームに戻す',
      '睡眠と食事を通常どおり確保する'
    ]
  };
}

/** ホーム画面に出す短い気づき */
export function insights(state, exerciseById, today) {
  const out = [];
  const weekly = weeklyStatus(state, exerciseById, today);

  const under = weekly.filter(w => w.muscle.mev > 0 && w.sets < w.muscle.mev * 0.5);
  if (under.length && state.sessions.length >= 3) {
    out.push({
      level: 'info', icon: '📉',
      text: `今週は${under.slice(0, 3).map(w => w.muscle.name).join('・')}のボリュームが不足しています。`
    });
  }

  const over = weekly.filter(w => w.status === 'over');
  if (over.length) {
    out.push({ level: 'warn', icon: '⚠️', text: `${over.map(w => w.muscle.name).join('・')}が回復可能量を超えています。次回は減らしましょう。` });
  }

  const fresh = freshness(state, exerciseById, new Date(today + 'T12:00:00'))
    .filter(f => f.lastDate && f.daysSince >= 10 && f.muscle.mev > 0);
  if (fresh.length) {
    out.push({ level: 'info', icon: '🕳️', text: `${fresh.slice(0, 3).map(f => f.muscle.name).join('・')}を10日以上鍛えていません。` });
  }

  const dl = deloadSuggestion(state, exerciseById, today);
  if (dl.recommended) out.push({ level: 'warn', icon: '🛑', text: 'デロード（回復週）をおすすめします。分析タブで詳細を確認できます。' });

  const last7 = state.sessions.filter(s => s.date > addDays(today, -7));
  if (last7.length >= 5) out.push({ level: 'good', icon: '🔥', text: `直近7日で${last7.length}回。素晴らしいペースです。` });

  return out;
}

/** 全期間のPR一覧（種目別に最良の推定1RM） */
export function allTimePRs(state, exerciseById, limit = 30) {
  const ids = new Set();
  for (const s of state.sessions) for (const e of s.entries || []) ids.add(e.exId);
  const out = [];
  for (const id of ids) {
    const ex = exerciseById(id);
    if (!ex) continue;
    let best = 0, bestSet = null, bestDate = null;
    for (const { session, entry } of historyFor(state, id, 9999)) {
      for (const s of workSets(entry)) {
        const est = e1rm(s.w, s.reps, s.rir ?? 0);
        if (est > best) { best = est; bestSet = s; bestDate = session.date; }
      }
    }
    if (best > 0) out.push({ ex, e1rm: best, set: bestSet, date: bestDate });
  }
  return out.sort((a, b) => b.e1rm - a.e1rm).slice(0, limit);
}

