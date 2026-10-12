# N1 特訓引擎

JLPT N1（2026/12/06）通勤用練習 App。手機加到主畫面後可離線使用。
網址：https://silly-kashata-9a9256.netlify.app

## 檔案結構

```
index.html              App 本體（SRS 複習、練習、模考、紀錄）
sw.js                   離線快取（含題庫）
data/
  index.json            要載入的題庫檔清單
  grammar.json          文法（g）
  vocab.json            語彙（v）
  reading.json          読解（r）
  listening.json        聴解（l）
  ids.lock              用過的題目 ID，防誤刪
scripts/
  validate.mjs          題庫格式檢查
  build.mjs             Netlify 建置：檢查 → 寫入 data/build.json（版本）
functions/notion-sync.js  Notion 同步（選用）
CLAUDE.md               給 Claude Code 的出題規則
.claude/commands/       /add、/review 指令
```

## 更新題庫（用 Claude Code）

家裡電腦版、公司網頁版都一樣，在這個 repo 開 Claude Code：

| 想做的事 | 對 Claude Code 說 |
|---|---|
| 補題 | `/add 語彙 10 漢字読み`，或直接說「新增 10 題讀解」 |
| 依弱點補題 | App「紀錄」→「複製檢討包」→ 貼給 Claude Code（或 `/review` 後貼上） |

Claude Code 會改 `data/`、跑檢查、push 到 `main`，Netlify 約 1 分鐘後自動上線。
手機下次開 App 就是新題庫；確認版本：「紀錄 → 題庫 → 版本」顯示的 commit 與 GitHub 最新一致。

**題庫格式錯誤時 Netlify 建置會失敗，網站維持上一版**，不會上線壞掉的內容。

## 日常使用

| 時機 | 做什麼 |
|---|---|
| 每天 | 今日 → 開始練習（到期複習＋新題） |
| 每週日 | 模考。10/30 起建議「全真（言語知識＋読解）」 |
| 通勤分段考 | 模考中離開 App 計時暫停、作答保留，下次打開自動續考 |
| 每週 | 紀錄 → 下載完整備份（紀錄只存在手機瀏覽器） |

## Netlify 設定

- 連動 GitHub `sophia-www/japanese` 的 `main`，建置設定由 `netlify.toml` 決定（Build command `node scripts/build.mjs`、Publish `.`）。
- 檢查連動：Site configuration → Build & deploy → Continuous deployment 應顯示這個 repo。

## Notion 同步（選用）

設定環境變數 `NOTION_TOKEN`、`NOTION_DB_ID` 後重新部署即啟用；未設定時 App 會自動關閉同步。
開關與測試在「紀錄 → Notion 同步」。
