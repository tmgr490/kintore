// 分割法（プログラム）テンプレート。
// 選ぶとルーティンと週間スケジュールが一括で作られる。
//
// ルーティン内の種目: [種目ID, セット数, 下限レップ, 上限レップ, 目標RIR]
// 曜日: 0=日 1=月 2=火 3=水 4=木 5=金 6=土

const E = (id, sets, lo, hi, rir = 2) => ({ exId: id, sets, repLow: lo, repHigh: hi, rir });

export const PROGRAM_TEMPLATES = [
  {
    id: 'fullbody3',
    name: '全身法 週3日',
    level: '初心者',
    days: 3,
    goal: 'general',
    desc: '週3回、毎回全身を鍛える。頻度が高く伸びやすいので最初の半年〜1年はこれが最適。',
    routines: [
      {
        key: 'A', name: '全身A', items: [
          E('squat', 3, 6, 10, 2), E('bb_bench', 3, 6, 10, 2), E('bb_row', 3, 8, 12, 2),
          E('db_shoulder_press', 2, 10, 15, 2), E('leg_curl', 2, 10, 15, 1), E('plank', 2, 30, 60, 1)
        ]
      },
      {
        key: 'B', name: '全身B', items: [
          E('romanian_deadlift', 3, 6, 10, 2), E('lat_pulldown', 3, 8, 12, 2), E('db_incline_bench', 3, 8, 12, 2),
          E('leg_press', 3, 10, 15, 2), E('lateral_raise', 3, 12, 20, 1), E('cable_crunch', 2, 10, 15, 1)
        ]
      },
      {
        key: 'C', name: '全身C', items: [
          E('front_squat', 3, 6, 10, 2), E('ohp', 3, 6, 10, 2), E('seated_cable_row', 3, 8, 12, 2),
          E('db_curl', 2, 10, 15, 1), E('rope_pushdown', 2, 10, 15, 1), E('calf_raise', 3, 10, 15, 1)
        ]
      }
    ],
    schedule: [null, 'A', null, 'B', null, 'C', null]
  },

  {
    id: 'upperlower4',
    name: '上下2分割 週4日',
    level: '初〜中級',
    days: 4,
    goal: 'hypertrophy',
    desc: '上半身・下半身を分けて週2回ずつ。1部位あたり週2頻度を保ちつつ1回のボリュームを増やせる、最もバランスの良い分割。',
    routines: [
      {
        key: 'U1', name: '上半身（プッシュ寄り）', items: [
          E('bb_bench', 4, 5, 8, 2), E('bb_row', 4, 6, 10, 2), E('db_shoulder_press', 3, 8, 12, 2),
          E('lat_pulldown', 3, 8, 12, 2), E('lateral_raise', 3, 12, 20, 1), E('rope_pushdown', 3, 10, 15, 1)
        ]
      },
      {
        key: 'L1', name: '下半身（スクワット寄り）', items: [
          E('squat', 4, 5, 8, 2), E('romanian_deadlift', 3, 8, 12, 2), E('leg_press', 3, 10, 15, 2),
          E('leg_curl', 3, 10, 15, 1), E('calf_raise', 4, 10, 15, 1), E('hanging_leg_raise', 3, 8, 15, 1)
        ]
      },
      {
        key: 'U2', name: '上半身（プル寄り）', items: [
          E('pullup', 4, 5, 10, 2), E('db_incline_bench', 4, 8, 12, 2), E('seated_cable_row', 3, 10, 15, 2),
          E('cable_fly', 3, 12, 15, 1), E('face_pull', 3, 12, 20, 1), E('ez_curl', 3, 10, 15, 1)
        ]
      },
      {
        key: 'L2', name: '下半身（ヒンジ寄り）', items: [
          E('deadlift', 3, 4, 6, 2), E('bulgarian_split', 3, 8, 12, 2), E('leg_extension', 3, 12, 15, 1),
          E('seated_leg_curl', 3, 10, 15, 1), E('hip_thrust', 3, 8, 12, 2), E('seated_calf_raise', 4, 12, 20, 1)
        ]
      }
    ],
    schedule: [null, 'U1', 'L1', null, 'U2', 'L2', null]
  },

  {
    id: 'ppl6',
    name: 'PPL（押/引/脚）週6日',
    level: '中〜上級',
    days: 6,
    goal: 'hypertrophy',
    desc: 'プッシュ・プル・レッグを2周。1部位週2頻度で高ボリュームを稼げるが、回復と生活リズムが整っている人向け。',
    routines: [
      {
        key: 'P1', name: 'プッシュA（胸重視）', items: [
          E('bb_bench', 4, 5, 8, 2), E('db_shoulder_press', 3, 8, 12, 2), E('db_incline_bench', 3, 8, 12, 2),
          E('cable_fly', 3, 12, 15, 1), E('lateral_raise', 4, 12, 20, 1), E('rope_pushdown', 3, 10, 15, 1)
        ]
      },
      {
        key: 'L1', name: 'プルA（背中重視）', items: [
          E('bb_row', 4, 6, 10, 2), E('pullup', 3, 6, 12, 2), E('seated_cable_row', 3, 10, 15, 2),
          E('face_pull', 3, 15, 20, 1), E('ez_curl', 3, 8, 12, 1), E('hammer_curl', 3, 10, 15, 1)
        ]
      },
      {
        key: 'G1', name: 'レッグA（スクワット）', items: [
          E('squat', 4, 5, 8, 2), E('romanian_deadlift', 3, 8, 12, 2), E('leg_press', 3, 10, 15, 2),
          E('leg_curl', 3, 10, 15, 1), E('calf_raise', 4, 10, 15, 1), E('ab_wheel', 3, 8, 15, 1)
        ]
      },
      {
        key: 'P2', name: 'プッシュB（肩重視）', items: [
          E('ohp', 4, 5, 8, 2), E('db_incline_bench', 4, 8, 12, 2), E('machine_chest_press', 3, 10, 15, 2),
          E('cable_lateral_raise', 4, 12, 20, 1), E('dips', 3, 6, 12, 2), E('overhead_ext', 3, 10, 15, 1)
        ]
      },
      {
        key: 'L2', name: 'プルB（広背筋重視）', items: [
          E('lat_pulldown', 4, 8, 12, 2), E('chest_supported_row', 4, 8, 12, 2), E('straight_arm_pulldown', 3, 12, 15, 1),
          E('reverse_pec_deck', 3, 15, 20, 1), E('shrug', 3, 10, 15, 1), E('incline_db_curl', 3, 10, 15, 1)
        ]
      },
      {
        key: 'G2', name: 'レッグB（ヒンジ）', items: [
          E('deadlift', 3, 4, 6, 2), E('front_squat', 3, 6, 10, 2), E('bulgarian_split', 3, 8, 12, 2),
          E('seated_leg_curl', 3, 10, 15, 1), E('leg_extension', 3, 12, 20, 1), E('seated_calf_raise', 4, 12, 20, 1)
        ]
      }
    ],
    schedule: [null, 'P1', 'L1', 'G1', 'P2', 'L2', 'G2']
  },

  {
    id: 'ppl3',
    name: 'PPL（押/引/脚）週3日',
    level: '初〜中級',
    days: 3,
    goal: 'hypertrophy',
    desc: '週3日しか取れない人向けのPPL。1回のセッションが短めで済む。',
    routines: [
      {
        key: 'P', name: 'プッシュ', items: [
          E('bb_bench', 4, 6, 10, 2), E('ohp', 3, 6, 10, 2), E('db_incline_bench', 3, 8, 12, 2),
          E('lateral_raise', 3, 12, 20, 1), E('rope_pushdown', 3, 10, 15, 1)
        ]
      },
      {
        key: 'L', name: 'プル', items: [
          E('bb_row', 4, 6, 10, 2), E('lat_pulldown', 3, 8, 12, 2), E('face_pull', 3, 15, 20, 1),
          E('ez_curl', 3, 8, 12, 1), E('hammer_curl', 2, 10, 15, 1)
        ]
      },
      {
        key: 'G', name: 'レッグ', items: [
          E('squat', 4, 5, 8, 2), E('romanian_deadlift', 3, 8, 12, 2), E('leg_press', 3, 10, 15, 2),
          E('leg_curl', 3, 10, 15, 1), E('calf_raise', 4, 10, 15, 1)
        ]
      }
    ],
    schedule: [null, 'P', null, 'L', null, 'G', null]
  },

  {
    id: 'bro5',
    name: 'ブロスプリット 週5日',
    level: '中級',
    days: 5,
    goal: 'hypertrophy',
    desc: '1日1部位。各部位を徹底的に追い込める反面、頻度は週1になるのでボリュームを稼ぎたい中級者向け。',
    routines: [
      {
        key: 'CH', name: '胸の日', items: [
          E('bb_bench', 4, 6, 10, 2), E('db_incline_bench', 4, 8, 12, 2), E('machine_chest_press', 3, 10, 15, 2),
          E('cable_fly', 3, 12, 20, 1), E('dips', 3, 8, 12, 1), E('pushup', 2, 10, 25, 0)
        ]
      },
      {
        key: 'BK', name: '背中の日', items: [
          E('deadlift', 3, 4, 6, 2), E('pullup', 4, 6, 12, 2), E('bb_row', 4, 8, 12, 2),
          E('seated_cable_row', 3, 10, 15, 2), E('straight_arm_pulldown', 3, 12, 15, 1), E('shrug', 3, 10, 15, 1)
        ]
      },
      {
        key: 'SH', name: '肩の日', items: [
          E('ohp', 4, 6, 10, 2), E('db_shoulder_press', 3, 8, 12, 2), E('lateral_raise', 4, 12, 20, 1),
          E('cable_lateral_raise', 3, 15, 20, 1), E('reverse_pec_deck', 4, 15, 20, 1), E('face_pull', 3, 15, 20, 1)
        ]
      },
      {
        key: 'AR', name: '腕の日', items: [
          E('close_grip_bench', 4, 8, 12, 2), E('ez_curl', 4, 8, 12, 1), E('skull_crusher', 3, 10, 15, 1),
          E('incline_db_curl', 3, 10, 15, 1), E('rope_pushdown', 3, 12, 20, 1), E('hammer_curl', 3, 12, 20, 1)
        ]
      },
      {
        key: 'LG', name: '脚の日', items: [
          E('squat', 5, 5, 8, 2), E('leg_press', 4, 10, 15, 2), E('romanian_deadlift', 3, 8, 12, 2),
          E('leg_extension', 3, 12, 20, 1), E('seated_leg_curl', 3, 10, 15, 1), E('calf_raise', 5, 10, 15, 1)
        ]
      }
    ],
    schedule: [null, 'CH', 'BK', 'SH', 'AR', 'LG', null]
  },

  {
    id: 'sl5x5',
    name: 'StrongLifts 5×5',
    level: '初心者',
    days: 3,
    goal: 'strength',
    desc: '5種目×5セット5レップのみ。毎回2.5kgずつ伸ばす、筋力の土台を最速で作る古典的プログラム。',
    routines: [
      {
        key: 'A', name: 'ワークアウトA', items: [
          E('squat', 5, 5, 5, 1), E('bb_bench', 5, 5, 5, 1), E('bb_row', 5, 5, 5, 1)
        ]
      },
      {
        key: 'B', name: 'ワークアウトB', items: [
          E('squat', 5, 5, 5, 1), E('ohp', 5, 5, 5, 1), E('deadlift', 1, 5, 5, 1)
        ]
      }
    ],
    schedule: [null, 'A', null, 'B', null, 'A', null]
  },

  {
    id: 'home3',
    name: '自宅・自重＋ダンベル 週3日',
    level: '初心者',
    days: 3,
    goal: 'general',
    desc: 'ジムに行かなくてもできる構成。ダンベルがあればなお良いが、無くても回せる。',
    routines: [
      {
        key: 'A', name: '自宅A（プッシュ＋脚）', items: [
          E('pushup', 4, 8, 20, 1), E('goblet_squat', 4, 10, 15, 2), E('db_shoulder_press', 3, 10, 15, 2),
          E('bulgarian_split', 3, 8, 12, 2), E('diamond_pushup', 3, 8, 15, 1), E('plank', 3, 30, 60, 1)
        ]
      },
      {
        key: 'B', name: '自宅B（プル＋ヒンジ）', items: [
          E('pullup', 4, 3, 10, 2), E('db_row', 4, 10, 15, 2), E('db_rdl', 3, 10, 15, 2),
          E('glute_bridge', 3, 12, 20, 1), E('db_curl', 3, 10, 15, 1), E('hanging_leg_raise', 3, 8, 15, 1)
        ]
      },
      {
        key: 'C', name: '自宅C（全身）', items: [
          E('bulgarian_split', 3, 10, 15, 2), E('incline_pushup', 3, 12, 20, 1), E('inverted_row', 3, 8, 15, 2),
          E('nordic_curl', 3, 5, 10, 1), E('lateral_raise', 3, 12, 20, 1), E('ab_wheel', 3, 8, 15, 1)
        ]
      }
    ],
    schedule: [null, 'A', null, 'B', null, 'C', null]
  },

  {
    id: 'strength4',
    name: '筋力特化 上下2分割 週4日',
    level: '中〜上級',
    days: 4,
    goal: 'strength',
    desc: 'BIG3の重量を伸ばすことを最優先。低レップ・長い休憩・高い強度で組んである。',
    routines: [
      {
        key: 'S1', name: 'スクワットの日', items: [
          E('squat', 5, 3, 5, 1), E('front_squat', 3, 5, 8, 2), E('romanian_deadlift', 3, 6, 8, 2),
          E('leg_curl', 3, 10, 12, 1), E('plank', 3, 45, 90, 1)
        ]
      },
      {
        key: 'S2', name: 'ベンチの日', items: [
          E('bb_bench', 5, 3, 5, 1), E('ohp', 4, 5, 8, 2), E('bb_row', 4, 6, 8, 2),
          E('close_grip_bench', 3, 6, 10, 2), E('face_pull', 3, 15, 20, 1)
        ]
      },
      {
        key: 'S3', name: 'デッドリフトの日', items: [
          E('deadlift', 4, 3, 5, 1), E('rack_pull', 3, 5, 8, 2), E('pullup', 4, 5, 10, 2),
          E('back_extension', 3, 10, 15, 1), E('farmers_walk', 3, 30, 45, 1)
        ]
      },
      {
        key: 'S4', name: '補助＋肩の日', items: [
          E('seated_ohp', 4, 5, 8, 2), E('db_incline_bench', 4, 8, 12, 2), E('chest_supported_row', 4, 8, 12, 2),
          E('lateral_raise', 3, 12, 20, 1), E('ez_curl', 3, 8, 12, 1), E('pushdown', 3, 10, 15, 1)
        ]
      }
    ],
    schedule: [null, 'S1', 'S2', null, 'S3', 'S4', null]
  }
];

export const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
