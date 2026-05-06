import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBC62vsKGQqdgpyC9RugoHEfh9UcRi2SMA",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "one-cup-eng.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "one-cup-eng",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "one-cup-eng.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "615807178262",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:615807178262:web:9a96a5f0d94ae628d74737",
};

const COLLECTION_NAME = "articles";
const OUTPUT_FILE = "articles_export.csv";

function isFirestoreTimestamp(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.toDate === "function" &&
    typeof value.toMillis === "function"
  );
}

function normalizeScalar(value) {
  if (value == null) {
    return "";
  }

  if (isFirestoreTimestamp(value)) {
    return value.toDate().toISOString();
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

  if (isFirestoreTimestamp(value)) {
    target[prefix] = normalizeScalar(value);
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

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  const rows = snapshot.docs.map((doc) => {
    const flattened = { id: doc.id };
    flattenRecord(doc.data(), "", flattened);
    return flattened;
  });

  rows.sort((a, b) => {
    const left = a.timestamp || "";
    const right = b.timestamp || "";
    return right.localeCompare(left);
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

  console.log(
    `Exported ${rows.length} ${COLLECTION_NAME} documents to ${outputPath}`
  );
  console.log(`Columns: ${columns.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to export articles to CSV.");
  console.error(error);
  process.exitCode = 1;
});
