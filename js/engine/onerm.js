// 1RM（最大挙上重量）の推定と、そこからの逆算。

export const epley = (w, reps) => (reps <= 1 ? w : w * (1 + reps / 30));
export const brzycki = (w, reps) => (reps <= 1 ? w : w * 36 / (37 - Math.min(reps, 36)));

/**
 * 推定1RM。RIR（あと何回できたか）が分かっている場合は
 * 「実際に限界までやっていたら何回だったか」に換算してから推定する。
 * これにより、余力を残したセットでも進捗を正しく比較できる。
 */
export function e1rm(weight, reps, rir = 0) {
  const w = Number(weight), r = Number(reps);
  if (!isFinite(w) || !isFinite(r) || w <= 0 || r <= 0) return 0;
  const effective = Math.min(r + (Number(rir) || 0), 20);
  // 低レップは Brzycki、高レップは Epley のほうが実測に近いので平均を取る
  const v = (epley(w, effective) + brzycki(w, effective)) / 2;
  return Math.round(v * 10) / 10;
}

/** 推定1RM から、指定レップ数を狙える重量を逆算する */
export function weightForReps(oneRM, reps) {
  if (!oneRM || reps <= 0) return 0;
  if (reps === 1) return oneRM;
  const a = oneRM / (1 + reps / 30);
  const b = oneRM * (37 - Math.min(reps, 36)) / 36;
  return Math.round(((a + b) / 2) * 10) / 10;
}

/** 指定重量で何回できそうか */
export function repsAtWeight(oneRM, weight) {
  if (!oneRM || !weight || weight >= oneRM) return 1;
  return Math.max(1, Math.round(30 * (oneRM / weight - 1)));
}

/** 重量が1RMの何%か */
export const pctOf1RM = (weight, oneRM) => (oneRM > 0 ? Math.round(weight / oneRM * 100) : 0);

/** セット単位のボリューム（重量×回数）。自重種目は体重を足して概算する。 */
export function setVolume(set, ex, bodyWeight = 70) {
  if (!set || !set.done) return 0;
  if (ex?.time) return 0; // 時間種目はボリュームに含めない
  const base = ex?.bw ? (bodyWeight * bodyweightFactor(ex) + (Number(set.w) || 0)) : (Number(set.w) || 0);
  return base * (Number(set.reps) || 0);
}

/** 自重種目で実際に扱っている体重の割合のざっくり係数 */
export function bodyweightFactor(ex) {
  switch (ex?.id) {
    case 'pushup': case 'wide_pushup': case 'diamond_pushup': return 0.64;
    case 'incline_pushup': return 0.5;
    case 'decline_pushup': return 0.7;
    case 'pullup': case 'chinup': case 'neutral_pullup': case 'dips': return 1;
    case 'inverted_row': return 0.55;
    case 'bench_dip': return 0.55;
    default: return ex?.pattern === 'core' ? 0.4 : 0.6;
  }
}

/** 自重種目の「実質的な負荷」。アシストマシンはマイナス扱い。 */
export function effectiveLoad(set, ex, bodyWeight = 70) {
  const w = Number(set?.w) || 0;
  if (ex?.assist) return Math.max(0, bodyWeight - w);
  if (ex?.bw) return bodyWeight * bodyweightFactor(ex) + w;
  return w;
}
