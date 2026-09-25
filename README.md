# ブルーアーカイブ Wiki ランキング編成ジェネレーター

ブルーアーカイブ攻略 Wiki（wikiru.jp）の「**ランキング上位で使用された生徒**」セクションの編集画面用テキスト（PukiWiki / WIKIWIKI記法）を直感的に作成・自動生成してクリップボードにコピーできるWebツールです。

---

## 🚀 主な機能

1. **総力戦 / 大決戦の切り替え**:
   - **大決戦**: 4属性（軽装備・重装甲・特殊装甲・弾力装甲）から3つを選択。選択した順番で編成入力欄および `#region(属性)` ～ `#endregion` が並びます。
   - **総力戦**: 1種類の属性ですぐに編成入力へ移行し、単一テーブルを出力します。

2. **ひらがな・カタカナ同一視スマート検索 & 80x80画像プレビュー**:
   - 入力欄に「あ」や「あつこ」と入力するだけで、「アツコ」「アツコ（水着）」「アル」「アズサ」などの生徒が前方一致優先で即座にサジェスト。
   - 生徒名をクリックすると入力欄に自動セットされ、下に Wiki アイコン（80x80）が即時プレビューされます。

3. **凸数管理（部隊追加・削除） & スコア自動カンマ整形 & 戦闘時間逆算**:
   - 1部隊攻略はもちろん、「＋ 部隊を追加」ボタンで 2凸目、3凸目... を無制限に追加可能。
   - スコア入力欄に数値を入力すると自動で `40,081,280` のように3桁カンマ区切りに整形。
   - スコアとボスの制限時間（3分 / 4分 / 4分30秒）から、難易度（TORMENT等）と戦闘時間をリアルタイムに自動逆算して表示。
   - Wikiテーブルにも「戦闘時間」列（`186.67秒&br;（3分6.67秒）`）が自動で付与されます。

4. **開始スキル（1⃣2⃣3⃣4⃣5⃣）の指定 & ゲーム画面再現**:
   - 各スロットに開始スキル順序（1〜3: 黄色、4〜5: 青色）を指定可能。
   - ゲーム画面と同じくアイコンの上に右寄せで四角囲み数字バッジ（1⃣2⃣3⃣4⃣5⃣）を配置。

5. **ワンクリック生成 & クリップボード自動コピー**:
   - 「Wikiテキストを生成 & コピー」ボタンを押すだけで、正確なWikiフォーマットを生成しクリップボードにコピー。
   - Wiki上の特殊な画像ファイル名（例: `シュエリン（水着）_icon.png` や `キサキ_icon_v2.png`）とも完全に一致したタグを出力します。

---

---

## 🌐 GitHub Pages ＆ GitHub Actions での運用（月1回自動更新）

このリポジトリを GitHub にプッシュするだけで、**完全無料・サーバー管理不要のWebアプリ（GitHub Pages）** として公開でき、**月1回の生徒データ自動更新（GitHub Actions）** が稼働します。

### 1. GitHub への初期アップロード手順
1. GitHubで新しいリポジトリ（例: `ba-ranking-generator`）を作成します（Public推奨）。
2. このフォルダの内容をプッシュします：
   ```bash
   git init
   git add .
   git commit -m "🎉 Initial commit: Blue Archive Ranking Generator"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/ba-ranking-generator.git
   git push -u origin main
   ```

### 2. GitHub Pages の有効化（Webアプリ公開）
1. 作成したリポジトリのページで、**Settings**（設定）タブを開きます。
2. 左メニューの **Pages** をクリックします。
3. **Build and deployment** の Source で **`Deploy from a branch`** を選択します。
4. Branch で **`main`** / **`/ (root)`** を選択し、**Save** をクリックします。
5. 数分後、`https://あなたのユーザー名.github.io/ba-ranking-generator/` にWebアプリが公開されます！

### 3. GitHub Actions による月1回自動更新の仕組み
- **`.github/workflows/update-students.yml`** により、**毎月1日の日本時間午前3時** にGitHub Actionsが自動起動します。
- Wiki（`テーブル/キャラクター一覧`）から最新の生徒データを取得し、新キャラが追加されていれば自動でコミット＆プッシュされます。
- **Wiki負荷は実質ゼロ**: 一般ユーザーがWebアプリにアクセスしてもWikiへの通信は一切発生せず、GitHub Actionsの月1回（1ページ取得のみ）で完結します。
- **手動即時実行**: GitHubのリポジトリ画面の「**Actions**」タブ → 「Monthly Blue Archive Students Auto-Update」 → 「**Run workflow**」ボタンを押すことで、いつでも即座に手動更新できます。

---

## 🛠 ファイル構成

```
ba-ranking-generator/
├── .github/
│   └── workflows/
│       └── update-students.yml  # 【自動化】月1回定期実行ワークフロー
├── scripts/
│   └── update_students.py       # 【更新処理】Wikiから最新生徒を取得するスクリプト
├── data/
│   └── students-data.json       # 【データ】自動更新される全生徒マスターデータ
├── icons/                       # アイコン画像
├── index.html                   # Webアプリ本体（GitHub Pages）
├── css/
│   └── style.css                # スタイルシート（ブルアカ風UI、レスポンシブ）
├── js/
│   ├── app.js                   # アプリケーション制御ロジック
│   ├── students-data.js         # 生徒データ（フォールバック用）
│   └── search.js                # ひらがな・カタカナ同一視検索エンジン
├── manifest.json                # Chrome拡張機能マニフェスト (Manifest V3)
├── background.js                # Chrome拡張機能サービスワーカー
├── server.py                    # ローカル検証用Pythonサーバー
├── start.bat                    # ローカル検証用ワンクリック起動
└── README.md                    # ドキュメント
```
