import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "supabase-config.js");
const examplePath = join(root, "supabase-config.example.js");

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_ANON_KEY?.trim();

if (!url && !key && existsSync(outPath)) {
  console.log("[generate-config] keeping existing supabase-config.js");
  process.exit(0);
}

let content;
if (url && key) {
  content =
    `export const SUPABASE_URL = ${JSON.stringify(url)};\n` +
    `export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`;
} else {
  content = readFileSync(examplePath, "utf8");
  if (content.includes("PASTE_YOUR")) {
    console.warn("[generate-config] example key is still a placeholder");
  }
}

writeFileSync(outPath, content, "utf8");
console.log("[generate-config] wrote supabase-config.js");
