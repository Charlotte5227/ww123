// fumezuaq Translator v5 - AI prompt directives
// IMPORTANT: This file is an AI operation prompt, NOT the fumezuaq language specification.
// Edit this file when tuning AI behavior; app.js should normally not need prompt-only changes.

// ===== v4.1: AI Prompt Directive (NOT a language specification) =====
// This directive tells AI how to OPERATE on the existing fumezuaq specification.
// It MUST NOT be treated as a source that creates new fumezuaq grammar.

const AI_DIRECTIVE_META = `
【この文書の位置づけ】
これはfumezuaqそのものの仕様書ではない。
既存のfumezuaq仕様・辞書をAIが翻訳処理で正しく扱うための「プロンプト指示書」である。
この指示書の判断手順・安全策・禁止事項を、fumezuaqの新しい文法規則として説明・登録・推論してはならない。
言語仕様・辞書が一次資料であり、この指示書はAIの運用規約である。
`;

const AI_A = `
【A 最上位運用原則】
A1 原文意味保存
- 原文にある意味を可能な限り保持する。
- 原文にない意味を追加しない。
- 表現できない意味を消さず unresolved として残す。

A2 高情報密度
- fumezuaqの語は高密度に情報を持てる。
- しかし「吸収できる」ことは「吸収すべき」ことを意味しない。
- 語数最小化を目的にしない。

A3 必要十分
- 必要な関係は明示または内部linkで保持する。
- 一意で表面明示不要な関係は省略可能。
- 表現可能というだけで情報を追加しない。

A4 仕様優先
- 言語仕様・辞書にない一般文法をAIが新設しない。
- AIの自然言語的直感より一次資料を優先する。
- 未定義は未定義として扱う。
`;

const AI_B = `
【B 意味解析・意味塊】
B1 まず原文の意味構造だけを解析する。fumezuaq表面形・接辞列を先に考えない。
B2 日本語の文節・助詞・語順をfumezuaqの語境界と同一視しない。
B3 意味塊は一つのまとまった意味的役割を担う単位。命題・述語・語彙的中心語根を必須としない。
B4 「明日の朝まで」は十分限定された時間指定として独立意味塊になり得る。「明日の」は通常単独成立しない。
B5 名詞・具体物・語根の存在だけで独立性を認定しない。
B6 複数の情報群がそれぞれ自然な意味単位として成立するなら分離を第一候補とする。ただし機械的細分化は禁止。
B7 吸収は、単独成立しない、直接限定である、分離すると必要関係を保持できない、同一概念内部として明らかに自然、のいずれかを根拠にする。
B8 「同じ語に入れられる」「語数が減る」だけを吸収理由にしない。
B9 分離した意味塊間の必要関係はlinkとして保持する。
`;

const AI_C = `
【C 語内部構造の扱い】
C1 通常の語彙的意味塊では中心語根を一つ設定できる。ただし中心語根なしの独立意味塊も許容する。
C2 一語一中心語根は「一語一語根」ではない。複数語根を禁止しない。
C3 中心以外の語根を同一語へ吸収する場合はmodifier_rootとして扱う。
C4 modifier_rootは単純連結せず、中心との意味関係relation_idを既存辞書から必須指定する。
C5 relation_idが確定しない場合は unresolved_relation。常識で穴埋めしない。
C6 参与者は既存C1体系の役割・人称・数・必要な識別情報で扱い、人語根を代名詞台座として自動使用しない。
C7 接辞の実現は既存S-R-D-ROOT-E-K-C規則と辞書に従う。
C8 同一大分類の大分類形は一語内で一度だけ実現する。辞書表示形と語内実現形を区別する。
`;

const AI_D = `
【D 意味塊間構造】
D1 分離した意味塊間の意味関係はIR内部で保持する。
D2 linkがあることと表面形で対応標識を発音することは別。
D3 関係が一意なら表面対応標識を省略可能。
D4 複数候補があり曖昧なら必要最小限の対応明示を検討する。
D5 必要関係を表現できないとき「文脈で分かる」で成功扱いしない。unresolved_relationとする。
`;

const AI_E = `
【E 辞書利用】
E1 辞書に実在するID・form・meaningを使用する。
E2 辞書語義を文脈都合で拡張しない。例: 「朝」を「明日の朝」の意味に拡張しない。
E3 近似語で未解決意味を置換しない。
E4 初回候補にない場合は意味語・類義語で辞書全体を再検索し、実在IDを再確認する。
E5 再検索しても確定できなければ unresolved。
E6 辞書外の公式形・IDを新造しない。
`;

const AI_F = `
【F Typed IR】
F1 AIは最終fumezuaq表面形ではなく意味構造IRを作る。
F2 chunkには原文範囲/意味/center_root_id/modifier_roots/affix_ids/links/unresolved/unresolved_relationを保持する。
F3 modifier_rootにはroot_idとrelation_idを必須とする。
F4 AIは最終接辞文字列を作文・修正しない。
`;

const AI_H = `
【H 検証・失敗時処理】
H1 不明 -> unresolved
H2 初回辞書不足 -> 再検索 -> それでも不足なら unresolved
H3 関係不明 -> unresolved_relation
H4 辞書外ID -> validator error
H5 仕様矛盾 -> validator error
H6 原文の意味要素がIRにもunresolvedにも存在しない -> semantic coverage error
H7 原文にない意味をIRへ追加 -> semantic addition error/warning
`;

const AI_I = `
【I 禁止する誤推論】
I1 「独立意味塊には必ず中心語根が必要」禁止。
I2 「一語には一つしか語根を入れられない」禁止。
I3 「複数語根なら分割必須」禁止。
I4 「吸収可能なら吸収する」禁止。
I5 「具体名詞だから単独意味塊として成立」禁止。
I6 「辞書にないので近い接辞で代用」禁止。
I7 「関係未表現だが文脈で分かるので問題ない」禁止。
I8 「日本語の文節=fumezuaqの語」禁止。
I9 「語数が少ないほどfumezuaqらしい」禁止。
`;

const AI_J = `
【J 標準判断順序】
J1 原文意味抽出
J2 原文の全意味要素を記録
J3 自然な意味塊候補
J4 各候補の独立性判定
J5 分離可能なら分離を第一候補
J6 単独成立しない要素だけ必要な塊へ吸収
J7 各塊の中心を決定（中心語根なしも許容）
J8 副語根には既存関係を付与
J9 意味塊間link構築
J10 辞書照合
J11 不足再検索
J12 unresolved / unresolved_relation確定
J13 semantic coverage検証
J14 Typed IR確定
J15 JavaScriptコンパイラへ渡す
`;

const PROMPT_SEMANTIC = AI_DIRECTIVE_META + AI_A + AI_B + AI_I + `
【この工程の責任】
意味解析と意味塊候補の作成だけを行う。
辞書ID・fumezuaq表面形を決めない。
特に「吸収可能だからまとめる」を避け、各情報群が独立した自然な意味単位かを先に判定する。
`;

const PROMPT_DICTIONARY = AI_DIRECTIVE_META + AI_A + AI_E + AI_H + `
【この工程の責任】
与えられた意味概念を既存辞書へ照合するだけ。
文法設計・意味塊再編・近似補完をしない。
`;

const PROMPT_IR = AI_DIRECTIVE_META + AI_A + AI_B + AI_C + AI_D + AI_F + AI_H + AI_I + AI_J + `
【この工程の責任】
確定済み意味解析と辞書照合結果からTyped IRを構築する。
表面形を生成しない。
意味塊をまとめる場合はB7の根拠が必要。
分離した場合は必要な関係をlinksに保持する。
`;

const PROMPT_EXPLANATION = AI_DIRECTIVE_META + `
【説明工程専用】
説明は確定済みIR・validator結果・辞書事実だけを根拠にする。
新しい文法規則を説明のために作らない。
プロンプト指示書の運用ルールをfumezuaqの言語仕様として説明しない。
辞書語義を拡張しない。未解決は未解決と説明する。
`;



// ===== v5.1 additions =====
const PROMPT_FIXED_CHUNK_OUTPUT = `
【ユーザー固定意味塊の表面保持】
- ユーザーが確定した各意味塊は、1つの出力スロットとして必ず保持する。
- unresolvedであっても、その意味塊を削除・吸収・他チャンクへ統合したと説明してはならない。
- surface_required=false は「塊を消してよい」という意味ではない。これはリンク標識の表面明示要否にのみ関係する。
- ユーザー固定チャンクが辞書不足で表面形を作れない場合は、そのチャンク自身を unresolved として保持する。
- 「未解決なので述語側にパッキングされた」「2語へ収束した」等の事後合理化を禁止する。
`;

const PROMPT_UNRESOLVED_NONPROPAGATION = `
【unresolved非波及】
- ある意味要素がunresolvedでも、その意味を別カテゴリの接辞で近似補完しない。
- 例: 「昨日」がunresolvedでも、それを理由に時制を「近過去」へ具体化しない。
- 原文の「行った」から通常の過去だけが確定するなら、過去を選び、昨日は独立unresolvedとして残す。
`;


// ===== v5.2 analytical composition =====
const PROMPT_ANALYTICAL_COMPOSITION = `
【分析的構成（辞書完全一致がない場合）】
この規則はAIの検索手順であり、新しいfumezuaq文法を作る指示ではない。
1. 日本語概念に完全一致する辞書項目がない場合、直ちにunresolvedにしない。
2. まず、その概念を既存の語根・接辞・数詞・既存スコープ規則だけで構成できるか意味分解する。
3. 構成に使う各要素は、必ず既存辞書または既存数詞体系に実在するものだけにする。
4. 新しい接辞・語根・意味拡張を作って構成してはならない。
5. 構成できた場合は analytical_composition としてIRへ保持する。
6. 既存要素だけで構成できない場合に限り unresolved とする。

【相対日付の確定例】
「昨日」 = 日 + 前 + 1
「明日」 = 日 + 後 + 1
「明後日」 = 日 + 後 + 2
「3日前」 = 日 + 前 + 3
これは専用の「昨日」語根を要求しない。既存の時間単位・前後関係・数詞を合成する。

【数詞の語内部埋め込み】
- 単一の完成数詞形態素は直接埋め込み可能。
- 複数の完成数詞からなる複合数を語内部へ埋め込む場合、裸で並べない。
- 原則は数量を独立意味塊として分離する。
- 語内部に必要な場合は既存Xスコープで複合数全体を囲む。
- X開始: lenaq-saluq
- X終了: lenaq-soluq
`;

// Stage-specific augmentation after all base prompt constants exist.
const PROMPT_DICTIONARY_V52 = PROMPT_DICTIONARY + PROMPT_ANALYTICAL_COMPOSITION;
const PROMPT_IR_V52 = PROMPT_IR + PROMPT_ANALYTICAL_COMPOSITION;


const PROMPT_UNKNOWN_VISIBLE_V53 = `
【Unknown可視化・部分完成】
- 不明・未登録・確証不能な概念を、近い辞書項目で埋めてはならない。
- 不明部分はIRの unresolved / unresolved_relation に残す。
- 固定意味塊では、不明部分があってもその意味塊を削除・吸収しない。
- 表面生成では Unknown:<不足概念> として可視化する。
- 既知部分がある場合は既知部分を捨てず、Unknownと併存させる。
- 例: 「昨日」= 日 + 前 + 1 のうち「日」だけ辞書確定できないなら、前と1は保持し、「日」だけUnknownとして残す。
- Unknownは失敗ではなく、後から不足部分だけ設計・登録するための正式な作業用表現である。

【不要な情報を足さない】
- 原文に明示・強く含意されない情報を「通常だから」「肯定文だから」という理由で追加しない。
- K7の肯定評価は文の肯定極性そのものではない。肯定文というだけでK7肯定を付けない。
- 数・特定性・完了相・情報構造なども、原文から確定できなければ勝手に補わない。
- 「行った」は少なくとも過去を表すが、完了相を必須とはみなさない。必要性が確定しない場合は付けない。
`;

const PROMPT_DICTIONARY_V53 = PROMPT_DICTIONARY_V52 + PROMPT_UNKNOWN_VISIBLE_V53;
const PROMPT_IR_V53 = PROMPT_IR_V52 + PROMPT_UNKNOWN_VISIBLE_V53;


const PROMPT_TIME_QUANTITY_V55 = `
【時間量接頭要素】
- 年 = jua-
- 月 = shae-
- 半月 = chou-
- 日 = yai-
- 時間 = hie-
- 分 = fou-
- 秒 = jiu-

【構造】
TIME_UNIT_PREFIX + SINGLE_COMPLETED_NUMERAL_MORPHEME

【絶対制約】
- 時間量に使える数は、必ず単一の完成数詞形態素1個だけ。
- 複数の完成数詞形態素からなる数は時間量に使用できない。
- 例: hie-teriq = (20)₁₂時間 は可。
- (21)₁₂ = raq + teriq のように複数完成数詞を必要とする時間量は不可。
- Xスコープ、グルーピング、分割、無空白連結その他で回避してはならない。
- この禁止に例外はない。
- 上記7単位が使える場面で、未知の「時間単位語根」を捏造しない。
`;
const PROMPT_DICTIONARY_V55 = PROMPT_DICTIONARY_V53 + PROMPT_TIME_QUANTITY_V55;
const PROMPT_IR_V55 = PROMPT_IR_V53 + PROMPT_TIME_QUANTITY_V55;
