// 種目ライブラリ。
// 1行 = 1種目。編集しやすいようにパイプ区切りのテーブルで持ち、読み込み時にオブジェクト化する。
//
//  id | 名前 | 主動筋 | 補助筋(,) | 器具 | 動作パターン | フラグ(,) | 代替種目(,) | フォームのポイント(;)
//
// フラグ:
//   uni   … 片側ずつ行う種目（記録は片側の重量）
//   bw    … 自重種目。入力する重量は「追加した重量」（0なら自重のみ）
//   assist… アシストマシン。入力する重量は「補助重量」（大きいほど楽）
//   time  … 回数の代わりに秒数を記録する
//   bar20 / bar15 / bar10 / barez … バーの重量（プレート計算に使う）

import { MUSCLE_BY_ID } from './muscles.js';

const TABLE = `
bb_bench|ベンチプレス|chest|front_delt,triceps|barbell|push_h|bar20|db_bench,machine_chest_press,smith_bench,pushup|肩甲骨を寄せて下げたまま固定する;足で床を押して全身で支える;バーはみぞおちの少し上に下ろす
bb_incline_bench|インクラインベンチプレス|chest|front_delt,triceps|barbell|push_h|bar20|db_incline_bench,smith_bench,bb_bench|ベンチ角度は30〜45度;鎖骨のあたりに下ろす
bb_decline_bench|デクラインベンチプレス|chest|triceps|barbell|push_h|bar20|db_decline_bench,dips,bb_bench|みぞおちの下に下ろす
db_bench|ダンベルベンチプレス|chest|front_delt,triceps|dumbbell|push_h||bb_bench,machine_chest_press,db_incline_bench|可動域を深くとれるのが利点;手首を立てて肘の真上に保つ
db_incline_bench|インクラインダンベルプレス|chest|front_delt,triceps|dumbbell|push_h||bb_incline_bench,db_bench,machine_chest_press|上部を狙うなら角度30度前後が効率的
db_decline_bench|デクラインダンベルプレス|chest|triceps|dumbbell|push_h||bb_decline_bench,dips|
db_fly|ダンベルフライ|chest||dumbbell|iso||cable_fly,pec_deck,db_incline_fly|肘は軽く曲げたまま角度を変えない;胸のストレッチを感じるところで止める
db_incline_fly|インクラインダンベルフライ|chest||dumbbell|iso||cable_low_fly,db_fly,pec_deck|
cable_fly|ケーブルフライ|chest||cable|iso||db_fly,pec_deck,cable_high_fly|最後に手を交差させると収縮が強くなる
cable_low_fly|ローケーブルフライ|chest|front_delt|cable|iso||db_incline_fly,cable_fly|下から上へ、胸の上部を狙う
cable_high_fly|ハイケーブルフライ|chest||cable|iso||cable_fly,pec_deck|上から下へ、胸の下部を狙う
machine_chest_press|チェストプレス（マシン）|chest|front_delt,triceps|machine|push_h||bb_bench,db_bench,smith_bench|軌道が固定され追い込みやすい
pec_deck|ペックデック|chest||machine|iso||cable_fly,db_fly|
smith_bench|スミスベンチプレス（スミス）|chest|front_delt,triceps|smith|push_h|bar15|bb_bench,machine_chest_press|一人でも限界まで追い込みやすい
pushup|腕立て伏せ|chest|front_delt,triceps,abs|bodyweight|push_h|bw|bb_bench,db_bench,incline_pushup|体を一直線に保つ;肘は45度に開く
incline_pushup|インクライン腕立て伏せ|chest|front_delt,triceps|bodyweight|push_h|bw|pushup,machine_chest_press|手を高い位置に置くと軽くなる
decline_pushup|デクライン腕立て伏せ|chest|front_delt,triceps|bodyweight|push_h|bw|pushup,db_incline_bench|足を高くすると胸上部に効く
wide_pushup|ワイド腕立て伏せ|chest|front_delt|bodyweight|push_h|bw|pushup,db_fly|
diamond_pushup|ダイヤモンド腕立て伏せ|triceps|chest,front_delt|bodyweight|push_h|bw|close_grip_bench,pushdown,bench_dip|
dips|ディップス|chest|triceps,front_delt|bodyweight|push_h|bw|bb_decline_bench,bench_dip,close_grip_bench|前傾すると胸、直立すると三頭に効く;肩を痛めやすいので深く下ろしすぎない
db_pullover|ダンベルプルオーバー|chest|lats,triceps|dumbbell|iso||straight_arm_pulldown,cable_fly|肋骨を広げるイメージで大きく動かす

pullup|懸垂（順手）|lats|upper_back,biceps|bodyweight|pull_v|bw|lat_pulldown,assisted_pullup,chinup|肩を下げてから引く;顎ではなく胸をバーに近づける
chinup|懸垂（逆手）|lats|biceps,upper_back|bodyweight|pull_v|bw|pullup,lat_pulldown_close,bb_curl|二頭の関与が大きく、順手より挙がりやすい
neutral_pullup|パラレルグリップ懸垂|lats|biceps,upper_back|bodyweight|pull_v|bw|pullup,neutral_pulldown|肩が痛い人に一番やさしいグリップ
assisted_pullup|アシストチンニング|lats|biceps,upper_back|machine|pull_v|assist|pullup,lat_pulldown|補助重量が小さいほど高負荷
lat_pulldown|ラットプルダウン|lats|upper_back,biceps|machine|pull_v||pullup,neutral_pulldown,machine_row|胸を張って鎖骨に引きつける;反動を使わない
lat_pulldown_close|クロースグリップラットプルダウン|lats|biceps|machine|pull_v||chinup,lat_pulldown|
neutral_pulldown|パラレルグリッププルダウン|lats|upper_back,biceps|machine|pull_v||lat_pulldown,neutral_pullup|
straight_arm_pulldown|ストレートアームプルダウン|lats||cable|iso||db_pullover,lat_pulldown|肘を伸ばしたまま広背筋だけで引く
bb_row|ベントオーバーロウ|upper_back|lats,rear_delt,lower_back|barbell|pull_h|bar20|db_row,chest_supported_row,seated_cable_row|背中を丸めない;みぞおち〜へそに引く
pendlay_row|ペンドレイロウ|upper_back|lats,rear_delt|barbell|pull_h|bar20|bb_row,tbar_row|毎回床から引き直す。反動が使えず背中に効く
db_row|ワンハンドダンベルロウ|lats|upper_back,biceps|dumbbell|pull_h|uni|bb_row,seated_cable_row,machine_row|腰のほうへ引き上げる;体をひねらない
db_row_both|ダンベルロウ（両手）|upper_back|lats,rear_delt|dumbbell|pull_h||bb_row,chest_supported_row|
chest_supported_row|チェストサポーテッドロウ|upper_back|lats,rear_delt|machine|pull_h||bb_row,machine_row|腰への負担がなく背中に集中できる
tbar_row|Tバーロウ|upper_back|lats,rear_delt|barbell|pull_h||bb_row,chest_supported_row|
seated_cable_row|シーテッドロウ|upper_back|lats,biceps|cable|pull_h||machine_row,bb_row,chest_supported_row|上体を倒しすぎず、肩甲骨を寄せる
machine_row|マシンロウ|upper_back|lats,biceps|machine|pull_h||seated_cable_row,chest_supported_row|
inverted_row|インバーテッドロウ|upper_back|lats,biceps|bodyweight|pull_h|bw|seated_cable_row,bb_row|体を一直線に保つ
face_pull|フェイスプル|rear_delt|upper_back,traps|cable|iso||reverse_pec_deck,rear_delt_fly|肩の健康に効く。顔の高さで引いて外旋する
shrug|バーベルシュラッグ|traps||barbell|iso|bar20|db_shrug,rack_pull|真上に上げる。回さない
db_shrug|ダンベルシュラッグ|traps||dumbbell|iso||shrug|
rack_pull|ラックプル|traps|lats,lower_back,glutes|barbell|hinge|bar20|deadlift,shrug|膝上からのデッドリフト。高重量を扱える
back_extension|バックエクステンション|lower_back|glutes,hamstrings|bodyweight|hinge|bw|good_morning,romanian_deadlift|反りすぎない。水平で止める
good_morning|グッドモーニング|hamstrings|lower_back,glutes|barbell|hinge|bar20|romanian_deadlift,back_extension|軽い重量から。膝は軽く曲げる
deadlift|デッドリフト|lower_back|glutes,hamstrings,traps,lats|barbell|hinge|bar20|sumo_deadlift,rack_pull,romanian_deadlift|バーは脛に沿って真上に;背中を丸めない;床を押す意識
sumo_deadlift|スモウデッドリフト|glutes|quads,lower_back,adductors|barbell|hinge|bar20|deadlift,leg_press|足幅を広く、つま先を外へ
romanian_deadlift|ルーマニアンデッドリフト|hamstrings|glutes,lower_back|barbell|hinge|bar20|db_rdl,good_morning,leg_curl|膝はほぼ固定しお尻を後ろへ;ハムのストレッチで止める
db_rdl|ダンベルルーマニアンデッドリフト|hamstrings|glutes,lower_back|dumbbell|hinge||romanian_deadlift,leg_curl|
stiff_leg_deadlift|スティッフレッグデッドリフト|hamstrings|lower_back,glutes|barbell|hinge|bar20|romanian_deadlift,nordic_curl|

ohp|オーバーヘッドプレス|front_delt|side_delt,triceps,abs|barbell|push_v|bar20|db_shoulder_press,seated_ohp,machine_shoulder_press|お尻を締めて反り腰を防ぐ;顔の前を通して真上へ
seated_ohp|シーテッドバーベルショルダープレス|front_delt|side_delt,triceps|barbell|push_v|bar20|ohp,db_shoulder_press|
db_shoulder_press|ダンベルショルダープレス|front_delt|side_delt,triceps|dumbbell|push_v||ohp,machine_shoulder_press,arnold_press|肘を真下に落とし耳の横で構える
arnold_press|アーノルドプレス|front_delt|side_delt,triceps|dumbbell|push_v||db_shoulder_press,ohp|回旋しながら押す
machine_shoulder_press|マシンショルダープレス|front_delt|side_delt,triceps|machine|push_v||db_shoulder_press,ohp|
smith_ohp|スミスショルダープレス|front_delt|side_delt,triceps|smith|push_v|bar15|ohp,machine_shoulder_press|
push_press|プッシュプレス|front_delt|triceps,quads|barbell|push_v|bar20|ohp,thruster|膝の反動を使って高重量を頭上へ
lateral_raise|サイドレイズ|side_delt||dumbbell|iso||cable_lateral_raise,machine_lateral_raise,upright_row|小指をやや上に;反動を使わず肩の高さまで
cable_lateral_raise|ケーブルサイドレイズ|side_delt||cable|iso|uni|lateral_raise,machine_lateral_raise|下でも負荷が抜けない
machine_lateral_raise|マシンサイドレイズ|side_delt||machine|iso||lateral_raise,cable_lateral_raise|
lean_away_lateral|リーンアウェイサイドレイズ|side_delt||dumbbell|iso|uni|lateral_raise,cable_lateral_raise|体を傾けてストレッチを強める
front_raise|フロントレイズ|front_delt||dumbbell|iso||ohp,db_shoulder_press|プレス種目で十分なら優先度は低い
rear_delt_fly|リアレイズ|rear_delt|upper_back|dumbbell|iso||reverse_pec_deck,face_pull,cable_rear_delt|前傾して小指から上げる
reverse_pec_deck|リバースペックデック|rear_delt|upper_back|machine|iso||rear_delt_fly,face_pull|
cable_rear_delt|ケーブルリアデルト|rear_delt|upper_back|cable|iso|uni|rear_delt_fly,reverse_pec_deck|
upright_row|アップライトロウ|side_delt|traps,biceps|barbell|iso|bar20|lateral_raise,db_upright_row|肩がすくむ手前まで。痛みが出たら中止
db_upright_row|ダンベルアップライトロウ|side_delt|traps|dumbbell|iso||upright_row,lateral_raise|

bb_curl|バーベルカール|biceps|forearms|barbell|iso|bar20|ez_curl,db_curl,cable_curl|肘を体側に固定;反動を使わない
ez_curl|EZバーカール|biceps|forearms|ez|iso|barez|bb_curl,db_curl|手首が楽なので痛みが出る人向け
db_curl|ダンベルカール|biceps|forearms|dumbbell|iso||bb_curl,alt_db_curl,cable_curl|
alt_db_curl|オルタネイトダンベルカール|biceps|forearms|dumbbell|iso|uni|db_curl,concentration_curl|
hammer_curl|ハンマーカール|forearms|biceps|dumbbell|iso||reverse_curl,db_curl|腕橈骨筋に効く。腕の太さに直結
incline_db_curl|インクラインダンベルカール|biceps||dumbbell|iso||db_curl,spider_curl|ストレッチが最も強い二頭種目
preacher_curl|プリーチャーカール|biceps||ez|iso|barez|machine_curl,spider_curl,bb_curl|完全に伸ばしきらず肘を守る
concentration_curl|コンセントレーションカール|biceps||dumbbell|iso|uni|db_curl,cable_curl|
cable_curl|ケーブルカール|biceps|forearms|cable|iso||bb_curl,db_curl|全可動域で張力が抜けない
spider_curl|スパイダーカール|biceps||dumbbell|iso||preacher_curl,incline_db_curl|
reverse_curl|リバースカール|forearms|biceps|ez|iso|barez|hammer_curl,wrist_curl|
machine_curl|マシンカール|biceps||machine|iso||preacher_curl,cable_curl|
close_grip_bench|ナローベンチプレス|triceps|chest,front_delt|barbell|push_h|bar20|dips,skull_crusher,diamond_pushup|手幅は肩幅程度;肘を締めて下ろす
skull_crusher|スカルクラッシャー|triceps||ez|iso|barez|overhead_ext,pushdown,close_grip_bench|肘の位置を動かさない
overhead_ext|オーバーヘッドエクステンション|triceps||cable|iso||db_overhead_ext,skull_crusher|長頭がよく伸びる
db_overhead_ext|ダンベルオーバーヘッドエクステンション|triceps||dumbbell|iso||overhead_ext,skull_crusher|
pushdown|プレスダウン|triceps||cable|iso||rope_pushdown,kickback,diamond_pushup|肘を体側に固定し前腕だけ動かす
rope_pushdown|ロープトライセプスプレスダウン|triceps||cable|iso||pushdown,kickback|最後に手を開いて外側を締める
kickback|キックバック|triceps||dumbbell|iso|uni|pushdown,rope_pushdown|
bench_dip|ベンチディップス|triceps|front_delt,chest|bodyweight|push_h|bw|dips,pushdown|肩が前に出過ぎないよう注意
wrist_curl|リストカール|forearms||dumbbell|iso||reverse_wrist_curl,hammer_curl|
reverse_wrist_curl|リバースリストカール|forearms||dumbbell|iso||wrist_curl,reverse_curl|
farmers_walk|ファーマーズウォーク|forearms|traps,abs|dumbbell|carry|time|dead_hang,suitcase_carry|胸を張って歩く。握力と体幹に効く
dead_hang|デッドハング|forearms|lats|bodyweight|carry|bw,time|farmers_walk|握力と肩のストレッチに

squat|バーベルスクワット|quads|glutes,hamstrings,lower_back|barbell|squat|bar20|front_squat,goblet_squat,leg_press,hack_squat|胸を張り膝をつま先方向へ;股関節と膝を同時に曲げる;深さは太腿が床と平行以上
high_bar_squat|ハイバースクワット|quads|glutes,lower_back|barbell|squat|bar20|squat,front_squat|上体を立てて深くしゃがむ。四頭に効く
front_squat|フロントスクワット|quads|glutes,abs,upper_back|barbell|squat|bar20|squat,goblet_squat,hack_squat|肘を高く保ち上体を立てる
box_squat|ボックススクワット|glutes|quads,hamstrings|barbell|squat|bar20|squat,hip_thrust|箱に座って一旦止める。深さが毎回揃う
goblet_squat|ゴブレットスクワット|quads|glutes,abs|dumbbell|squat||squat,front_squat,air_squat|フォーム習得に最適
hack_squat|ハックスクワット|quads|glutes|machine|squat||leg_press,squat,smith_squat|腰の負担が小さく四頭を追い込める
smith_squat|スミススクワット|quads|glutes|smith|squat|bar15|squat,hack_squat|
leg_press|レッグプレス|quads|glutes,hamstrings|machine|squat||squat,hack_squat,goblet_squat|膝を伸ばし切らない;腰を浮かせない
bulgarian_split|ブルガリアンスクワット|quads|glutes,hamstrings|dumbbell|lunge|uni|split_squat,lunge,step_up|前傾すると臀筋、直立だと四頭;左右差の是正に有効
split_squat|スプリットスクワット|quads|glutes|dumbbell|lunge|uni|bulgarian_split,lunge|
lunge|ランジ|quads|glutes,hamstrings|dumbbell|lunge|uni|walking_lunge,reverse_lunge,bulgarian_split|
walking_lunge|ウォーキングランジ|glutes|quads,hamstrings|dumbbell|lunge||lunge,reverse_lunge|
reverse_lunge|リバースランジ|glutes|quads|dumbbell|lunge|uni|lunge,step_up|膝への負担が前方ランジより小さい
step_up|ステップアップ|glutes|quads|dumbbell|lunge|uni|bulgarian_split,reverse_lunge|
leg_extension|レッグエクステンション|quads||machine|iso||sissy_squat,leg_press|上で1秒止めると効きが増す
sissy_squat|シシースクワット|quads||bodyweight|iso|bw|leg_extension,squat|
leg_curl|レッグカール|hamstrings||machine|iso||seated_leg_curl,lying_leg_curl,romanian_deadlift|
seated_leg_curl|シーテッドレッグカール|hamstrings||machine|iso||leg_curl,lying_leg_curl|股関節が曲がる分ストレッチが強い
lying_leg_curl|ライイングレッグカール|hamstrings|calves|machine|iso||leg_curl,seated_leg_curl|
nordic_curl|ノルディックハムカール|hamstrings||bodyweight|iso|bw|leg_curl,stiff_leg_deadlift|ゆっくり耐える。肉離れ予防に有効
hip_thrust|ヒップスラスト|glutes|hamstrings|barbell|hinge|bar20|glute_bridge,box_squat,cable_kickback|あごを引き、上で1秒締める
glute_bridge|グルートブリッジ|glutes|hamstrings|bodyweight|hinge|bw|hip_thrust,back_extension|
cable_kickback|ケーブルキックバック|glutes||cable|iso|uni|hip_thrust,glute_bridge|
hip_abduction|アブダクション（マシン）|glutes||machine|iso||cable_kickback,hip_thrust|中臀筋。骨盤の安定に効く
hip_adduction|アダクション（マシン）|adductors||machine|iso||sumo_deadlift,goblet_squat|
calf_raise|スタンディングカーフレイズ|calves||machine|iso||db_calf_raise,leg_press_calf,seated_calf_raise|下でしっかり伸ばし上で止める
seated_calf_raise|シーテッドカーフレイズ|calves||machine|iso||calf_raise,leg_press_calf|ヒラメ筋狙い。膝を曲げて行う
leg_press_calf|レッグプレスカーフレイズ|calves||machine|iso||calf_raise,seated_calf_raise|
db_calf_raise|ダンベルカーフレイズ|calves||dumbbell|iso||calf_raise,leg_press_calf|
air_squat|自重スクワット|quads|glutes|bodyweight|squat|bw|goblet_squat,squat|
pistol_squat|ピストルスクワット|quads|glutes,abs|bodyweight|squat|bw,uni|bulgarian_split,air_squat|
wall_sit|ウォールシット|quads||bodyweight|squat|bw,time|air_squat,leg_extension|

plank|プランク|abs|obliques,lower_back|bodyweight|core|bw,time|ab_wheel,hollow_hold,dead_bug|お尻を上げすぎない;肋骨を締めて腰を反らせない
side_plank|サイドプランク|obliques|abs|bodyweight|core|bw,time|pallof_press,side_bend|
crunch|クランチ|abs||bodyweight|core|bw|cable_crunch,machine_crunch,situp|背中を丸めて肋骨を骨盤に近づける
cable_crunch|ケーブルクランチ|abs||cable|core||crunch,machine_crunch|高重量を扱え腹筋を肥大させやすい
machine_crunch|アブドミナルクランチ（マシン）|abs||machine|core||cable_crunch,crunch|
situp|シットアップ|abs|obliques|bodyweight|core|bw|crunch,v_up|
leg_raise|レッグレイズ|abs|obliques|bodyweight|core|bw|hanging_leg_raise,knee_raise|腰を床につけたまま
hanging_leg_raise|ハンギングレッグレイズ|abs|obliques,forearms|bodyweight|core|bw|knee_raise,leg_raise|反動で振らない。骨盤を丸め込む
knee_raise|ハンギングニーレイズ|abs|obliques|bodyweight|core|bw|hanging_leg_raise,leg_raise|
ab_wheel|アブローラー|abs|obliques,lats|bodyweight|core|bw|plank,hollow_hold|膝コロから。腰を反らせない
russian_twist|ロシアンツイスト|obliques|abs|bodyweight|core|bw|bicycle_crunch,pallof_press|
bicycle_crunch|バイシクルクランチ|obliques|abs|bodyweight|core|bw|russian_twist,crunch|
mountain_climber|マウンテンクライマー|abs|obliques,quads|bodyweight|core|bw,time|plank,knee_raise|
dead_bug|デッドバグ|abs|lower_back|bodyweight|core|bw|plank,bird_dog|腰を床に押し付けたまま
bird_dog|バードドッグ|lower_back|abs,glutes|bodyweight|core|bw|dead_bug,back_extension|
pallof_press|パロフプレス|obliques|abs|cable|core|time|side_plank,russian_twist|回旋に耐える。体幹の実用的な強さ
side_bend|サイドベンド|obliques||dumbbell|core|uni|side_plank,russian_twist|
hollow_hold|ホローホールド|abs||bodyweight|core|bw,time|plank,ab_wheel|
v_up|Vアップ|abs|obliques|bodyweight|core|bw|situp,leg_raise|
suitcase_carry|スーツケースキャリー|obliques|forearms,traps|dumbbell|carry|uni,time|farmers_walk,side_plank|

neck_curl|ネックカール|neck||plate|iso||neck_extension|ごく軽い重量でゆっくり
neck_extension|ネックエクステンション|neck||plate|iso||neck_curl|

kb_swing|ケトルベルスイング|glutes|hamstrings,lower_back|kettlebell|hinge||romanian_deadlift,hip_thrust|腕で持ち上げず股関節で振る
clean_and_press|クリーン&プレス|front_delt|quads,traps,glutes|barbell|push_v|bar20|push_press,thruster|
power_clean|パワークリーン|traps|quads,glutes,lower_back|barbell|hinge|bar20|deadlift,kb_swing|技術種目。軽い重量でフォームから
thruster|スラスター|front_delt|quads,glutes,triceps|barbell|push_v|bar20|push_press,clean_and_press|
burpee|バーピー|quads|chest,abs,front_delt|bodyweight|squat|bw|mountain_climber,air_squat|
`;

function parseFlags(s) {
  const flags = { uni: false, bw: false, assist: false, time: false, bar: 0 };
  if (!s) return flags;
  for (const f of s.split(',').map(x => x.trim()).filter(Boolean)) {
    if (f === 'uni') flags.uni = true;
    else if (f === 'bw') flags.bw = true;
    else if (f === 'assist') flags.assist = true;
    else if (f === 'time') flags.time = true;
    else if (f === 'barez') flags.bar = 7.5;
    else if (f.startsWith('bar')) flags.bar = Number(f.slice(3)) || 0;
  }
  return flags;
}

function parse(table) {
  const out = [];
  for (const raw of table.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [id, name, muscle, sub, equip, pattern, flagStr, alts, tips] = line.split('|');
    if (!id || !MUSCLE_BY_ID[muscle]) {
      if (id) console.warn('未知の部位を持つ種目をスキップしました:', id, muscle);
      continue;
    }
    const flags = parseFlags(flagStr);
    out.push({
      id,
      name,
      muscle,
      sub: (sub || '').split(',').map(s => s.trim()).filter(Boolean),
      equip: equip || 'other',
      pattern: pattern || 'iso',
      alts: (alts || '').split(',').map(s => s.trim()).filter(Boolean),
      tips: (tips || '').split(';').map(s => s.trim()).filter(Boolean),
      ...flags,
      custom: false
    });
  }
  return out;
}

export const BUILTIN_EXERCISES = parse(TABLE);

// 単関節・複合の判定（ボリューム換算とウォームアップ量に使う）
export const isCompound = ex => ex.pattern !== 'iso' && ex.pattern !== 'core';
