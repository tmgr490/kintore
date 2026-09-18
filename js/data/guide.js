// トレーニング理論の参照データと、目的別のパラメータ。

// 目的プリセット。セッションの既定レップ域・休憩・目標RIRを決める。
export const GOALS = [
  {
    id: 'strength', name: '筋力アップ', icon: '🏋️',
    intensity: '85〜95% 1RM', reps: [1, 5], rest: [180, 300], rir: 1, sets: [4, 6],
    desc: '神経系の適応が主。高重量・低レップ・長い休憩。ボリュームより強度を優先する。'
  },
  {
    id: 'hypertrophy', name: '筋肥大', icon: '💪',
    intensity: '65〜80% 1RM', reps: [6, 12], rest: [90, 180], rir: 2, sets: [3, 5],
    desc: '限界近くまで追い込んだ「有効なセット数」がものを言う。週あたりのボリュームが最重要。'
  },
  {
    id: 'endurance', name: '筋持久力', icon: '🔥',
    intensity: '50〜65% 1RM', reps: [15, 25], rest: [30, 60], rir: 1, sets: [2, 4],
    desc: '軽めの重量を高レップで。休憩は短く、代謝ストレスを高める。'
  },
  {
    id: 'power', name: 'パワー・瞬発力', icon: '⚡',
    intensity: '30〜60% 1RM', reps: [3, 6], rest: [120, 240], rir: 4, sets: [3, 6],
    desc: '速度がすべて。速度が落ちた時点でセットを終える。疲労を溜めない。'
  },
  {
    id: 'general', name: '健康・体型維持', icon: '🌱',
    intensity: '60〜75% 1RM', reps: [8, 15], rest: [60, 120], rir: 3, sets: [2, 4],
    desc: '無理なく続けることが最優先。限界の手前で止め、翌日に残さない。'
  }
];

export const GOAL_BY_ID = Object.fromEntries(GOALS.map(g => [g.id, g]));

// %1RM と反復可能回数の対応（Epley 系の換算表）
export const RM_TABLE = [
  { pct: 100, reps: 1 }, { pct: 95, reps: 2 }, { pct: 93, reps: 3 }, { pct: 90, reps: 4 },
  { pct: 87, reps: 5 }, { pct: 85, reps: 6 }, { pct: 83, reps: 7 }, { pct: 80, reps: 8 },
  { pct: 77, reps: 9 }, { pct: 75, reps: 10 }, { pct: 70, reps: 12 }, { pct: 67, reps: 14 },
  { pct: 65, reps: 15 }, { pct: 60, reps: 18 }, { pct: 55, reps: 22 }, { pct: 50, reps: 25 }
];

// RIR（Reps In Reserve = あと何回できたか）と RPE の対応
export const RIR_TABLE = [
  { rir: 0, rpe: 10, label: '限界。もう1回も上がらない', note: '毎セットここまでやると回復が追いつかない。最終セットだけに留める。' },
  { rir: 1, rpe: 9,  label: 'あと1回',   note: '筋肥大に最も効率が良いゾーンの下限。' },
  { rir: 2, rpe: 8,  label: 'あと2回',   note: '筋肥大の基本。ほとんどのセットはここでよい。' },
  { rir: 3, rpe: 7,  label: 'あと3回',   note: 'ボリューム稼ぎ・フォーム習得・デロード時。' },
  { rir: 4, rpe: 6,  label: 'あと4回以上', note: 'ウォームアップやパワー種目。刺激としては弱い。' }
];

// 週あたりボリュームの考え方
export const VOLUME_CONCEPTS = [
  { key: 'MV',  name: '維持ボリューム',   desc: '筋量を減らさないための最低ライン。忙しい時期はここまで落としてよい。' },
  { key: 'MEV', name: '最低有効ボリューム', desc: 'ここを超えて初めて筋肥大が起きる。週あたりの直接セット数の下限。' },
  { key: 'MAV', name: '最大適応ボリューム', desc: '最も伸びやすいゾーン。多くの部位で週10〜20セット。' },
  { key: 'MRV', name: '最大回復可能ボリューム', desc: 'これを超えると回復が追いつかず、パフォーマンスが落ちる。デロードの合図。' }
];

export const PRINCIPLES = [
  { title: '漸進性過負荷', body: '毎回わずかでも「前回より多く」を積む。重量・回数・セット数・可動域・テンポのどれでもよい。このアプリは前回の記録から次の目標を自動で出す。' },
  { title: '特異性', body: '目的に応じた負荷でしか目的の適応は起きない。筋力が欲しいなら重く、サイズが欲しいならボリュームを。' },
  { title: '回復', body: '筋肉は休んでいる間に育つ。睡眠7〜9時間、体重1kgあたり1.6〜2.2gのタンパク質が土台。' },
  { title: '継続', body: '完璧な1ヶ月より、そこそこの1年。予定通りに行かない日は種目を減らしてでも「行く」ほうが強い。' },
  { title: '疲労管理', body: '4〜8週ごとにボリュームを半分に落とすデロード週を入れる。停滞したら足すのではなく、まず抜く。' }
];

// 部位別のクールダウン／ストレッチ
export const STRETCHES = {
  chest:      [{ name: 'ドアフレーム胸ストレッチ', sec: 30, note: '肘を肩の高さで壁につけ、体を前に' }],
  lats:       [{ name: 'ラットストレッチ（バーにぶら下がる）', sec: 30, note: '肩を脱力して伸ばす' }],
  upper_back: [{ name: 'キャットストレッチ', sec: 30, note: '四つ這いで背中を丸める' }],
  traps:      [{ name: '首の側屈ストレッチ', sec: 20, note: '反対の手を頭に添えてゆっくり' }],
  front_delt: [{ name: '肩の水平外転ストレッチ', sec: 20, note: '手を後ろで組んで胸を開く' }],
  side_delt:  [{ name: 'クロスボディ肩ストレッチ', sec: 20, note: '腕を体の前で横切らせる' }],
  rear_delt:  [{ name: 'スリーパーストレッチ', sec: 20, note: '横向きに寝て肩を内旋' }],
  biceps:     [{ name: '壁に手をついて二頭を伸ばす', sec: 20, note: '腕を後ろに伸ばして体を回す' }],
  triceps:    [{ name: 'オーバーヘッド三頭ストレッチ', sec: 20, note: '肘を頭の後ろに引く' }],
  forearms:   [{ name: '手首の屈曲・伸展ストレッチ', sec: 20, note: '各方向20秒ずつ' }],
  abs:        [{ name: 'コブラのポーズ', sec: 30, note: 'うつ伏せから上体を反らす' }],
  obliques:   [{ name: '立位サイドベンドストレッチ', sec: 20, note: '左右それぞれ' }],
  lower_back: [{ name: 'チャイルドポーズ', sec: 45, note: '呼吸を止めない' }],
  glutes:     [{ name: 'ピジョンポーズ（鳩のポーズ）', sec: 30, note: '左右それぞれ' }],
  quads:      [{ name: '立位大腿四頭筋ストレッチ', sec: 30, note: '骨盤を立てて膝を後ろへ' }],
  hamstrings: [{ name: '前屈ハムストリングストレッチ', sec: 30, note: '背中を丸めず股関節から曲げる' }],
  adductors:  [{ name: '開脚（バタフライ）ストレッチ', sec: 30, note: '' }],
  calves:     [{ name: '壁押しふくらはぎストレッチ', sec: 30, note: '膝を伸ばした版と曲げた版で各30秒' }],
  neck:       [{ name: '首の回旋ストレッチ', sec: 20, note: 'ゆっくり左右へ' }]
};

// セッション前の一般的なウォームアップ
export const GENERAL_WARMUP = [
  { name: '軽い有酸素（バイク・ウォーキング）', sec: 300, note: '心拍と体温を上げる' },
  { name: 'アームサークル / レッグスイング', sec: 60, note: '動的ストレッチ。静的ストレッチは筋トレ前には不向き' },
  { name: 'ヒップサークル / キャットカウ', sec: 60, note: '股関節と背骨を動かす' }
];
