#!/usr/bin/env node
/* Netlify 建置：先檢查題庫，通過才寫入版本資訊 data/build.json。
   檢查失敗 → 建置失敗 → 網站維持上一版，不會上線壞掉的題庫。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { counts } = await import("./validate.mjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = {
  commit: (process.env.COMMIT_REF || "local").slice(0, 7),
  builtAt: new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00"),
  counts
};
fs.writeFileSync(path.join(ROOT, "data", "build.json"), JSON.stringify(build) + "\n");
console.log("build.json:", JSON.stringify(build));
