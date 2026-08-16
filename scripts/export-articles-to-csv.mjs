// Export the Supabase `articles` table to articles_export.csv at the repo root.
// jsonb columns (title, content, figures, …) are flattened into dotted columns the
// same way the Firestore version did, so existing spreadsheets keep working.
//
// Usage: node scripts/export-articles-to-csv.mjs
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./_supabase.mjs";

const TABLE_NAME = "articles";
const OUTPUT_FILE = "articles_export.csv";
const PAGE_SIZE = 500;

function normalizeScalar(value) {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\\n");
}

function flattenRecord(value, prefix = "", target = {}) {
  if (value == null) {
    if (prefix) {
      target[prefix] = "";
    }
    return target;
  }

  if (Array.isArray(value)) {
    target[prefix] = normalizeScalar(value);
    return target;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0 && prefix) {
      target[prefix] = "{}";
      return target;
    }

    for (const [key, nestedValue] of entries) {
      const nestedPrefix = prefix ? `${prefix}.${key}` : key;
      flattenRecord(nestedValue, nestedPrefix, target);
    }

    return target;
  }

  target[prefix] = normalizeScalar(value);
  return target;
}

function escapeCsv(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

// Keywords live in the article_keywords junction table, not on articles.
async function fetchKeywords() {
  const byArticle = new Map();
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("article_keywords")
      .select("article_id, word")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data.length) break;

    for (const { article_id, word } of data) {
      if (!byArticle.has(article_id)) byArticle.set(article_id, []);
      byArticle.get(article_id).push(word);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return byArticle;
}

async function fetchArticles() {
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("timestamp", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  const [articles, keywordsByArticle] = await Promise.all([
    fetchArticles(),
    fetchKeywords(),
  ]);

  const rows = articles.map(({ id, ...rest }) => {
    const flattened = { id };
    flattenRecord(rest, "", flattened);
    const keywords = keywordsByArticle.get(id);
    if (keywords?.length) flattened.keywords = normalizeScalar(keywords);
    return flattened;
  });

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set(["id"]))
  ).sort((left, right) => {
    if (left === "id") {
      return -1;
    }
    if (right === "id") {
      return 1;
    }
    return left.localeCompare(right);
  });

  const csvLines = [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column] || "")).join(",")),
  ];

  const currentFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
  const outputPath = path.join(projectRoot, OUTPUT_FILE);

  await fs.writeFile(outputPath, `${csvLines.join("\n")}\n`, "utf8");

  console.log(`Exported ${rows.length} ${TABLE_NAME} rows to ${outputPath}`);
  console.log(`Columns: ${columns.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to export articles to CSV.");
  console.error(error);
  process.exitCode = 1;
});
