// オートレギュレーション：その日のコンディションから負荷を自動調整する。

export const CONDITION_FIELDS = [
  { key: 'sleep',      label: '睡眠',     icon: '😴', low: '最悪', high: 'ぐっすり' },
  { key: 'fatigue',    label: '疲労感',   icon: '🔋', low: 'へとへと', high: '元気' },
  { key: 'stress',     label: 'ストレス', icon: '🧠', low: '限界',   high: '穏やか' },
  { key: 'motivation', label: 'やる気',   icon: '🔥', low: '皆無',   high: '最高' }
];

export const SORENESS_LEVELS = [
  { v: 0, label: 'なし' },
  { v: 1, label: '軽い' },
  { v: 2, label: '強い' },
  { v: 3, label: '動かすと痛い' }
];

export const defaultCondition = () => ({
  sleep: 3, fatigue: 3, stress: 3, motivation: 3, soreness: {}
});

/**
 * コンディションから「準備度スコア」（0〜100）を出す。
 * 睡眠と疲労を重く、やる気は軽く見る。
 */
export function readiness(cond) {
  if (!cond) return 70;
  const w = { sleep: 0.32, fatigue: 0.34, stress: 0.18, motivation: 0.16 };
  let score = 0;
  for (const [k, weight] of Object.entries(w)) {
    const v = Number(cond[k]);
    score += ((isFinite(v) ? v : 3) - 1) / 4 * 100 * weight;
  }
  // 強い筋肉痛がある部位数でさらに引く
  const bad = Object.values(cond.soreness || {}).filter(v => v >= 2).length;
  score -= Math.min(15, bad * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 準備度から、重量とセット数の調整倍率を決める。
 * 大きく上げることはしない（調子が良くても無理をさせない）。
 */
export function adjustment(cond) {
  const r = readiness(cond);
  let load, sets, label, tone;
  if (r >= 85) { load = 1.025; sets = 1.1;  label = '絶好調。攻めていい日です。'; tone = 'good'; }
  else if (r >= 70) { load = 1.0;   sets = 1.0;  label = '良好。予定どおり進めましょう。'; tone = 'good'; }
  else if (r >= 50) { load = 0.95;  sets = 0.9;  label = 'やや疲れ気味。重量を5%落として様子を見ましょう。'; tone = 'warn'; }
  else if (r >= 30) { load = 0.88;  sets = 0.75; label = '回復不足。軽めのボリュームに落として、動かすことを優先。'; tone = 'warn'; }
  else { load = 0.8; sets = 0.6; label = 'かなり消耗しています。今日は軽い日にするか、休むのも正解です。'; tone = 'bad'; }
  return { readiness: r, loadFactor: load, setFactor: sets, label, tone };
}

/**
 * 筋肉痛のある部位を鍛えるべきか判定する。
 * @returns {'ok'|'caution'|'avoid'}
 */
export function sorenessVerdict(cond, muscleId) {
  const v = cond?.soreness?.[muscleId] ?? 0;
  if (v >= 3) return 'avoid';
  if (v === 2) return 'caution';
  return 'ok';
}

/** セッション後の主観的強度（セッションRPE）から、次回への申し送りを作る */
export function sessionFeedback(sessionRpe, plannedSets, doneSets) {
  const completion = plannedSets > 0 ? doneSets / plannedSets : 1;
  if (sessionRpe >= 9.5) {
    return { tone: 'warn', nextSetFactor: 0.9, text: '限界まで追い込みました。次回は同じボリュームを維持し、増やすのは回復してからに。' };
  }
  if (sessionRpe >= 8) {
    return { tone: 'good', nextSetFactor: 1.0, text: 'ちょうど良い追い込み具合です。この強度を維持しましょう。' };
  }
  if (sessionRpe >= 6) {
    return { tone: 'good', nextSetFactor: 1.05, text: 'まだ余力がありました。次回はセットを1つ、または重量を少し足せます。' };
  }
  if (completion < 0.7) {
    return { tone: 'warn', nextSetFactor: 1.0, text: '予定を消化しきれていません。種目数を絞って完走できる構成にしましょう。' };
  }
  return { tone: 'info', nextSetFactor: 1.1, text: '軽すぎたようです。次回は重量かセット数を増やしましょう。' };
}
