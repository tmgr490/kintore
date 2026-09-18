// 器具プロファイルに基づく「実際に作れる重量」への丸めと、プレートの積み方の計算。

/** その種目で扱える最小の刻み幅（kg） */
export function increment(ex, gym) {
  if (!ex) return 2.5;
  switch (ex.equip) {
    case 'dumbbell':
    case 'kettlebell':
      return gym?.dumbbell?.step || 2.5;
    case 'machine':
      return gym?.machineStep || 2.5;
    case 'cable':
      return gym?.cableStep || 2.5;
    case 'barbell':
    case 'smith':
    case 'ez':
    case 'plate': {
      const smallest = smallestPlate(gym);
      return smallest * 2;
    }
    case 'bodyweight':
      return 1.25;
    default:
      return 2.5;
  }
}

function smallestPlate(gym) {
  const list = (gym?.plates || []).filter(p => p.count > 0).map(p => Number(p.w)).filter(w => w > 0);
  return list.length ? Math.min(...list) : 1.25;
}

/** その種目のバー重量（バーを使わない種目は0） */
export function barWeight(ex, gym) {
  if (!ex) return 0;
  if (ex.bar) return ex.bar === 7.5 ? (gym?.ezBarWeight ?? 7.5) : ex.bar;
  if (ex.equip === 'barbell') return gym?.barWeight ?? 20;
  if (ex.equip === 'smith') return 15;
  if (ex.equip === 'ez') return gym?.ezBarWeight ?? 7.5;
  return 0;
}

/** ダンベルで実際に用意されている重量の一覧 */
export function dumbbellRack(gym) {
  const { min = 2, max = 50, step = 2.5 } = gym?.dumbbell || {};
  const out = [];
  for (let w = min; w <= max + 1e-9; w += step) out.push(Math.round(w * 100) / 100);
  return out;
}

/**
 * 希望重量を、その器具で実際に作れる重量に丸める。
 * dir: 'near'（近い方）| 'down'（切り下げ）| 'up'（切り上げ）
 */
export function roundWeight(target, ex, gym, dir = 'near') {
  const t = Number(target);
  if (!isFinite(t) || t <= 0) return 0;
  if (!ex) return round(t, 2.5, dir);

  if (ex.equip === 'dumbbell' || ex.equip === 'kettlebell') {
    const rack = dumbbellRack(gym);
    if (!rack.length) return round(t, 2.5, dir);
    return pickFromList(t, rack, dir);
  }

  const bar = barWeight(ex, gym);
  if (bar > 0) {
    const options = barLoadOptions(bar, gym);
    return pickFromList(t, options, dir);
  }

  return round(t, increment(ex, gym), dir);
}

function round(v, step, dir) {
  if (!step) return Math.round(v * 100) / 100;
  const n = v / step;
  const k = dir === 'down' ? Math.floor(n + 1e-9) : dir === 'up' ? Math.ceil(n - 1e-9) : Math.round(n);
  return Math.round(k * step * 100) / 100;
}

function pickFromList(t, list, dir) {
  const sorted = [...list].sort((a, b) => a - b);
  if (dir === 'down') {
    const below = sorted.filter(v => v <= t + 1e-9);
    return below.length ? below[below.length - 1] : sorted[0];
  }
  if (dir === 'up') {
    const above = sorted.filter(v => v >= t - 1e-9);
    return above.length ? above[0] : sorted[sorted.length - 1];
  }
  let best = sorted[0];
  for (const v of sorted) if (Math.abs(v - t) < Math.abs(best - t)) best = v;
  return best;
}

let optCache = new WeakMap();
/** 手持ちのプレートで組める総重量の一覧（バー重量込み） */
function barLoadOptions(bar, gym) {
  const plates = (gym?.plates || []).filter(p => p.w > 0 && p.count > 0);
  const cacheKey = gym || {};
  const cached = optCache.get(cacheKey);
  if (cached && cached.bar === bar) return cached.list;

  // 片側に乗せられる重量の集合（部分和）
  let sums = new Set([0]);
  for (const p of plates) {
    const pairs = Math.floor(p.count / 2); // 左右に同じだけ積むのでペア単位
    const next = new Set(sums);
    for (const s of sums) {
      for (let n = 1; n <= pairs; n++) {
        const v = Math.round((s + p.w * n) * 100) / 100;
        if (v > 400) break;
        next.add(v);
      }
    }
    sums = next;
  }
  const list = [...sums].map(s => Math.round((bar + s * 2) * 100) / 100).sort((a, b) => a - b);
  optCache.set(cacheKey, { bar, list });
  return list;
}

export function invalidatePlateCache() { optCache = new WeakMap(); }

/**
 * バーに乗せるプレートの内訳（片側）を計算する。
 * @returns {{bar:number, perSide:Array<{w:number,n:number}>, achieved:number, diff:number}|null}
 */
export function plateBreakdown(total, ex, gym) {
  const bar = barWeight(ex, gym);
  if (bar <= 0) return null;
  let remainPerSide = (Number(total) - bar) / 2;
  if (remainPerSide < -1e-9) return { bar, perSide: [], achieved: bar, diff: Number(total) - bar, tooLight: true };

  const plates = (gym?.plates || [])
    .filter(p => p.w > 0 && p.count >= 2)
    .map(p => ({ w: Number(p.w), pairs: Math.floor(p.count / 2) }))
    .sort((a, b) => b.w - a.w);

  const perSide = [];
  for (const p of plates) {
    const n = Math.min(p.pairs, Math.floor((remainPerSide + 1e-9) / p.w));
    if (n > 0) {
      perSide.push({ w: p.w, n });
      remainPerSide = Math.round((remainPerSide - p.w * n) * 100) / 100;
    }
  }
  const achieved = Math.round((bar + perSide.reduce((s, p) => s + p.w * p.n, 0) * 2) * 100) / 100;
  return { bar, perSide, achieved, diff: Math.round((achieved - Number(total)) * 100) / 100 };
}

/** 「82.5kg」のような表示用文字列 */
export function fmtWeight(w, units = 'kg') {
  const n = Number(w) || 0;
  const v = units === 'lb' ? n * 2.20462 : n;
  const s = Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  return s + (units === 'lb' ? 'lb' : 'kg');
}

export const KG_PER_LB = 0.45359237;
