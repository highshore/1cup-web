import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { createPrivateKey } from "crypto";

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;

const normalizePrivateKey = (privateKey: string): string => {
  return privateKey
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
};

const isUsablePrivateKey = (privateKey: string): boolean => {
  try {
    createPrivateKey(privateKey);
    return true;
  } catch {
    return false;
  }
};

const createMockFirestore = () =>
  ({
    collection: () => ({
      count: () => ({
        get: () => Promise.resolve({ data: () => ({ count: 0 }) }),
      }),
      where: () => ({
        get: () => Promise.resolve({ docs: [] }),
      }),
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => null }),
      }),
      get: () =>
        Promise.resolve({
          docs: [],
          forEach: () => {},
        }),
    }),
  }) as any;

try {
  // Check if a Firebase app has already been initialized to prevent errors
  if (!admin.apps.length) {
    let credential: admin.credential.Credential | null = null;

    const loadCredentialFromJson = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        return admin.credential.cert(parsed as admin.ServiceAccount);
      } catch (error) {
        console.error("Failed to parse Firebase service account JSON", error);
        return null;
      }
    };

    // Try service account file first (for local development)
    if (typeof window === "undefined") {
      try {
        const serviceAccountPath = path.join(
          process.cwd(),
          "firebase_service_account.json"
        );

        if (fs.existsSync(serviceAccountPath)) {
          console.log(
            "Initializing Firebase Admin SDK with service account file"
          );
          credential = admin.credential.cert(serviceAccountPath);
        }
      } catch {
        console.log(
          "Service account file not available, trying environment variables"
        );
      }
    }

    // Use environment variables (for Vercel deployment)
    if (!credential) {
      const serviceAccountJson =
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.FIREBASE_SERVICE_ACCOUNT;
      const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

      if (serviceAccountJson) {
        credential = loadCredentialFromJson(serviceAccountJson);
      } else if (serviceAccountBase64) {
        try {
          const decoded = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
          credential = loadCredentialFromJson(decoded);
        } catch (error) {
          console.error("Failed to decode base64 Firebase service account", error);
        }
      }
    }

    if (!credential) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (projectId && privateKey && clientEmail) {
        console.log(
          "Initializing Firebase Admin SDK with environment variables"
        );
        try {
          const formattedPrivateKey = normalizePrivateKey(privateKey);

          if (!isUsablePrivateKey(formattedPrivateKey)) {
            throw new Error(
              "FIREBASE_PRIVATE_KEY is not a valid PEM private key"
            );
          }

          credential = admin.credential.cert({
            projectId,
            privateKey: formattedPrivateKey,
            clientEmail,
          });
        } catch (error) {
          console.error("Failed to create Firebase credential:", error);
        }
      } else {
        console.log(
          "Firebase environment variables not found - using mock objects for build"
        );
      }
    }

    if (credential) {
      admin.initializeApp({
        credential,
        databaseURL: "https://one-cup-eng-default-rtdb.firebaseio.com/",
      });

      db = admin.firestore();
      auth = admin.auth();
    } else {
      console.log("Firebase Admin SDK not initialized - using mock objects");
      // Create mock objects that won't break during build
      db = createMockFirestore();
      auth = {} as admin.auth.Auth;
    }
  } else {
    db = admin.firestore();
    auth = admin.auth();
  }
} catch (error) {
  console.warn("Firebase Admin SDK initialization failed:", error);
  // Create comprehensive mock objects for build time
  db = createMockFirestore();
  auth = {} as admin.auth.Auth;
}

export { db, auth };
