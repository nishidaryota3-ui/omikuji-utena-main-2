# うてな俳句会 臺俳句 Webアプリ

うてな俳句会の作品鑑賞および季寄せ（歳時記）データベースを備えた PWA（Progressive Web App）対応 Web アプリケーションです。
高速・軽量な静的 JSON 配信により、読者・会員（50人〜数千人規模）へ快適に提供できます。

---

## 📁 ファイル構成

```
omikuji-utena/
├── index.html            # メイン画面（HTML構造・Service Worker登録）
├── style.css             # 縦書き・レスポンシブデザイン用スタイル
├── app.js                # アプリケーションロジック（画面遷移・鑑賞・検索）
├── saijiki.json          # 季寄せマスターデータ（親季語・子季語・解説）
├── haiku.json            # 俳句マスターデータ（作品・作者・季語・発行号）
├── gas_export_haiku.js   # Googleスプレッドシート用 JSON書き出しスクリプト
├── sw.js                 # Service Worker（PWA・オフラインキャッシュ）
├── manifest.json         # PWA構成ファイル（ホーム画面追加時の設定）
├── icon.png              # アプリアイコン
├── omikuji-cat.png       # おみ句じ猫ボタン画像
└── README.md             # 本書（運用・デプロイマニュアル）
```

---

## 🚀 GitHub での新規リポジトリ作成＆公開手順（初心者向けガイド）

GitHub Pages を利用することで、**サーバー費用完全無料**で高速・安定した Web アプリとして公開できます。

### ステップ 1: GitHub で新しいリポジトリを作成する
1. [GitHub (github.com)](https://github.com/) にログインします。
2. 画面右上の **「+」** アイコンをクリックし、**「New repository」** を選択します。
3. リポジトリの設定を入力します：
   - **Repository name**: `omikuji-utena`（またはお好みの名前）
   - **Public / Private**: `Public`（誰でもアクセス可能）を選択  
     ※GitHub Pagesの無料枠を利用する場合は Public を推奨します。
   - **Initialize this repository with**: チェックはすべて外したままでOKです。
4. **「Create repository」** ボタンをクリックします。

### ステップ 2: ファイルをアップロードする
**【方法 A: ブラウザから直接アップロードする場合（簡単）】**
1. 作成されたリポジトリの画面で、「uploading an existing file」というリンクをクリックします。
2. このフォルダ内のすべてのファイル（`index.html`, `style.css`, `app.js`, `saijiki.json`, `haiku.json`, `sw.js`, `manifest.json`, `icon.png`, `omikuji-cat.png`）をドラッグ＆ドロップします。
3. 画面下の **「Commit changes」** をクリックします。

**【方法 B: ターミナル（Gitコマンド）を使う場合】**
```bash
git init
git add .
git commit -m "Initial commit: fast static JSON architecture"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/omikuji-utena.git
git push -u origin main
```

### ステップ 3: GitHub Pages を有効化（アプリのURLを発行）
1. リポジトリ上部のタブから **「Settings」**（歯車アイコン）をクリックします。
2. 左メニューの **「Pages」** をクリックします。
3. **Branch** の設定で、`None` を **`main`**（または `master`）に変更し、フォルダは **`/(root)`** のまま **「Save」** をクリックします。
4. 1〜2分待つと、画面上部に公開URLが表示されます：
   > **Your site is live at `https://あなたのユーザー名.github.io/omikuji-utena/`**

---

## 📱 読者（50人）への案内方法

発行されたURLを LINE やメール等で読者に案内します。

### スマホのホーム画面に追加する方法（アプリ化）
* **iPhone (Safari)**: 画面下の共有アイコン（四角から矢印）をタップし、**「ホーム画面に追加」** を選択。
* **Android (Chrome)**: 画面右上のメニュー（︙）をタップし、**「アプリをインストール」** または **「ホーム画面に追加」** を選択。

> **💡 メリット**: 一度ホーム画面に追加すると、電波のない場所でもサクサク動き、通常のアプリと同じ感覚で利用できます。

---

## 🌸 毎月の俳句更新手順（スプレッドシート ➡︎ アプリへの反映）

毎月新しい俳句誌が発行された際、または過去のバックナンバーを追加する際の手順です。

### 1. 初回のみ：Googleスプレッドシートに書き出しスクリプトを登録
1. Googleスプレッドシート（俳句集成）を開きます。
2. 上部メニューの **「拡張機能」>「Apps Script」** を開きます。
3. 本プロジェクトの [`gas_export_haiku.js`](file:///Users/nishidaryota/Library/Mobile%20Documents/com~apple~CloudDocs/omikuji-utena-main%202/gas_export_haiku.js) の内容を貼り付けて保存します。
4. スプレッドシートをリロードすると、メニュー右端に **「🌸 俳句アプリ連携」** が追加されます。

### 2. 毎月の更新フロー
1. スプレッドシートに新しい号の俳句を入力します。
2. メニューの **「🌸 俳句アプリ連携」>「📋 最新の haiku.json を書き出す」** をクリックします。
3. 表示された画面で **「💾 haiku.json をダウンロード」**（または「📋 内容をコピー」）を押します。
4. GitHub のリポジトリ画面で `haiku.json` を開いて鉛筆アイコン（編集）またはドラッグ＆ドロップで新しい内容に差し替え、**「Commit changes」** を押します。
5. **完了！**（数十秒で全読者のアプリに新しい俳句が自動反映されます）

---

## 🛠 技術仕様・特徴

- **完全静的配信**: GoogleスプレッドシートAPIへの直接通信を廃止。50人が同時にアクセスしても落ちない高耐久設計。
- **0秒起動（LocalStorage キャッシュ）**: 過去に開いたデータを端末に保持し、起動時の待ち時間をゼロに。
- **Service Worker（オフライン対応）**: 圏外や電波不良でもアプリが動作。
- **縦書き＆ルビ対応**: `｜漢字《ルビ》` および `漢字《ルビ》` の両記法を美しく縦書きレンダリング。