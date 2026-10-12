#!/usr/bin/env node
/* 題庫檢查：格式錯誤就以非零結束，Netlify 建置會失敗、網站維持舊版。
   用法：node scripts/validate.mjs
   本機執行時會把新 ID 追加到 data/ids.lock（防止日後誤刪或重用 ID）。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const LOCK = path.join(DATA, "ids.lock");
const SUBJECTS = ["語彙", "文法", "読解", "聴解"];
const TYPES = ["cloze", "mc", "read", "listen"];
const D_KEYS = ["br", "w", "t", "st", "er", "ex"];

const errors = [], warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);
const isStr = v => typeof v === "string" && v.trim() !== "";

function checkRuby(where, field, s) {
  if (typeof s !== "string") return;
  const open = (s.match(/《/g) || []).length, close = (s.match(/》/g) || []).length;
  if (open !== close) err(where, `${field} 的振假名《》不成對`);
  if (/《[^》]*[^ぁ-ゖァ-ヺー・》][^》]*》/.test(s)) warn(where, `${field} 的振假名內有非假名字元`);
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { err(path.relative(ROOT, file), `JSON 解析失敗：${e.message}`); return null; }
}

const index = readJSON(path.join(DATA, "index.json"));
if (!index || !Array.isArray(index.files) || !index.files.length) err("data/index.json", "需要 files 陣列");

const ids = new Map();
const counts = {};
for (const f of index?.files || []) {
  const file = path.join(DATA, f);
  if (!fs.existsSync(file)) { err("data/index.json", `列出的 ${f} 不存在`); continue; }
  const d = readJSON(file);
  if (!d) continue;
  const W = `data/${f}`;
  if (!SUBJECTS.includes(d.subject)) err(W, `subject 必須是 ${SUBJECTS.join("/")}`);
  if (!TYPES.includes(d.type)) err(W, `type 必須是 ${TYPES.join("/")}`);
  if (!/^[a-z]+$/.test(d.prefix || "")) err(W, "prefix 必須是小寫英文字母");
  if (!Array.isArray(d.items)) { err(W, "items 必須是陣列"); continue; }

  const catPatterns = {};
  d.items.forEach((it, n) => {
    const w = `${W} #${n} ${it.id || "(無 id)"}`;
    if (!isStr(it.id)) return err(w, "缺少 id");
    if (!new RegExp(`^${d.prefix}\\d+$`).test(it.id)) err(w, `id 必須是 ${d.prefix}＋數字`);
    if (ids.has(it.id)) err(w, `id 重複（也出現在 ${ids.get(it.id)}）`);
    ids.set(it.id, W);
    if (it.retired) return;
    counts[d.subject] = (counts[d.subject] || 0) + 1;
    if (!isStr(it.c)) err(w, "缺少分類 c");
    const t = it.t || d.type;

    if (t === "cloze") {
      for (const k of ["p", "k", "m", "ja", "zh"]) if (!isStr(it[k])) err(w, `cloze 缺少 ${k}`);
      const blanks = (String(it.ja || "").match(/\{\{.+?\}\}/g) || []).length;
      if (blanks !== 1) err(w, `ja 必須剛好有一個 {{答案}}（目前 ${blanks} 個）`);
      checkRuby(w, "ja", it.ja);
      const ans = (String(it.ja || "").match(/\{\{(.+?)\}\}/) || [])[1];
      if (ans) (catPatterns[it.c] ||= new Set()).add(ans);
    } else {
      if (!isStr(it.q)) err(w, "缺少題幹 q");
      if (!Array.isArray(it.o) || it.o.length !== 4 || !it.o.every(isStr)) err(w, "o 必須是 4 個非空選項");
      else if (new Set(it.o).size !== 4) err(w, "選項有重複");
      if (!Number.isInteger(it.a) || it.a < 0 || it.a > 3) err(w, "a 必須是 0–3 的正解索引");
      if (!isStr(it.m)) err(w, "缺少解說 m");
      if (t === "read" && !isStr(it.pas)) err(w, "読解題缺少文章 pas");
      if (t === "listen" && !isStr(it.sc)) err(w, "聴解題缺少原稿 sc");
      checkRuby(w, "q", it.q);
      (it.o || []).forEach((o, i) => checkRuby(w, `o[${i}]`, o));
      if (it.pas) checkRuby(w, "pas", it.pas);
      if (it.sc) checkRuby(w, "sc", it.sc);
    }
    if (it.D !== undefined) {
      if (typeof it.D !== "object" || Array.isArray(it.D)) err(w, "D 必須是物件");
      else {
        Object.keys(it.D).forEach(k => { if (!D_KEYS.includes(k)) err(w, `D 有未知欄位 ${k}`); });
        if (it.D.w && !(Array.isArray(it.D.w) && it.D.w.every(x => Array.isArray(x) && x.length === 3)))
          err(w, "D.w 必須是 [單字, 讀音, 中文] 的陣列");
      }
    }
  });
  /* 文法填空的干擾選項取自同分類，分類太小會變簡單 */
  for (const [c, set] of Object.entries(catPatterns))
    if (set.size < 4) warn(W, `分類「${c}」只有 ${set.size} 個不同句型，干擾選項會借用其他分類`);
}

/* ID 鎖：曾經存在的 ID 不能消失（要停用請加 "retired": true） */
const locked = fs.existsSync(LOCK) ? fs.readFileSync(LOCK, "utf8").split(/\s+/).filter(Boolean) : [];
const missing = locked.filter(id => !ids.has(id));
if (missing.length) err("data/ids.lock", `這些 ID 被刪除了：${missing.join(", ")}。不可刪題，請改加 "retired": true`);

for (const w of warns) console.log("⚠ " + w);
if (errors.length) {
  for (const e of errors) console.error("✗ " + e);
  console.error(`\n題庫檢查失敗：${errors.length} 個錯誤`);
  process.exit(1);
}

if (!process.env.NETLIFY) {
  const all = [...new Set([...locked, ...ids.keys()])];
  const fresh = all.length - locked.length;
  if (fresh) fs.writeFileSync(LOCK, all.join("\n") + "\n");
  if (fresh) console.log(`ids.lock 追加 ${fresh} 個新 ID`);
}
console.log(`✓ 題庫檢查通過：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join("、")}，共 ${Object.values(counts).reduce((a, b) => a + b, 0)} 題`);
export { counts };
