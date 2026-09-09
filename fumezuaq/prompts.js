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

