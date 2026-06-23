// Upload the 1cup_article pipeline's post-processed sample JSON + figure crops
// into Firestore `articles` and Storage `article_images/samples/<docId>/`.
//
// Idempotent: fixed doc IDs, re-running overwrites the same docs/objects.
// Sample docs carry `_preview.sample = true` so they're easy to find or delete.
//
// Usage: node scripts/upload-sample-articles.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BUCKET = "one-cup-eng.firebasestorage.app";
const PIPELINE_OUT = path.resolve(process.cwd(), "../1cup_article/output");

// Per-sample presentation config keyed by the pipeline slug (meta.slug).
const CONFIG = {
  "ft-content": {
    docId: "sample-ft-keir-starmer",
    source_url:
      "https://www.ft.com/content/ed96e673-8d46-4dec-aebc-d69863b9e801",
  },
  "wsj-business-tide-laundry-soap-procter-gamble": {
    docId: "sample-wsj-tide-evo",
    source_url:
      "https://www.wsj.com/business/tide-laundry-soap-procter-gamble-2938e8b6",
  },
  "wsj-world-uk-the-forces-that-broke-the-two-party-system-in-t": {
    docId: "sample-wsj-uk-two-party-system",
    source_url:
      "https://www.wsj.com/world/uk/the-forces-that-broke-the-two-party-system-in-the-u-k-30137b8a",
  },
};

let privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
if (
  (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
  (privateKey.startsWith("'") && privateKey.endsWith("'"))
)
  privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, "\n");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_* in .env.local");
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const bucket = getStorage().bucket(BUCKET);

async function uploadFigure(localPath, destPath, contentType = "image/jpeg") {
  const token = randomUUID();
  await bucket.upload(localPath, {
    destination: destPath,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
    destPath
  )}?alt=media&token=${token}`;
}

async function processSample(slug) {
  const dir = path.join(PIPELINE_OUT, slug);
  const jsonPath = path.join(dir, `${slug}.postprocessed.json`);
  const data = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const cfg = CONFIG[slug] || { docId: `sample-${slug}`, source_url: "" };
  const { docId } = cfg;

  // 1) Upload assets: original Datalab crops (figures/) and AI-generated
  //    alternatives (generated/). Cache uploads by local sub-path.
  const urlCache = {};
  const uploadLocal = async (subdir, file) => {
    if (!file) return null;
    const key = `${subdir}/${file}`;
    if (urlCache[key] !== undefined) return urlCache[key];
    const local = path.join(dir, subdir, file);
    try {
      await fs.access(local);
    } catch {
      urlCache[key] = null;
      return null;
    }
    const ext = file.split(".").pop().toLowerCase();
    const ct = ext === "png" ? "image/png" : "image/jpeg";
    const url = await uploadFigure(
      local,
      `article_images/samples/${docId}/${subdir}/${file}`,
      ct
    );
    urlCache[key] = url;
    console.log(`  uploaded ${subdir}/${file}`);
    return url;
  };

  const figures = [];
  for (const f of data.figures) {
    const original_url = await uploadLocal("figures", f.image_file);
    const generated_url = await uploadLocal("generated", f.generated_image_file);
    const isChart = f.kind === "chart" || f.kind === "table";
    // Photos display the AI alternative; charts/tables keep the original crop.
    const display_url = isChart
      ? original_url
      : generated_url || original_url;
    figures.push({
      kind: f.kind,
      caption: { english: f.caption?.en || "", korean: f.caption?.ko || "" },
      image_prompt: f.image_prompt,
      bbox: f.bbox,
      block_type: f.block_type,
      source_block_index: f.source_block_index,
      original_url,
      generated_url,
      display_url,
      is_hero: false,
    });
  }

  // Hero = first photo with a generated (or original) image; shown up top and
  // excluded from the inline figures grid.
  const hero =
    figures.find(
      (f) => f.kind !== "chart" && f.kind !== "table" && f.display_url
    ) || figures.find((f) => f.display_url) || null;
  if (hero) hero.is_hero = true;

  // 2) Build the Firestore article doc in the production schema, plus
  //    non-breaking extra fields that preserve the full pipeline output.
  const isoTs = data.article.published_iso;
  const ts = isoTs ? Timestamp.fromDate(new Date(isoTs)) : Timestamp.now();

  const doc = {
    title: {
      english: data.article.title.en,
      korean: data.article.title.ko,
    },
    content: {
      english: data.article.paragraphs.map((p) => p.en),
      korean: data.article.paragraphs.map((p) => p.ko),
    },
    keywords: [],
    url: cfg.source_url,
    source_url: cfg.source_url,
    image_url: hero ? hero.display_url : "",
    timestamp: ts,
    // discussion is now a flat list of English strings (house-style prompt).
    discussion_topics: (data.discussion || []).map((d) =>
      typeof d === "string" ? d : d.en
    ),
    // ---- extra fields (ignored by the current page; kept for Supabase) ----
    subtitle: {
      english: data.article.subtitle.en,
      korean: data.article.subtitle.ko,
    },
    byline: data.article.byline,
    published_raw: data.article.published_raw,
    figures,
    _preview: {
      sample: true,
      pipeline: "1cup_article",
      source_file: data.meta.source_file,
      slug,
      processed_at: data.meta.processed_at,
      uploaded_at: new Date().toISOString(),
    },
  };

  await db.collection("articles").doc(docId).set(doc, { merge: true });
  console.log(`  wrote articles/${docId}`);
  return { docId, figures: figures.length };
}

async function main() {
  // Optionally restrict to slugs passed on the CLI; default = all.
  const requested = process.argv.slice(2);
  const slugs = requested.length
    ? Object.keys(CONFIG).filter((s) => requested.includes(s))
    : Object.keys(CONFIG);
  const results = [];
  for (const slug of slugs) {
    console.log(`\n=== ${slug} ===`);
    results.push(await processSample(slug));
  }
  console.log("\nDONE");
  for (const r of results) {
    console.log(`https://1cupenglish.com/article/${r.docId}  (${r.figures} figures)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Upload failed:", err);
    process.exit(1);
  });
