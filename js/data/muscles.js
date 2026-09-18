// 部位マスタ。ボリューム集計・回復推定・バランス分析の基準になる。
// mev/mav/mrv は「週あたりの直接セット数」の目安（Israetel らの推奨レンジを丸めたもの）。
// recovery は完全回復までのおおよその時間（時間単位）。小さい筋群ほど回復が早い。

export const MUSCLES = [
  { id: 'chest',      name: '胸',           short: '胸',   group: 'upper', side: 'front', mev: 8,  mav: 16, mrv: 22, recovery: 60 },
  { id: 'lats',       name: '広背筋',       short: '広背', group: 'upper', side: 'back',  mev: 10, mav: 18, mrv: 25, recovery: 60 },
  { id: 'upper_back', name: '背中上部',     short: '背上', group: 'upper', side: 'back',  mev: 8,  mav: 18, mrv: 25, recovery: 48 },
  { id: 'traps',      name: '僧帽筋',       short: '僧帽', group: 'upper', side: 'back',  mev: 4,  mav: 12, mrv: 20, recovery: 40 },
  { id: 'front_delt', name: '三角筋前部',   short: '肩前', group: 'upper', side: 'front', mev: 0,  mav: 8,  mrv: 12, recovery: 48 },
  { id: 'side_delt',  name: '三角筋中部',   short: '肩中', group: 'upper', side: 'front', mev: 8,  mav: 18, mrv: 26, recovery: 40 },
  { id: 'rear_delt',  name: '三角筋後部',   short: '肩後', group: 'upper', side: 'back',  mev: 6,  mav: 14, mrv: 22, recovery: 40 },
  { id: 'biceps',     name: '上腕二頭筋',   short: '二頭', group: 'upper', side: 'front', mev: 6,  mav: 14, mrv: 20, recovery: 48 },
  { id: 'triceps',    name: '上腕三頭筋',   short: '三頭', group: 'upper', side: 'back',  mev: 6,  mav: 14, mrv: 20, recovery: 48 },
  { id: 'forearms',   name: '前腕',         short: '前腕', group: 'upper', side: 'front', mev: 2,  mav: 10, mrv: 16, recovery: 36 },
  { id: 'abs',        name: '腹直筋',       short: '腹',   group: 'core',  side: 'front', mev: 0,  mav: 12, mrv: 20, recovery: 36 },
  { id: 'obliques',   name: '腹斜筋',       short: '腹斜', group: 'core',  side: 'front', mev: 0,  mav: 8,  mrv: 14, recovery: 36 },
  { id: 'lower_back', name: '脊柱起立筋',   short: '起立', group: 'core',  side: 'back',  mev: 4,  mav: 10, mrv: 16, recovery: 72 },
  { id: 'glutes',     name: '臀筋',         short: '臀',   group: 'lower', side: 'back',  mev: 0,  mav: 12, mrv: 18, recovery: 60 },
  { id: 'quads',      name: '大腿四頭筋',   short: '大腿', group: 'lower', side: 'front', mev: 8,  mav: 16, mrv: 22, recovery: 72 },
  { id: 'hamstrings', name: 'ハムストリング', short: 'ハム', group: 'lower', side: 'back', mev: 6, mav: 14, mrv: 20, recovery: 72 },
  { id: 'adductors',  name: '内転筋',       short: '内転', group: 'lower', side: 'front', mev: 0,  mav: 8,  mrv: 12, recovery: 60 },
  { id: 'calves',     name: 'ふくらはぎ',   short: 'ふく', group: 'lower', side: 'back',  mev: 8,  mav: 16, mrv: 22, recovery: 36 },
  { id: 'neck',       name: '首',           short: '首',   group: 'upper', side: 'front', mev: 0,  mav: 8,  mrv: 12, recovery: 36 }
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map(m => [m.id, m]));

export const muscleName = id => MUSCLE_BY_ID[id]?.name || id;
export const muscleShort = id => MUSCLE_BY_ID[id]?.short || id;

// 大きなくくり（画面の絞り込み用）
export const MUSCLE_GROUPS = [
  { id: 'chest',     name: '胸',   members: ['chest'] },
  { id: 'back',      name: '背中', members: ['lats', 'upper_back', 'traps', 'lower_back'] },
  { id: 'shoulders', name: '肩',   members: ['front_delt', 'side_delt', 'rear_delt'] },
  { id: 'arms',      name: '腕',   members: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs',      name: '脚',   members: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
  { id: 'core',      name: '体幹', members: ['abs', 'obliques'] },
  { id: 'other',     name: 'その他', members: ['neck'] }
];

export const groupOf = muscleId =>
  MUSCLE_GROUPS.find(g => g.members.includes(muscleId))?.id || 'other';

// 動作パターン（代替種目の提案とバランス分析に使う）
export const PATTERNS = {
  push_h: { name: '水平プッシュ', axis: 'push' },
  push_v: { name: '垂直プッシュ', axis: 'push' },
  pull_h: { name: '水平プル',     axis: 'pull' },
  pull_v: { name: '垂直プル',     axis: 'pull' },
  squat:  { name: 'スクワット',   axis: 'legs' },
  hinge:  { name: 'ヒンジ',       axis: 'legs' },
  lunge:  { name: 'ランジ',       axis: 'legs' },
  iso:    { name: '単関節',       axis: 'iso' },
  core:   { name: '体幹',         axis: 'core' },
  carry:  { name: 'キャリー',     axis: 'core' }
};

export const EQUIPMENT = {
  barbell:    'バーベル',
  dumbbell:   'ダンベル',
  machine:    'マシン',
  cable:      'ケーブル',
  bodyweight: '自重',
  smith:      'スミス',
  ez:         'EZバー',
  kettlebell: 'ケトルベル',
  band:       'バンド',
  plate:      'プレート'
};
