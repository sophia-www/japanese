/* N1 特訓引擎 → Notion
   零依賴：只用 Node 18+ 內建 fetch。
   環境變數：NOTION_TOKEN、NOTION_DB_ID */

const API = "https://api.notion.com/v1";
const VER = "2022-06-28";

const json = (code, obj) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(obj)
});

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": VER,
    "Content-Type": "application/json"
  };
}

/* Notion 單一 rich_text 上限 2000 字，長 JSON 切塊 */
function codeBlocks(text) {
  const CH = 1800, chunks = [];
  for (let i = 0; i < text.length; i += CH) chunks.push(text.slice(i, i + CH));
  const out = [], PER = 40;
  for (let i = 0; i < chunks.length; i += PER) {
    out.push({
      object: "block",
      type: "code",
      code: {
        language: "json",
        rich_text: chunks.slice(i, i + PER).map(c => ({ type: "text", text: { content: c } }))
      }
    });
  }
  return out.length ? out : [];
}

const txt = (s, n = 1900) => [{ type: "text", text: { content: String(s || "").slice(0, n) } }];

exports.handler = async (event) => {
  const token = process.env.NOTION_TOKEN;
  const db = process.env.NOTION_DB_ID;

  if (!token) return json(500, { ok: false, error: "NOTION_TOKEN missing" });
  if (!db) return json(500, { ok: false, error: "NOTION_DB_ID missing" });

  /* ---- 連線測試 ---- */
  if (event.httpMethod === "GET") {
    try {
      const r = await fetch(`${API}/databases/${db}`, { headers: headers(token) });
      const b = await r.json();
      if (!r.ok) {
        return json(r.status, {
          ok: false, status: r.status, error: b.message || b.code,
          hint: r.status === 404
            ? "資料庫沒有分享給這個 integration，或 DB ID 錯誤"
            : r.status === 401 ? "token 無效" : ""
        });
      }
      const props = Object.keys(b.properties || {});
      const need = ["識別碼", "名稱", "日期", "類型", "科目", "題數", "正確數", "平均秒數", "週次", "連續天數", "弱點"];
      return json(200, {
        ok: true,
        db: (b.title || []).map(t => t.plain_text).join(""),
        props: props.length,
        missing: need.filter(n => !props.includes(n))
      });
    } catch (e) {
      return json(500, { ok: false, error: String(e) });
    }
  }

  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method not allowed" });

  let r;
  try { r = JSON.parse(event.body || "{}"); }
  catch { return json(400, { ok: false, error: "bad json" }); }
  if (!r.uid) return json(400, { ok: false, error: "uid required" });

  try {
    /* ---- 去重：查有沒有同識別碼的列 ---- */
    const q = await fetch(`${API}/databases/${db}/query`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        filter: { property: "識別碼", title: { equals: r.uid } },
        page_size: 1
      })
    });
    const qb = await q.json();
    if (q.ok && qb.results && qb.results.length) {
      return json(200, { ok: true, skipped: true, reason: "duplicate uid" });
    }

    /* ---- 建立 ---- */
    const props = {
      "識別碼": { title: txt(r.uid, 100) },
      "名稱": { rich_text: txt(r.name || r.uid, 200) },
      "日期": { date: { start: r.date || new Date().toISOString() } },
      "類型": { select: { name: r.kind || "練習紀錄" } }
    };
    if (Array.isArray(r.subjects) && r.subjects.length)
      props["科目"] = { multi_select: r.subjects.map(n => ({ name: n })) };
    if (typeof r.total === "number") props["題數"] = { number: r.total };
    if (typeof r.right === "number") props["正確數"] = { number: r.right };
    if (typeof r.avgSec === "number") props["平均秒數"] = { number: r.avgSec };
    if (typeof r.week === "number") props["週次"] = { number: r.week };
    if (typeof r.streak === "number") props["連續天數"] = { number: r.streak };
    if (r.weak) props["弱點"] = { rich_text: txt(r.weak) };

    const body = {
      parent: { database_id: db },
      properties: props,
      children: r.json ? codeBlocks(JSON.stringify(r.json)) : []
    };

    const c = await fetch(`${API}/pages`, {
      method: "POST", headers: headers(token), body: JSON.stringify(body)
    });
    const cb = await c.json();
    if (!c.ok) return json(c.status, { ok: false, status: c.status, error: cb.message || cb.code });

    return json(200, { ok: true, id: cb.id });
  } catch (e) {
    return json(500, { ok: false, error: String(e) });
  }
};
