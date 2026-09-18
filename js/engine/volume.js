// 部位別ボリューム集計・回復度の推定・筋肉バランス分析。

import { MUSCLES, MUSCLE_BY_ID, PATTERNS } from '../data/muscles.js';
import { workSets, weekStart, addDays, daysBetween } from './history.js';
import { effectiveLoad } from './onerm.js';

// 主働筋は1セット、補助筋は0.5セットとして数える（一般的な換算）
const SECONDARY_WEIGHT = 0.5;

/** 1エントリが各部位に与えるセット数 */
export function entrySets(entry, ex) {
  const n = workSets(entry).length;
  if (!ex || n === 0) return {};
  const out = { [ex.muscle]: n };
  for (const m of ex.sub || []) out[m] = (out[m] || 0) + n * SECONDARY_WEIGHT;
  return out;
}

/** 期間内の部位別セット数 */
export function setsByMuscle(state, exerciseById, from, to) {
  const totals = {};
  for (const s of state.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const entry of s.entries || []) {
      const ex = exerciseById(entry.exId);
      const add = entrySets(entry, ex);
      for (const [m, v] of Object.entries(add)) totals[m] = (totals[m] || 0) + v;
    }
  }
  return totals;
}

/** 期間内の部位別トン数（重量×回数の合計） */
export function tonnageByMuscle(state, exerciseById, from, to, bodyWeight = 70) {
  const totals = {};
  for (const s of state.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const entry of s.entries || []) {
      const ex = exerciseById(entry.exId);
      if (!ex || ex.time) continue;
      let vol = 0;
      for (const set of workSets(entry)) vol += effectiveLoad(set, ex, bodyWeight) * (set.reps || 0);
      totals[ex.muscle] = (totals[ex.muscle] || 0) + vol;
      for (const m of ex.sub || []) totals[m] = (totals[m] || 0) + vol * SECONDARY_WEIGHT;
    }
  }
  return totals;
}

/** 今週（月曜はじまり）の部位別セット数と MEV/MAV に対する達成度 */
export function weeklyStatus(state, exerciseById, today) {
  const from = weekStart(today);
  const to = addDays(from, 6);
  const sets = setsByMuscle(state, exerciseById, from, to);
  return MUSCLES.map(m => {
    const done = Math.round((sets[m.id] || 0) * 10) / 10;
    let status = 'under';
    if (done >= m.mrv) status = 'over';
    else if (done >= m.mav) status = 'high';
    else if (done >= m.mev) status = 'ok';
    else if (done > 0) status = 'low';
    return { muscle: m, sets: done, status, pct: m.mav > 0 ? Math.min(150, Math.round(done / m.mav * 100)) : 0 };
  });
}

/**
 * 部位ごとの「鮮度（回復度）」。
 * 最後に刺激を受けてからの経過時間と、その時のボリュームから 0〜100 で推定する。
 * 100 = 完全回復（今日鍛えるべき）／0 = まだ回復中。
 */
export function freshness(state, exerciseById, now = new Date()) {
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const last = {}; // muscleId -> { date, sets }

  for (const s of state.sessions) {
    if (s.date > todayStr) continue;
    for (const entry of s.entries || []) {
      const ex = exerciseById(entry.exId);
      const add = entrySets(entry, ex);
      for (const [m, v] of Object.entries(add)) {
        if (!last[m] || s.date > last[m].date) last[m] = { date: s.date, sets: v, endedAt: s.endedAt };
        else if (s.date === last[m].date) last[m].sets += v;
      }
    }
  }

  return MUSCLES.map(m => {
    const rec = last[m.id];
    if (!rec) {
      return { muscle: m, lastDate: null, daysSince: null, recovery: 100, lastSets: 0, label: '未実施' };
    }
    const days = daysBetween(rec.date, todayStr);
    const hours = rec.endedAt
      ? Math.max(0, (now.getTime() - new Date(rec.endedAt).getTime()) / 3600000)
      : days * 24 + 12;
    // ボリュームが多いほど回復に時間がかかる（MAV を基準に ±50% まで伸縮）
    const load = m.mav > 0 ? Math.min(2, rec.sets / (m.mav / 2)) : 1;
    const needed = m.recovery * (0.6 + 0.4 * load);
    const recovery = Math.max(0, Math.min(100, Math.round(hours / needed * 100)));
    return {
      muscle: m, lastDate: rec.date, daysSince: days, lastSets: Math.round(rec.sets * 10) / 10,
      recovery,
      label: recovery >= 100 ? '回復済み' : recovery >= 70 ? 'ほぼ回復' : recovery >= 40 ? '回復中' : '疲労'
    };
  });
}

/** 押す／引く・前面／背面・上半身／下半身のバランス */
export function balance(state, exerciseById, from, to) {
  let push = 0, pull = 0, front = 0, back = 0, upper = 0, lower = 0, core = 0;
  for (const s of state.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const entry of s.entries || []) {
      const ex = exerciseById(entry.exId);
      if (!ex) continue;
      const n = workSets(entry).length;
      if (!n) continue;
      const axis = PATTERNS[ex.pattern]?.axis;
      if (axis === 'push') push += n;
      else if (axis === 'pull') pull += n;

      const m = MUSCLE_BY_ID[ex.muscle];
      if (m) {
        if (m.side === 'front') front += n; else back += n;
        if (m.group === 'upper') upper += n;
        else if (m.group === 'lower') lower += n;
        else core += n;
      }
    }
  }
  const ratio = (a, b) => (b > 0 ? Math.round(a / b * 100) / 100 : a > 0 ? Infinity : 1);
  return {
    push, pull, front, back, upper, lower, core,
    pushPull: ratio(push, pull),
    frontBack: ratio(front, back),
    upperLower: ratio(upper, lower)
  };
}

/** バランスから助言を出す */
export function balanceAdvice(b) {
  const tips = [];
  if (b.push + b.pull >= 8) {
    if (b.pushPull > 1.3) tips.push({ level: 'warn', text: '押す種目が引く種目より多すぎます。巻き肩・肩の痛みの原因になるので、ロウやフェイスプルを増やしましょう。' });
    else if (b.pushPull < 0.7) tips.push({ level: 'info', text: '引く種目が多めです。姿勢には良い配分ですが、胸や肩のプレス系も確保しましょう。' });
    else tips.push({ level: 'good', text: '押す／引くのバランスは良好です。' });
  }
  if (b.upper + b.lower >= 10) {
    if (b.upperLower > 2.2) tips.push({ level: 'warn', text: '下半身のボリュームが不足しています。スクワットやヒンジ系を週2回は入れましょう。' });
    else if (b.upperLower < 0.6) tips.push({ level: 'info', text: '上半身が手薄です。プレスとロウを足しましょう。' });
  }
  if (b.core === 0 && b.upper + b.lower >= 10) {
    tips.push({ level: 'info', text: '体幹の直接種目がゼロです。プランクやアブローラーを週2回入れると腰が守られます。' });
  }
  return tips;
}
