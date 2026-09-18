// プログラムテンプレートをユーザーのルーティン＋週間スケジュールに展開する。

import { uid } from '../store.js';
import { PROGRAM_TEMPLATES } from '../data/programs.js';

export function templateById(id) {
  return PROGRAM_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * テンプレートを state に適用する。既存のルーティンは置き換える。
 * @param {object} s store の state（update の中で呼ぶ）
 */
export function applyProgram(s, template) {
  if (!template) return;
  const map = {};
  s.routines = template.routines.map(r => {
    const id = uid();
    map[r.key] = id;
    return {
      id, name: r.name, programId: template.id, key: r.key,
      items: r.items.map(i => ({ ...i }))
    };
  });
  s.schedule = template.schedule.map(k => (k ? map[k] || null : null));
  s.programId = template.id;
}

/** 空のルーティンを作る */
export function blankRoutine(name = '新しいメニュー') {
  return { id: uid(), name, programId: null, items: [] };
}

/** 種目リストから週あたりの部位別セット数を見積もる（プログラム選択画面用） */
export function estimateWeeklySets(template, exerciseById) {
  const totals = {};
  template.schedule.forEach(key => {
    if (!key) return;
    const r = template.routines.find(x => x.key === key);
    if (!r) return;
    for (const it of r.items) {
      const ex = exerciseById(it.exId);
      if (!ex) continue;
      totals[ex.muscle] = (totals[ex.muscle] || 0) + it.sets;
      for (const m of ex.sub || []) totals[m] = (totals[m] || 0) + it.sets * 0.5;
    }
  });
  return totals;
}
