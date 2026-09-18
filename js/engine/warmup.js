// メインセットの重量から逆算してウォームアップセットを組み立てる。

import { roundWeight, barWeight } from './plates.js';
import { isCompound } from '../data/exercises.js';

/**
 * @param {number} workWeight メインセットで扱う重量
 * @param {object} ex 種目
 * @param {object} gym 器具プロファイル
 * @param {object} [opts] { goal }
 * @returns {Array<{w:number, reps:number, pct:number, note:string}>}
 */
export function buildWarmup(workWeight, ex, gym, opts = {}) {
  if (!ex || ex.time) return [];
  const target = Number(workWeight) || 0;
  const bar = barWeight(ex, gym);

  // 自重・アシスト種目は本番より軽くできないので回数を減らした1セットだけ
  if (ex.bw || ex.assist) {
    return [{ w: 0, reps: 5, pct: 0, note: '軽く動きを確認' }];
  }

  const compound = isCompound(ex);
  // 軽い重量のときはウォームアップは1本で足りる
  if (target <= Math.max(bar * 1.5, 20)) {
    if (bar > 0 && target > bar) {
      return [{ w: bar, reps: 10, pct: Math.round(bar / target * 100), note: 'バーのみ' }];
    }
    return [{ w: roundWeight(target * 0.5, ex, gym, 'down'), reps: 10, pct: 50, note: '' }];
  }

  const heavy = (opts.goal === 'strength') || target >= (bar || 20) * 4;
  const steps = compound
    ? (heavy ? [[0.4, 5], [0.6, 3], [0.75, 2], [0.88, 1]] : [[0.45, 6], [0.65, 4], [0.8, 2]])
    : [[0.5, 10], [0.75, 5]];

  const out = [];
  if (bar > 0 && compound) out.push({ w: bar, reps: 8, pct: Math.round(bar / target * 100), note: 'バーのみ' });

  let prev = bar;
  for (const [pct, reps] of steps) {
    const w = roundWeight(target * pct, ex, gym, 'down');
    if (w <= prev + 1e-9 || w >= target - 1e-9) continue;
    out.push({ w, reps, pct: Math.round(pct * 100), note: '' });
    prev = w;
  }
  return out;
}

/** ウォームアップ込みでかかるおおよその時間（秒） */
export function warmupDuration(sets) {
  return sets.reduce((s, x) => s + 30 + 45, 0);
}
