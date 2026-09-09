# N1 特訓引擎

JLPT N1（2026/12/06）學習與模考工具。單頁應用，作答紀錄存在瀏覽器，透過 Netlify Function 同步到 Notion。

---

## 檔案結構

```
n1-repo/
├── index.html              應用本體（題庫、SRS、模考）
├── sw.js                   離線快取
├── icon.png                主畫面圖示
├── netlify.toml            Netlify 設定（指定函式資料夾）
├── .gitignore
├── README.md
├── functions/
│   └── notion-sync.js      寫入 Notion 的端點
└── packs/                  題包，供 App 內匯入
    ├── pack-grammar-02.json
    ├── pack-grammar-03.json
    └── pack-grammar-04.json
```

`packs/` 不影響部署，放在 repo 只是為了版控與備份。

---

## 部署步驟

### 1. 推上 GitHub

```bash
cd n1-repo
git init
git add .
git commit -m "N1 trainer"
git branch -M main
git remote add origin https://github.com/你的帳號/n1-trainer.git
git push -u origin main
```

Repo 設私有或公開都可以。

### 2. Notion 準備

1. 到 notion.so/my-integrations 建立 internal integration，複製 token（開頭 `ntn_`）
2. 打開「N1 學習紀錄」資料庫 → 右上 `•••` → 連接 → 選擇剛建立的 integration

第 2 步最常被漏掉，沒做函式會回 404。

### 3. Netlify 連接

1. Netlify → Add new site → Import an existing project → GitHub → 選這個 repo
2. **Build command 留空**
3. **Publish directory 填 `.`**
4. Deploy

### 4. 環境變數

Site configuration → Environment variables → Add：

| Key | Value |
|---|---|
| `NOTION_TOKEN` | 步驟 2 取得的 token |
| `NOTION_DB_ID` | `3cdac92e089080a0a674f202ca097259` |

**設定完必須到 Deploys → Trigger deploy → Deploy site 重新部署**，否則環境變數不會生效。

### 5. 加到 iPhone 主畫面

Safari 開啟網址 → 分享 → 加入主畫面。之後從圖示開啟是全螢幕，沒有網址列。

---

## 驗證清單

依序確認，任何一項失敗就停在那裡處理。

| # | 動作 | 通過的樣子 |
|---|---|---|
| 1 | 開 `https://網址/.netlify/functions/notion-sync?ping=1` | `{"ok":true,"db":"N1 學習紀錄","props":11,"missing":[]}` |
| 2 | 紀錄分頁 → 儲存位置 | 顯示「此瀏覽器」 |
| 3 | 答一題，關掉重開 | 紀錄還在 |
| 4 | 紀錄分頁 → 測試寫入 | Notion 出現一列「連線測試」 |
| 5 | 完成一回練習 | Notion 出現練習紀錄；當天第一次會多一列狀態快照 |
| 6 | 開飛航模式，從主畫面圖示開啟 | 仍能開啟（需先正常開過一次） |

### 常見錯誤

| 回應 | 原因 |
|---|---|
| `NOTION_TOKEN missing` | 環境變數沒設，或設了沒重新部署 |
| `401` | token 錯誤 |
| `404` | 資料庫沒分享給 integration，或 DB ID 錯 |
| `missing` 非空陣列 | Notion 欄位名稱與程式不一致，照陣列內容改欄位名 |
| 函式 404 | `netlify.toml` 沒被讀到，或 Publish directory 沒填 `.` |

---

## Notion 資料庫欄位

| 屬性 | 類型 |
|---|---|
| 識別碼 | 標題（去重用） |
| 名稱 | 文字 |
| 日期 | 日期（含時間） |
| 類型 | 選擇：練習紀錄／模擬考／狀態快照 |
| 科目 | 多選：語彙／文法／読解／聴解 |
| 題數・正確數・平均秒數・週次・連續天數 | 數字 |
| 正確率 | 公式 |
| 弱點 | 文字 |

每列的頁面內文放完整 JSON（程式碼區塊）。屬性給人看，內文給 Claude 讀。

**狀態快照**每天寫一次，內含全部題目的階段與下次複習日；新對話讀最新一列即可重建學習狀態。

---

## 日常使用

| 時機 | 做什麼 |
|---|---|
| 每天 | 開 App →「今日」→ 開始練習 |
| 每週日 | 「模考」分頁，科目依週次自動建議 |
| 收到新題包 | 「紀錄」→ 匯入題包 → 貼上 JSON。同 ID 覆蓋，屬於升級 |
| 同步失敗 | 今日頁顯示「未同步 N」，按「立即補送」 |

---

## 更新版本

題包用匯入即可，不需重新部署。若 `index.html` 本身更新：

```bash
git add . && git commit -m "update" && git push
```

Netlify 會自動部署。Service Worker 採網路優先，重新整理即取得新版。
