# ゴルフクエスト

yamada有料note（爆発力トレ・100球メニュー）を「守らせて・記録して・段位で見せる」アプリ。
スマホのホーム画面に置いて使うWeb型。記録はLifeOSの記録倉庫（Supabase）に置く。
仕様の原本: `spec-draft.md`（v0.3）。

## 使う人の入口
- 有料note購入 → 公式LINEに「アプリ」とnote名 → yamadaが合言葉（GQ-XXXX-XXXX）を発行 → アプリに1回入力
- 合言葉が鍵。パスワードなし。別端末でも同じ合言葉で記録が引き継がれる

## 画面
| タブ | 中身 |
|---|---|
| 現在地 | 段位・経験値Lv（順番を守った球だけで貯まる、`js/xp.js`）・次の段位までのクエスト・4つの数値（飛距離／再現性／推定スコア＝直近5R平均と傾向／遵守率）・今週の予定・成長グラフ・AIに聞く |
| ①筋トレ | 推定MAX（BIG3の推定1RM・体重比・推移、`#maxes`）、自重／ジム選択、爆発トレ5×5（48時間ロック・週3上限・速度低下で終了）、BIG3（12週後解禁・2-for-2で重量アップ提案）、自分メニュー、Hevy型の記録 |
| ②練習場 | 50/100/150/200球の段取り、サーキット4球ナビ、マン振り（素振り3回→5球×3セット・16球目不可・休憩2〜3分）、メトロノーム内蔵、打点9分割 |
| ③計測 | HS/初速/キャリー等の手入力、計測器スクショの読み取り（端末内OCR）、**飛距離診断**（`#diagnose`：目標→必要HS・筋力／速さ／当たりの判定・垂直跳び記録）、ラウンド記録 |
| ④yamada | 質問（1日3件・朝6:30/夜21:00に回答）、スイング動画（1日1本・同意・30日削除） |
| ⚙設定 | 表示名、コース、テンポ（BPM/拍・試し鳴らし）、週の予定、BIG3重量、AI先、見た目 |

## 仕組み（裏側）
- `js/config.js` … 倉庫のつなぎ先（公開してよい鍵のみ）
- `js/core.js` … 窓口呼び出し（`gq_*` 関数のみ）・端末内の控え・共通部品
- `js/rank.js` … 段位＝クエスト進捗の計算（仕様3章）
- `js/diagnose.js` … 飛距離診断。数式と閾値の出典は `knowledge/golf/distance/300y-diagnosis-model.md`。倉庫は `027_golf_quest_diagnose.sql`（jump_cm・rsi・target_y）
- `js/maxes.js` … 推定MAX（BIG3）。全ワークアウトの記録からEpley式で推定1RM。体重は倉庫の列を増やさず `member.lifts.bw` に置く
- 倉庫の設計図: `supabase/migrations/023_golf_quest.sql`（RLSで直接アクセス不可、窓口関数だけ許可。動画は非公開バケット `gq-swings` に本人の秘密フォルダへ置くだけ）
- 運営側の道具: `backend/scripts/golf_quest_admin.py`（合言葉発行・質問回答・動画判定・30日削除）

## 倉庫の更新（マイグレーション）
`python backend/scripts/run_migration.py supabase/migrations/NNN.sql`。直結ホストはIPv6専用で繋がらない回線があるので、失敗したら自動で管理API（HTTPS）に切り替わる（`.env` の `SUPABASE_ACCESS_TOKEN`）。

## ローカルで動かす
`.claude/launch.json` の `golf-app`（python http.server 8766）。http://127.0.0.1:8766/

## 公開
**https://magi127605-cmd.github.io/golf-quest/**（公開リポ `magi127605-cmd/golf-quest`、検索非表示）。
更新手順: `sw.js` の `VERSION`・`FILES` の `?v=`、`js/config.js` の `version`、`index.html` の `?v=`（script/css）を同じ番号に上げる（ブラウザの古い控えを確実に捨てさせるため） → このフォルダを公開用の控え（`%TEMP%\claude\golf-quest-publish`。無ければ `git clone` し直す）にコピー → `spec-draft.md` `claims.md` `tools/` は入れない → push。

## 運用（yamada側）
- 朝6:30／夜21:00: `golf_quest_admin.py questions` → 教材範囲は自動回答、範囲外は `hold`
- 朝6:30: `swings` → `download` → golf-coach MCP で骨格解析 → `judge`
- 週1: `cleanup`（30日超の動画削除）
