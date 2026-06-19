import * as admin from "firebase-admin";
// import * as functions from "firebase-functions"; // No longer needed for config
import { onRequest, HttpsOptions } from "firebase-functions/v2/https"; // For v2
import * as logger from "firebase-functions/logger"; // v2 logger
import { YoutubeTranscript } from "youtube-transcript"; // Added for youtube-transcript
import cors from "cors";
import OpenAI from "openai";
export { startCefrBatch, pollCefrBatches } from "./cefr";
export { updateHomeStats, triggerHomeStatsUpdate } from "./updateHomeStats";

// Initialize Firebase Admin SDK only once
if (admin.apps.length === 0) {
  admin.initializeApp();
  console.log("Firebase Admin SDK initialized in index.ts");
}

import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";

// Export payment functions directly from the payment module
import {
  getPaymentWindow,
  verifyPaymentResult,
  cancelSubscription,
  stopNextBilling,
  processRecurringPayments,
  logCredentials, // <<< Make sure this export line exists
  paymentCallback,
  checkReferralCode,
} from "./payment";

// Register callable generator explicitly (avoid unused import warnings)
export { generateReferralCode } from "./payment";

// Export Kakao Auth Processor function
import { processKakaoUser } from "./processKakaoUser";
import { getAuthRecordsMap } from "./utils/authBatch";

// Initialize CORS middleware.
// Allow requests from your local frontend and a placeholder for your deployed app.
// IMPORTANT: Replace 'https://your-deployed-app-url.com' with your actual deployed frontend URL for production.
const allowedOrigins = [
  "http://localhost:5173",
  "https://onecup.dev",
  "https://one-cup-eng.web.app",
  "https://one-cup-eng.firebaseapp.com",
  "https://1cupenglish.com",
];

const corsHandler = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS policy: Blocking origin ${origin}`);
      callback(
        new Error(
          `The CORS policy for this site does not allow access from the specified Origin: ${origin}`
        ),
        false
      );
    }
  },
});

const commonHttpsOptions: HttpsOptions = {
  region: "asia-northeast3", // Seoul
  // You can set other common options here, like memory, timeoutSeconds, etc.
};

export const fetchYouTubeTranscriptProxy = onRequest(
  commonHttpsOptions,
  (request, response) => {
    corsHandler(request, response, async () => {
      logger.info(
        `Request received for fetchYouTubeTranscriptProxy. Method: ${request.method}, Origin: ${request.headers.origin}`
      );

      if (request.method !== "POST") {
        logger.warn(`Method Not Allowed: ${request.method}`);
        response.status(405).send("Method Not Allowed");
        return;
      }

      const body: any = request.body;
      const { videoId } = body; // Expecting videoId now
      logger.debug(`Request body: videoId: ${videoId ? videoId : "missing"}`);

      if (!videoId) {
        logger.warn("Missing videoId in request body.");
        response.status(400).send("Missing videoId in request body.");
        return;
      }

      try {
        logger.info(
          `Fetching transcript for videoId: ${videoId} using youtube-transcript`
        );
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);

        if (!transcript || transcript.length === 0) {
          logger.warn(
            `No transcript found or empty transcript for videoId: ${videoId}`
          );
          response
            .status(404)
            .send("No transcript found for this video using the library.");
          return;
        }

        // Format the transcript (array of {text, duration, offset}) into a single string
        const formattedTranscript = transcript
          .map(
            (item: { text: string; duration: number; offset: number }) =>
              item.text
          )
          .join(" \n");

        logger.info(
          `Successfully fetched and formatted transcript for videoId: ${videoId}. Length: ${formattedTranscript.length}`
        );
        response.setHeader("Content-Type", "text/plain");
        response.status(200).send(formattedTranscript);
      } catch (error: any) {
        logger.error(
          `Error in fetchYouTubeTranscriptProxy while using youtube-transcript for videoId ${videoId}:`,
          error
        );
        // Send a more specific error message if the library provides one
        let errorMessage = `Error fetching transcript using library: ${error.message}`;
        if (error.message && error.message.includes("Transcript is disabled")) {
          errorMessage = "Transcript is disabled for this video.";
          response.status(404).send(errorMessage);
        } else if (error.message && error.message.includes("no such video")) {
          errorMessage = "Invalid video ID or video not found.";
          response.status(404).send(errorMessage);
        } else {
          response.status(500).send(errorMessage);
        }
      }
    });
  }
);

// Export the payment functions
export {
  getPaymentWindow,
  verifyPaymentResult,
  cancelSubscription,
  stopNextBilling,
  processRecurringPayments,
  logCredentials, // <<< Make sure this export line exists
  paymentCallback,
  checkReferralCode,
  processKakaoUser,
};

// Naver Local Search API Function
export const searchNaverLocal = onRequest(
  commonHttpsOptions,
  (request, response) => {
    corsHandler(request, response, async () => {
      logger.info(
        `Request received for searchNaverLocal. Method: ${request.method}, Origin: ${request.headers.origin}`
      );

      if (request.method !== "GET") {
        logger.warn(`Method Not Allowed: ${request.method}`);
        response.status(405).send("Method Not Allowed");
        return;
      }

      const {
        query,
        display = "5",
        start = "1",
        sort = "random",
      } = request.query;

      if (!query || typeof query !== "string") {
        logger.warn("Missing or invalid query parameter.");
        response.status(400).send("Query parameter is required.");
        return;
      }

      // Get Naver API credentials from environment variables (v2 style)
      // These are set via `firebase functions:config:set naver.client_id=... naver.client_secret=...`
      // and become process.env.NAVER_CLIENT_ID and process.env.NAVER_CLIENT_SECRET
      const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
      const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

      if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        logger.error(
          "Naver API credentials not found in Firebase Function environment variables.",
          { id: !!NAVER_CLIENT_ID, secret: !!NAVER_CLIENT_SECRET }
        );
        response
          .status(500)
          .send(
            "API credentials configuration error. Check Firebase Function environment variables."
          );
        return;
      }

      const apiUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
        query
      )}&display=${display}&start=${start}&sort=${sort}`;

      try {
        logger.info(
          `Calling Naver API: ${apiUrl} with client ID: ${
            NAVER_CLIENT_ID
              ? NAVER_CLIENT_ID.substring(0, 4) + "..."
              : "MISSING"
          }`
        );

        const fetch = (await import("node-fetch")).default;

        const naverResponse = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "X-Naver-Client-Id": NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
          },
        });

        if (naverResponse.ok) {
          const data = await naverResponse.json();
          logger.info(
            `Successfully fetched ${
              data.items?.length || 0
            } results from Naver API`
          );
          response.status(200).json(data);
        } else {
          const errorText = await naverResponse.text();
          logger.error("Naver API Error:", naverResponse.status, errorText);
          response
            .status(naverResponse.status)
            .send(`Naver API Error: ${errorText}`);
        }
      } catch (error: any) {
        logger.error("Error calling Naver API:", error);
        response.status(500).send("Internal server error");
      }
    });
  }
);

interface LinkData {
  url: string;
  articleId: string;
  koreanTitle?: string;
  updated_at?: admin.firestore.Timestamp;
}

interface UserData {
  name: string;
  hasActiveSubscription: boolean;
  subscriptionEndDate?: admin.firestore.Timestamp;
  cat_business: boolean;
  cat_tech: boolean;
  phone: string;
}

// Extracted core logic into a reusable function that can run in normal or test mode
async function processAndSendLinks(testMode: boolean = false): Promise<{
  techCount: number;
  businessCount: number;
  expiryCount: number;
}> {
  try {
    const db = admin.firestore();

    // Test mode configuration - easily toggle these values
    const TEST_MODE_ENABLED = testMode;
    const TEST_PHONE_NUMBERS = ["01068584123", "01045430406"];

    if (TEST_MODE_ENABLED) {
      logger.info(
        `Running in TEST MODE for specific recipients: ${TEST_PHONE_NUMBERS.join(
          ", "
        )}`
      );
    } else {
      logger.info("Running in PRODUCTION MODE for all eligible users");
    }

    logger.debug("Starting to process and send links");

    // Get the current date (reset time to 00:00:00)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    logger.debug(
      `Current date for comparison: ${today.toISOString().split("T")[0]}`
    );

    // 1. Load URLs from tech and business links - fixing collection paths
    logger.debug("Fetching tech and business link documents from Firestore...");
    const techLinkDoc = await db.doc(`links/tech`).get();
    const businessLinkDoc = await db.doc(`links/business`).get();

    logger.debug(`Tech link document exists: ${techLinkDoc.exists}`);
    logger.debug(`Business link document exists: ${businessLinkDoc.exists}`);

    // Process tech link
    const techLinks: LinkData[] = [];
    if (techLinkDoc.exists) {
      const data = techLinkDoc.data();
      logger.debug(`Tech link data: ${JSON.stringify(data)}`);

      // Check if the link was updated today
      let shouldProcessTechLink = false;
      if (data?.updated_at) {
        const updatedDate = data.updated_at.toDate();
        const linkDate = new Date(
          updatedDate.getFullYear(),
          updatedDate.getMonth(),
          updatedDate.getDate()
        );
        shouldProcessTechLink = linkDate.getTime() === today.getTime();
        logger.debug(
          `Tech link updated_at: ${
            linkDate.toISOString().split("T")[0]
          }, should process: ${shouldProcessTechLink}`
        );
      } else {
        logger.warn("Tech link has no updated_at field");
        shouldProcessTechLink = false;
      }

      if (shouldProcessTechLink && data?.url) {
        // Extract article ID from URL (assuming it's in a format that can be parsed)
        const urlParts = data.url.split("/");
        const articleId = urlParts[urlParts.length - 1];
        logger.debug(`Extracted articleId for tech: ${articleId}`);

        // Get Korean title for this article
        logger.debug(`Fetching Korean title for tech article: ${articleId}...`);
        const articleTitleDoc = await db.doc(`articles/${articleId}`).get();
        logger.debug(
          `Article title document exists: ${articleTitleDoc.exists}`
        );
        const koreanTitle = articleTitleDoc.exists
          ? articleTitleDoc.data()?.title?.korean
          : "기술 기사";
        logger.debug(`Korean title for tech article: ${koreanTitle}`);

        techLinks.push({
          url: data.url,
          articleId,
          koreanTitle,
          updated_at: data.updated_at,
        });
      } else if (!shouldProcessTechLink) {
        logger.info(
          "Tech link not processed because updated_at date does not match current date"
        );
      } else {
        logger.warn("Tech link document exists but has no URL field");
      }
    } else {
      logger.warn("Tech link document does not exist in Firestore");
    }

    // Process business link
    const businessLinks: LinkData[] = [];
    if (businessLinkDoc.exists) {
      const data = businessLinkDoc.data();
      logger.debug(`Business link data: ${JSON.stringify(data)}`);

      // Check if the link was updated today
      let shouldProcessBusinessLink = false;
      if (data?.updated_at) {
        const updatedDate = data.updated_at.toDate();
        const linkDate = new Date(
          updatedDate.getFullYear(),
          updatedDate.getMonth(),
          updatedDate.getDate()
        );
        shouldProcessBusinessLink = linkDate.getTime() === today.getTime();
        logger.debug(
          `Business link updated_at: ${
            linkDate.toISOString().split("T")[0]
          }, should process: ${shouldProcessBusinessLink}`
        );
      } else {
        logger.warn("Business link has no updated_at field");
        shouldProcessBusinessLink = false;
      }

      if (shouldProcessBusinessLink && data?.url) {
        // Extract article ID from URL
        const urlParts = data.url.split("/");
        const articleId = urlParts[urlParts.length - 1];
        logger.debug(`Extracted articleId for business: ${articleId}`);

        // Get Korean title for this article
        logger.debug(
          `Fetching Korean title for business article: ${articleId}...`
        );
        const articleTitleDoc = await db.doc(`articles/${articleId}`).get();
        logger.debug(
          `Article title document exists: ${articleTitleDoc.exists}`
        );
        const koreanTitle = articleTitleDoc.exists
          ? articleTitleDoc.data()?.title?.korean
          : "비즈니스 기사";
        logger.debug(`Korean title for business article: ${koreanTitle}`);

        businessLinks.push({
          url: data.url,
          articleId,
          koreanTitle,
          updated_at: data.updated_at,
        });
      } else if (!shouldProcessBusinessLink) {
        logger.info(
          "Business link not processed because updated_at date does not match current date"
        );
      } else {
        logger.warn("Business link document exists but has no URL field");
      }
    } else {
      logger.warn("Business link document does not exist in Firestore");
    }

    // If no links are available, exit
    if (techLinks.length === 0 && businessLinks.length === 0) {
      logger.warn("No links available to send - exiting function early");
      return { techCount: 0, businessCount: 0, expiryCount: 0 };
    }

    // Select one link from each category to send
    const techLink = techLinks.length > 0 ? techLinks[0] : null;
    const businessLink = businessLinks.length > 0 ? businessLinks[0] : null;

    // 2. Process users - different approach based on mode
    let usersSnapshot;

    if (TEST_MODE_ENABLED) {
      // In test mode, there are two ways to fetch the test users:
      // 1. Users whose document ID directly matches one of the test phone numbers
      // 2. Users who have a phone field that, when formatted, matches one of the test phone numbers

      logger.debug(
        `Test mode: Fetching users with test phone numbers: ${TEST_PHONE_NUMBERS.join(
          ", "
        )}`
      );

      // First approach: direct ID match
      const usersByIdSnapshot = await db
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", TEST_PHONE_NUMBERS)
        .get();

      logger.debug(
        `Found ${usersByIdSnapshot.docs.length} test users by direct ID match`
      );

      // Second approach: Get all users and filter by phone number
      const allUsersSnapshot = await db.collection("users").get();

      // Filter users by formatting their phone field and checking if it matches test numbers
      const usersByPhoneField = allUsersSnapshot.docs.filter((doc) => {
        const userData = doc.data();
        if (!userData.phone) return false;

        // Format the phone number from user data to match our test format
        const formattedPhone = userData.phone
          .replace(/^\+82/, "0")
          .replace(/\D/g, "");
        return TEST_PHONE_NUMBERS.includes(formattedPhone);
      });

      logger.debug(
        `Found ${usersByPhoneField.length} additional test users by phone field match`
      );

      // Also get users whose auth phone number matches test numbers
      const matchedUserIds: string[] = [];

      // This would be more efficient if we had a way to query Auth directly by phone
      // Instead, we'll check if any of the users we haven't already matched have
      // phone numbers in Auth that match our test numbers
      for (const doc of allUsersSnapshot.docs) {
        // Skip if we already found this user by phone field
        if (usersByPhoneField.some((d) => d.id === doc.id)) continue;
        // Skip if we already found this user by ID
        if (usersByIdSnapshot.docs.some((d) => d.id === doc.id)) continue;

        try {
          const authUser = await admin.auth().getUser(doc.id);
          if (authUser.phoneNumber) {
            const formattedAuthPhone = authUser.phoneNumber
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            if (TEST_PHONE_NUMBERS.includes(formattedAuthPhone)) {
              matchedUserIds.push(doc.id);
            }
          }
        } catch (error) {
          // Ignore errors fetching auth user
        }
      }

      let usersByAuthPhone: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] =
        [];
      if (matchedUserIds.length > 0) {
        // Firebase only allows up to 10 values in an 'in' query, so we may need to chunk
        const chunks = [];
        for (let i = 0; i < matchedUserIds.length; i += 10) {
          chunks.push(matchedUserIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const chunkSnapshot = await db
            .collection("users")
            .where(admin.firestore.FieldPath.documentId(), "in", chunk)
            .get();
          usersByAuthPhone = [...usersByAuthPhone, ...chunkSnapshot.docs];
        }
      }

      logger.debug(
        `Found ${usersByAuthPhone.length} additional test users by Auth phone match`
      );

      // Combine all the users we found, ensuring no duplicates
      const combinedDocs = [
        ...usersByIdSnapshot.docs,
        ...usersByPhoneField,
        ...usersByAuthPhone,
      ];

      // Remove duplicates by user ID
      const uniqueDocsMap = new Map();
      for (const doc of combinedDocs) {
        if (!uniqueDocsMap.has(doc.id)) {
          uniqueDocsMap.set(doc.id, doc);
        }
      }

      // Create a custom snapshot-like object with the unique docs
      usersSnapshot = {
        docs: Array.from(uniqueDocsMap.values()),
        size: uniqueDocsMap.size,
        empty: uniqueDocsMap.size === 0,
        forEach: (
          callback: (
            doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
          ) => void
        ) => {
          Array.from(uniqueDocsMap.values()).forEach(callback);
        },
      };

      logger.debug(
        `Found a total of ${usersSnapshot.docs.length} unique test users`
      );
    } else {
      // In production mode, get all users
      logger.debug("Production mode: Fetching all users from Firestore...");
      usersSnapshot = await db.collection("users").get();
    }

    logger.debug(`Found ${usersSnapshot.docs.length} user documents`);

    const techRecipients: any[] = [];
    const businessRecipients: any[] = [];
    const expiryNotifications: any[] = [];

    // Resolve every user's Auth record up-front in batched getUsers calls
    // instead of multiple serial getUser round-trips inside the loop.
    const authRecords = await getAuthRecordsMap(
      usersSnapshot.docs.map((d) => d.id)
    );

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserData;
      logger.debug(
        `Processing user ${userDoc.id}: hasActiveSubscription=${userData.hasActiveSubscription}, cat_tech=${userData.cat_tech}, cat_business=${userData.cat_business}`
      );

      // Skip users without an active subscription in production mode (in test mode, we process regardless)
      if (!TEST_MODE_ENABLED && !userData.hasActiveSubscription) {
        logger.debug(
          `Skipping user ${userDoc.id} because hasActiveSubscription is ${userData.hasActiveSubscription}`
        );
        continue;
      }

      // Add to tech recipients if cat_tech is true
      if (userData.cat_tech && techLink) {
        logger.debug(`Adding user ${userDoc.id} to tech recipients`);

        // Get customer name from Firebase Auth first, then fallback to Firestore
        let customerName = "고객님"; // Default fallback
        try {
          logger.debug(
            `Fetching customer name from Auth for user ${userDoc.id}`
          );
          const authUser = authRecords.get(userDoc.id);
          if (!authUser) {
            throw new Error(`Auth record not found for ${userDoc.id}`);
          }

          if (authUser.displayName && authUser.displayName.trim() !== "") {
            customerName = authUser.displayName;
            logger.debug(
              `Using displayName from Auth as customer name: ${customerName}`
            );
          } else if (userData.name && userData.name.trim() !== "") {
            customerName = userData.name;
            logger.debug(
              `Using name from Firestore as fallback: ${customerName}`
            );
          }
        } catch (authError) {
          logger.error(
            `Error fetching user from Auth for ${userDoc.id}:`,
            authError
          );
          if (userData.name && userData.name.trim() !== "") {
            customerName = userData.name;
            logger.debug(
              `Using name from Firestore after Auth error: ${customerName}`
            );
          }
        }

        const templateParameter = {
          "korean-title": techLink.koreanTitle,
          "customer-name": customerName,
          "article-link": techLink.url,
        };

        // Get phone number only from Firebase Auth
        let recipientNo = "";
        try {
          logger.debug(
            `Fetching phone number from Auth for user ${userDoc.id}`
          );
          const authUser = authRecords.get(userDoc.id);
          if (!authUser) {
            throw new Error(`Auth record not found for ${userDoc.id}`);
          }

          if (authUser.phoneNumber) {
            // Format phone number from auth (remove country code and any non-digits)
            recipientNo = authUser.phoneNumber
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            logger.debug(
              `Found phone from Auth: ${authUser.phoneNumber}, formatted: ${recipientNo}`
            );
          } else {
            logger.warn(`No phone number found in Auth for user ${userDoc.id}`);
            // Fallback to phone field in Firestore as last resort
            if (userData.phone) {
              recipientNo = userData.phone
                .replace(/^\+82/, "0")
                .replace(/\D/g, "");
              logger.debug(
                `Using phone field from Firestore as fallback: ${recipientNo}`
              );
            }
          }
        } catch (authError) {
          logger.error(
            `Error fetching user from Auth for ${userDoc.id}:`,
            authError
          );
          // Fallback to phone field in Firestore as last resort
          if (userData.phone) {
            recipientNo = userData.phone
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            logger.debug(
              `Using phone field from Firestore as fallback after Auth error: ${recipientNo}`
            );
          }
        }

        // Skip if we couldn't find a valid phone number
        if (
          !recipientNo ||
          !recipientNo.startsWith("010") ||
          recipientNo.length < 10
        ) {
          logger.warn(
            `Could not find valid phone number for user ${userDoc.id}, skipping`
          );
          continue;
        }

        // Add the articleId to the user's received_articles array
        try {
          logger.debug(
            `Adding tech article ${techLink.articleId} to received_articles for user ${userDoc.id}`
          );
          await userDoc.ref.update({
            received_articles: admin.firestore.FieldValue.arrayUnion(
              techLink.articleId
            ),
          });
          logger.debug(
            `Successfully added article to received_articles for user ${userDoc.id}`
          );
        } catch (updateError) {
          logger.error(
            `Failed to update received_articles for user ${userDoc.id}:`,
            updateError
          );
        }

        techRecipients.push({
          recipientNo: recipientNo,
          templateParameter: templateParameter,
        });
      }

      // Add to business recipients if cat_business is true
      if (userData.cat_business && businessLink) {
        logger.debug(`Adding user ${userDoc.id} to business recipients`);

        // Get customer name from Firebase Auth first, then fallback to Firestore
        let customerName = "고객님"; // Default fallback
        try {
          logger.debug(
            `Fetching customer name from Auth for user ${userDoc.id}`
          );
          const authUser = authRecords.get(userDoc.id);
          if (!authUser) {
            throw new Error(`Auth record not found for ${userDoc.id}`);
          }

          if (authUser.displayName && authUser.displayName.trim() !== "") {
            customerName = authUser.displayName;
            logger.debug(
              `Using displayName from Auth as customer name: ${customerName}`
            );
          } else if (userData.name && userData.name.trim() !== "") {
            customerName = userData.name;
            logger.debug(
              `Using name from Firestore as fallback: ${customerName}`
            );
          }
        } catch (authError) {
          logger.error(
            `Error fetching user from Auth for ${userDoc.id}:`,
            authError
          );
          if (userData.name && userData.name.trim() !== "") {
            customerName = userData.name;
            logger.debug(
              `Using name from Firestore after Auth error: ${customerName}`
            );
          }
        }

        const templateParameter = {
          "korean-title": businessLink.koreanTitle,
          "customer-name": customerName,
          "article-link": businessLink.url,
        };

        // Get phone number only from Firebase Auth
        let recipientNo = "";
        try {
          logger.debug(
            `Fetching phone number from Auth for user ${userDoc.id}`
          );
          const authUser = authRecords.get(userDoc.id);
          if (!authUser) {
            throw new Error(`Auth record not found for ${userDoc.id}`);
          }

          if (authUser.phoneNumber) {
            // Format phone number from auth (remove country code and any non-digits)
            recipientNo = authUser.phoneNumber
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            logger.debug(
              `Found phone from Auth: ${authUser.phoneNumber}, formatted: ${recipientNo}`
            );
          } else {
            logger.warn(`No phone number found in Auth for user ${userDoc.id}`);
            // Fallback to phone field in Firestore as last resort
            if (userData.phone) {
              recipientNo = userData.phone
                .replace(/^\+82/, "0")
                .replace(/\D/g, "");
              logger.debug(
                `Using phone field from Firestore as fallback: ${recipientNo}`
              );
            }
          }
        } catch (authError) {
          logger.error(
            `Error fetching user from Auth for ${userDoc.id}:`,
            authError
          );
          // Fallback to phone field in Firestore as last resort
          if (userData.phone) {
            recipientNo = userData.phone
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            logger.debug(
              `Using phone field from Firestore as fallback after Auth error: ${recipientNo}`
            );
          }
        }

        // Skip if we couldn't find a valid phone number
        if (
          !recipientNo ||
          !recipientNo.startsWith("010") ||
          recipientNo.length < 10
        ) {
          logger.warn(
            `Could not find valid phone number for user ${userDoc.id}, skipping`
          );
          continue;
        }

        // Add the articleId to the user's received_articles array
        try {
          logger.debug(
            `Adding business article ${businessLink.articleId} to received_articles for user ${userDoc.id}`
          );
          await userDoc.ref.update({
            received_articles: admin.firestore.FieldValue.arrayUnion(
              businessLink.articleId
            ),
          });
          logger.debug(
            `Successfully added article to received_articles for user ${userDoc.id}`
          );
        } catch (updateError) {
          logger.error(
            `Failed to update received_articles for user ${userDoc.id}:`,
            updateError
          );
        }

        businessRecipients.push({
          recipientNo: recipientNo,
          templateParameter: templateParameter,
        });
      }

      // Update the user's last_received timestamp if they received an article
      logger.debug(
        `Checking if last_received needs update for user ${userDoc.id}`
      );
      try {
        // Create an update object
        const updates: any = {};

        // Add last_received timestamp if user received any article today
        const receivedTech = userData.cat_tech && techLink;
        const receivedBusiness = userData.cat_business && businessLink;

        if (receivedTech || receivedBusiness) {
          updates.last_received = admin.firestore.FieldValue.serverTimestamp();
          logger.debug(`Adding last_received timestamp for user ${userDoc.id}`);
        }

        // Apply the updates only if there's something to update
        if (Object.keys(updates).length > 0) {
          await userDoc.ref.update(updates);
          logger.debug(
            `Successfully updated user ${userDoc.id} (last_received)`
          );
        } else {
          logger.debug(`No updates needed for user ${userDoc.id}`);
        }
      } catch (updateError) {
        logger.error(`Failed to update user ${userDoc.id}:`, updateError);
      }
    }

    logger.debug(`Processing complete. Recipients summary:
      - Tech recipients: ${techRecipients.length}
      - Business recipients: ${businessRecipients.length}
      - Expiry notifications: ${expiryNotifications.length}`);

    // 3. Send Kakao messages
    // Send to tech recipients
    if (techRecipients.length > 0) {
      logger.debug(
        `Sending Kakao messages to ${techRecipients.length} tech recipients...`
      );
      try {
        const techResult = await sendKakaoMessages(
          techRecipients,
          "send-article"
        );
        logger.debug(`Tech Kakao result: ${JSON.stringify(techResult)}`);
      } catch (kakaoError) {
        logger.error("Error sending tech Kakao messages:", kakaoError);
      }
    } else {
      logger.debug("No tech recipients to send messages to");
    }

    // Send to business recipients
    if (businessRecipients.length > 0) {
      logger.debug(
        `Sending Kakao messages to ${businessRecipients.length} business recipients...`
      );
      try {
        const businessResult = await sendKakaoMessages(
          businessRecipients,
          "send-article"
        );
        logger.debug(
          `Business Kakao result: ${JSON.stringify(businessResult)}`
        );
      } catch (kakaoError) {
        logger.error("Error sending business Kakao messages:", kakaoError);
      }
    } else {
      logger.debug("No business recipients to send messages to");
    }

    // Send expiry notifications
    if (expiryNotifications.length > 0) {
      logger.debug(
        `Sending expiry notifications to ${expiryNotifications.length} users...`
      );
      try {
        const expiryResult = await sendKakaoMessages(
          expiryNotifications,
          "subscription-expired"
        );
        logger.debug(
          `Expiry notification Kakao result: ${JSON.stringify(expiryResult)}`
        );
      } catch (kakaoError) {
        logger.error("Error sending expiry Kakao messages:", kakaoError);
      }
    } else {
      logger.debug("No expiry notifications to send");
    }

    logger.info(
      `Sent messages to: ${techRecipients.length} tech users, ${businessRecipients.length} business users`
    );
    logger.info(
      `Sent expiry notifications to: ${expiryNotifications.length} users`
    );

    return {
      techCount: techRecipients.length,
      businessCount: businessRecipients.length,
      expiryCount: expiryNotifications.length,
    };
  } catch (error) {
    logger.error("Error in processAndSendLinks:", error);
    throw error;
  }
}

// Scheduled function that runs automatically (in production mode)
export const sendLinksToUsers = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async (event: ScheduledEvent): Promise<void> => {
    try {
      await processAndSendLinks(false); // false = production mode
      return;
    } catch (error) {
      logger.error("Error in scheduled function:", error);
      return;
    }
  }
);

// HTTP callable function for manual testing with specific recipients
export const testSendLinksToUsers = onCall(
  {
    enforceAppCheck: false, // Set to true in production
    region: "asia-northeast3",
  },
  async (request) => {
    try {
      const result = await processAndSendLinks(true); // true = test mode
      return {
        success: true,
        message: "Test links sent successfully to specified recipients",
        stats: result,
      };
    } catch (error: any) {
      logger.error("Error in test function:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }
);

// New function to send links to specific category users
export const sendLinksToCategory = onCall(
  {
    enforceAppCheck: false, // Set to true in production
    region: "asia-northeast3",
  },
  async (request) => {
    try {
      const { category, testMode = true } = request.data;

      if (!category || (category !== "tech" && category !== "business")) {
        throw new Error("Invalid category. Must be 'tech' or 'business'.");
      }

      logger.info(
        `Manual sending to category: ${category}, test mode: ${testMode}`
      );

      // Use the core processing function but with category filter
      const result = await processCategoryLinks(category, testMode);

      return {
        success: true,
        message: `Links sent successfully to ${category} category subscribers${
          testMode ? " (test mode)" : ""
        }`,
        stats: result,
      };
    } catch (error: any) {
      logger.error("Error in category send function:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }
);

// Function to process and send links to a specific category
async function processCategoryLinks(
  category: "tech" | "business",
  testMode: boolean = true
): Promise<{
  recipientCount: number;
}> {
  try {
    const db = admin.firestore();

    // Test mode configuration
    const TEST_MODE_ENABLED = testMode;
    const TEST_PHONE_NUMBERS = ["01068584123", "01045430406"];

    if (TEST_MODE_ENABLED) {
      logger.info(
        `Running in TEST MODE for specific recipients: ${TEST_PHONE_NUMBERS.join(
          ", "
        )}`
      );
    } else {
      logger.info("Running in PRODUCTION MODE for all eligible users");
    }

    logger.debug(
      `Starting to process and send links to ${category} category subscribers`
    );

    // Get the current date
    // const now = new Date();

    // 1. Load URL for the specified category
    logger.debug(`Fetching ${category} link document from Firestore...`);
    const linkDoc = await db.doc(`links/${category}`).get();

    if (!linkDoc.exists) {
      logger.error(`${category} link document does not exist in Firestore`);
      throw new Error(`${category} link document does not exist`);
    }

    const data = linkDoc.data();
    logger.debug(`${category} link data: ${JSON.stringify(data)}`);

    // Check if we have a valid URL
    if (!data?.url) {
      logger.error(`${category} link document has no URL field`);
      throw new Error(`No URL found for ${category} category`);
    }

    // Extract article ID from URL
    const urlParts = data.url.split("/");
    const articleId = urlParts[urlParts.length - 1];
    logger.debug(`Extracted articleId for ${category}: ${articleId}`);

    // Get Korean title for this article
    logger.debug(
      `Fetching Korean title for ${category} article: ${articleId}...`
    );
    const articleTitleDoc = await db.doc(`articles/${articleId}`).get();
    logger.debug(`Article title document exists: ${articleTitleDoc.exists}`);
    const koreanTitle = articleTitleDoc.exists
      ? articleTitleDoc.data()?.title?.korean
      : `${category === "tech" ? "기술" : "비즈니스"} 기사`;
    logger.debug(`Korean title for ${category} article: ${koreanTitle}`);

    // Initialize usersSnapshot as an empty object with the expected properties
    let usersSnapshot: {
      docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[];
      size: number;
      empty: boolean;
      forEach: (
        callback: (
          doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
        ) => void
      ) => void;
    } = {
      docs: [],
      size: 0,
      empty: true,
      forEach: () => {},
    };

    if (TEST_MODE_ENABLED) {
      // In test mode, only get test users who subscribe to this category
      logger.debug(
        `Test mode: Fetching users with test phone numbers who subscribe to ${category}...`
      );

      // First approach: direct ID match - without left_count filter for test mode
      const usersByIdSnapshot = await db
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", TEST_PHONE_NUMBERS)
        .where(category === "tech" ? "cat_tech" : "cat_business", "==", true)
        .get();

      logger.debug(
        `Found ${usersByIdSnapshot.docs.length} test users who subscribe to ${category} by direct ID match`
      );

      // Second approach: Get all users who subscribe to this category - without left_count filter for test mode
      const allUsersSnapshot = await db
        .collection("users")
        .where(category === "tech" ? "cat_tech" : "cat_business", "==", true)
        .get();

      // Filter users by formatting their phone field and checking if it matches test numbers
      const usersByPhoneField = allUsersSnapshot.docs.filter((doc) => {
        const userData = doc.data();
        if (!userData.phone) return false;

        // Format the phone number from user data to match our test format
        const formattedPhone = userData.phone
          .replace(/^\+82/, "0")
          .replace(/\D/g, "");
        return TEST_PHONE_NUMBERS.includes(formattedPhone);
      });

      logger.debug(
        `Found ${usersByPhoneField.length} additional test users who subscribe to ${category} by phone field match`
      );

      // Combine all the users we found, ensuring no duplicates
      const combinedDocs = [...usersByIdSnapshot.docs, ...usersByPhoneField];

      // Remove duplicates by user ID
      const uniqueDocsMap = new Map();
      for (const doc of combinedDocs) {
        if (!uniqueDocsMap.has(doc.id)) {
          uniqueDocsMap.set(doc.id, doc);
        }
      }

      // Create a custom snapshot-like object with the filtered docs
      usersSnapshot = {
        docs: Array.from(uniqueDocsMap.values()),
        size: uniqueDocsMap.size,
        empty: uniqueDocsMap.size === 0,
        forEach: (
          callback: (
            doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
          ) => void
        ) => {
          Array.from(uniqueDocsMap.values()).forEach(callback);
        },
      };

      logger.debug(
        `Found a total of ${usersSnapshot.docs.length} unique test users who subscribe to ${category}`
      );
    } else {
      // In production mode, get all users who subscribe to this category
      logger.debug(
        `Production mode: Fetching all users who subscribe to ${category}...`
      );

      // Try a different approach - first get all users who subscribe to this category
      const usersWithCategorySnapshot = await db
        .collection("users")
        .where(category === "tech" ? "cat_tech" : "cat_business", "==", true)
        .get();

      logger.debug(
        `Found ${usersWithCategorySnapshot.docs.length} ${category} subscribers`
      );

      // Then filter locally by left_count
      const filteredDocs = usersWithCategorySnapshot.docs.filter((doc) => {
        const userData = doc.data();
        return userData.hasActiveSubscription;
      });

      logger.debug(
        `After filtering, found ${filteredDocs.length} ${category} subscribers with active subscription`
      );

      // Create a custom snapshot-like object with the filtered docs
      usersSnapshot = {
        docs: filteredDocs,
        size: filteredDocs.length,
        empty: filteredDocs.length === 0,
        forEach: (
          callback: (
            doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
          ) => void
        ) => {
          filteredDocs.forEach(callback);
        },
      };
    }

    if (usersSnapshot.empty) {
      logger.warn(`No eligible ${category} subscribers found`);
      return { recipientCount: 0 };
    }

    const recipients: any[] = [];

    // Resolve every user's Auth record up-front in batched getUsers calls
    // instead of multiple serial getUser round-trips inside the loop.
    const authRecords = await getAuthRecordsMap(
      usersSnapshot.docs.map((d) => d.id)
    );

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserData;
      logger.debug(
        `Processing user ${userDoc.id}: hasActiveSubscription=${userData.hasActiveSubscription}`
      );

      // Skip users without an active subscription in production mode (in test mode, we process regardless)
      if (!TEST_MODE_ENABLED && !userData.hasActiveSubscription) {
        logger.debug(
          `Skipping user ${userDoc.id} because hasActiveSubscription is ${userData.hasActiveSubscription}`
        );
        continue;
      }

      // Get customer name from Firebase Auth first, then fallback to Firestore
      let customerName = "고객님"; // Default fallback
      try {
        logger.debug(`Fetching customer name from Auth for user ${userDoc.id}`);
        const authUser = authRecords.get(userDoc.id);
        if (!authUser) {
          throw new Error(`Auth record not found for ${userDoc.id}`);
        }

        if (authUser.displayName && authUser.displayName.trim() !== "") {
          customerName = authUser.displayName;
          logger.debug(
            `Using displayName from Auth as customer name: ${customerName}`
          );
        } else if (userData.name && userData.name.trim() !== "") {
          customerName = userData.name;
          logger.debug(
            `Using name from Firestore as fallback: ${customerName}`
          );
        }
      } catch (authError) {
        logger.error(
          `Error fetching user from Auth for ${userDoc.id}:`,
          authError
        );
        if (userData.name && userData.name.trim() !== "") {
          customerName = userData.name;
          logger.debug(
            `Using name from Firestore after Auth error: ${customerName}`
          );
        }
      }

      // Create template parameter for the message
      const templateParameter = {
        "korean-title": koreanTitle,
        "customer-name": customerName,
        "article-link": data.url,
      };

      // Get phone number only from Firebase Auth
      let recipientNo = "";
      try {
        logger.debug(`Fetching phone number from Auth for user ${userDoc.id}`);
        const authUser = authRecords.get(userDoc.id);
        if (!authUser) {
          throw new Error(`Auth record not found for ${userDoc.id}`);
        }

        if (authUser.phoneNumber) {
          // Format phone number from auth (remove country code and any non-digits)
          recipientNo = authUser.phoneNumber
            .replace(/^\+82/, "0")
            .replace(/\D/g, "");
          logger.debug(
            `Found phone from Auth: ${authUser.phoneNumber}, formatted: ${recipientNo}`
          );
        } else {
          logger.warn(`No phone number found in Auth for user ${userDoc.id}`);
          // Fallback to phone field in Firestore as last resort
          if (userData.phone) {
            recipientNo = userData.phone
              .replace(/^\+82/, "0")
              .replace(/\D/g, "");
            logger.debug(
              `Using phone field from Firestore as fallback: ${recipientNo}`
            );
          }
        }
      } catch (authError) {
        logger.error(
          `Error fetching user from Auth for ${userDoc.id}:`,
          authError
        );
        // Fallback to phone field in Firestore as last resort
        if (userData.phone) {
          recipientNo = userData.phone.replace(/^\+82/, "0").replace(/\D/g, "");
          logger.debug(
            `Using phone field from Firestore as fallback after Auth error: ${recipientNo}`
          );
        }
      }

      // Skip if we couldn't find a valid phone number
      if (
        !recipientNo ||
        !recipientNo.startsWith("010") ||
        recipientNo.length < 10
      ) {
        logger.warn(
          `Could not find valid phone number for user ${userDoc.id}, skipping`
        );
        continue;
      }

      // Add the articleId to the user's received_articles array and update last_received
      try {
        logger.debug(
          `Adding article ${articleId} to received_articles for user ${userDoc.id}`
        );

        const updates: any = {
          received_articles: admin.firestore.FieldValue.arrayUnion(articleId),
          last_received: admin.firestore.FieldValue.serverTimestamp(),
        };

        await userDoc.ref.update(updates);
        logger.debug(`Successfully updated user ${userDoc.id}`);
      } catch (updateError) {
        logger.error(`Failed to update user ${userDoc.id}:`, updateError);
      }

      recipients.push({
        recipientNo: recipientNo,
        templateParameter: templateParameter,
      });
    }

    logger.debug(`Processing complete. Recipients count: ${recipients.length}`);

    // 3. Send Kakao messages
    if (recipients.length > 0) {
      logger.debug(
        `Sending Kakao messages to ${recipients.length} recipients...`
      );
      try {
        const result = await sendKakaoMessages(recipients, "send-article");
        logger.debug(`Kakao result: ${JSON.stringify(result)}`);
      } catch (kakaoError) {
        logger.error(`Error sending ${category} Kakao messages:`, kakaoError);
        throw kakaoError;
      }
    } else {
      logger.debug(`No ${category} recipients to send messages to`);
    }

    logger.info(`Sent messages to: ${recipients.length} ${category} users`);

    return { recipientCount: recipients.length };
  } catch (error) {
    logger.error(`Error in processCategoryLinks:`, error);
    throw error;
  }
}

export async function sendKakaoMessages(
  recipientList: any[],
  templateCode: string
) {
  logger.debug(
    `Preparing to send Kakao messages with template: ${templateCode}`
  );
  logger.debug(
    `Recipient list sample (first recipient): ${JSON.stringify(
      recipientList[0]
    )}`
  );

  const data = {
    senderKey: "1763d8030dde5f5f369ea0a088598c2fb4c792ab",
    templateCode: templateCode,
    recipientList: recipientList,
  };

  const headers = {
    "X-Secret-Key": "PuyyHGNZ",
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...headers,
    },
    body: JSON.stringify(data),
  };

  logger.debug(`Kakao API request body: ${options.body}`);
  logger.debug(
    `Sending Kakao API request to: https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/LROcHEW7abBbFhzc/messages`
  );

  try {
    // Using fetch instead of UrlFetchApp (which is for Google Apps Script)
    const response = await fetch(
      "https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/LROcHEW7abBbFhzc/messages",
      options
    );

    logger.debug(
      `Kakao API response status: ${response.status} ${response.statusText}`
    );
    const responseText = await response.text();
    logger.debug(`Kakao API response body: ${responseText}`);

    if (!response.ok) {
      throw new Error(
        `Failed to send Kakao messages: ${response.status} ${response.statusText}, Response: ${responseText}`
      );
    }

    return JSON.parse(responseText);
  } catch (error) {
    logger.error("Error sending Kakao messages:", error);
    throw error;
  }
}

// New function to send meetup reminders to all participants
export const sendMeetupReminder = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const { eventId } = request.data;

      if (!eventId || typeof eventId !== "string") {
        throw new Error("Invalid or missing eventId parameter");
      }

      logger.info(`Sending meetup reminder for event: ${eventId}`);

      // Fetch the event data from Firestore
      const eventDoc = await admin
        .firestore()
        .collection("meetup")
        .doc(eventId)
        .get();

      if (!eventDoc.exists) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      const eventData = eventDoc.data();
      if (!eventData) {
        throw new Error(`Event data is empty for ID ${eventId}`);
      }

      // Extract leaders and participants arrays
      const leaders = eventData.leaders || [];
      const participants = eventData.participants || [];
      const allParticipants = [...leaders, ...participants];

      // Remove duplicates in case someone is both a leader and participant
      const uniqueParticipants = Array.from(new Set(allParticipants));

      if (uniqueParticipants.length === 0) {
        logger.info(`No participants found for event ${eventId}`);
        return {
          success: true,
          messagesSent: 0,
          message: "No participants to notify",
        };
      }

      logger.info(
        `Found ${uniqueParticipants.length} total participants (${leaders.length} leaders + ${participants.length} participants) for event ${eventId}`
      );

      // Format event date and time for Korean display
      let eventDate: Date;

      // Handle Firestore Timestamp
      if (
        eventData.date_time &&
        typeof eventData.date_time.toDate === "function"
      ) {
        // Firestore Timestamp
        eventDate = eventData.date_time.toDate();
      } else if (eventData.date_time && eventData.date_time.seconds) {
        // Firestore Timestamp object
        eventDate = new Date(eventData.date_time.seconds * 1000);
      } else if (typeof eventData.date_time === "string") {
        // ISO string
        eventDate = new Date(eventData.date_time);
      } else {
        // Fallback to current date
        eventDate = new Date();
      }

      const koreanTime = eventDate.toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      });

      // Prepare template parameters
      const templateParams = {
        "meetup-time": koreanTime,
        "meetup-location": `${eventData.location_name} (${eventData.location_address})`,
        "meetup-link": `https://1cupenglish.com/meetup/${eventId}`,
      };

      // Prepare recipient list with phone numbers.
      // Resolve all participant Auth records in batched getUsers calls.
      const recipientList = [];
      const participantAuth = await getAuthRecordsMap(uniqueParticipants);

      for (const participantUid of uniqueParticipants) {
        const userRecord = participantAuth.get(participantUid);
        if (!userRecord) {
          logger.error(
            `Error fetching user ${participantUid} from Auth (not found)`
          );
          continue;
        }

        const phoneNumber = userRecord.phoneNumber;

        if (phoneNumber) {
          // Convert phone number format (remove +82 and replace with 0)
          const recipientNo = phoneNumber
            .replace(/^\+82/, "0")
            .replace(/\D/g, "");

          // Validate phone number format
          if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
            recipientList.push({
              recipientNo: recipientNo,
              templateParameter: templateParams,
            });
            logger.info(
              `Added participant ${participantUid} with phone ${recipientNo} to recipient list`
            );
          } else {
            logger.warn(
              `Invalid phone number format for participant ${participantUid}: ${recipientNo}`
            );
          }
        } else {
          logger.warn(
            `No phone number found for participant ${participantUid}`
          );
        }
      }

      if (recipientList.length === 0) {
        logger.warn(
          `No valid phone numbers found for any participants in event ${eventId}`
        );
        return {
          success: true,
          messagesSent: 0,
          message: "No participants with valid phone numbers found",
        };
      }

      // Send Kakao messages
      logger.info(
        `Sending meetup reminder to ${recipientList.length} participants`
      );
      const result = await sendKakaoMessages(recipientList, "meetup-reminder");

      logger.info(
        `Successfully sent meetup reminder for event ${eventId}. Messages sent: ${recipientList.length}`
      );

      return {
        success: true,
        messagesSent: recipientList.length,
        kakaoResult: result,
        message: `Successfully sent reminder to ${recipientList.length} participants`,
      };
    } catch (error) {
      logger.error(`Error in sendMeetupReminder: ${error}`);
      throw new Error(`Failed to send meetup reminder: ${error}`);
    }
  }
);

// New function to retrieve display names from Firebase Auth
export const getUserDisplayNames = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const { userIds } = request.data;

      if (!userIds || !Array.isArray(userIds)) {
        throw new Error("Invalid or missing userIds parameter");
      }

      logger.info(`Retrieving display names for ${userIds.length} users`);

      const displayNames: Record<string, string> = {};
      const phoneNumbers: Record<string, string> = {};

      // Process users in batches of 10 to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const promises = batch.map(async (userId: string) => {
          try {
            const userRecord = await admin.auth().getUser(userId);
            displayNames[userId] = userRecord.displayName || "";
            phoneNumbers[userId] = userRecord.phoneNumber || "";
          } catch (error) {
            logger.error(`Error retrieving user ${userId}: ${error}`);
            displayNames[userId] = "";
            phoneNumbers[userId] = "";
          }
        });

        await Promise.all(promises);
      }

      logger.info(
        `Successfully retrieved ${
          Object.keys(displayNames).length
        } user records`
      );
      return { displayNames, phoneNumbers };
    } catch (error) {
      logger.error(`Error in getUserDisplayNames: ${error}`);
      throw new Error(`Failed to retrieve user data: ${error}`);
    }
  }
);

// List all users with gdg_member === true
export const listGdgMembers = onCall(
  { region: "asia-northeast3" },
  async (_request) => {
    try {
      const db = admin.firestore();
      const snap = await db
        .collection("users")
        .where("gdg_member", "==", true)
        .get();

      if (snap.empty) {
        return { members: [] };
      }

      const members: Array<{
        uid: string;
        displayName: string;
        phoneLast4: string;
        account_status?: string;
        hasActiveSubscription?: boolean;
      }> = [];

      // Resolve all Auth records in batched getUsers calls instead of
      // one serial getUser per member.
      const authRecords = await getAuthRecordsMap(snap.docs.map((d) => d.id));

      for (const doc of snap.docs) {
        const uid = doc.id;
        const data = doc.data() || {} as any;
        const userRecord = authRecords.get(uid);

        // If user is missing in Auth, fall back to Firestore name field.
        const displayName = userRecord
          ? userRecord.displayName || ""
          : data.displayName || data.name || "";
        const phoneNumber = userRecord?.phoneNumber || "";

        const phoneLast4 = phoneNumber.replace(/\D/g, "").slice(-4) || "";

        members.push({
          uid,
          displayName,
          phoneLast4,
          account_status: data.account_status,
          hasActiveSubscription: data.hasActiveSubscription === true,
        });
      }

      return { members };
    } catch (error: any) {
      throw new Error(`Failed to list GDG members: ${error.message || String(error)}`);
    }
  }
);

// OpenAI client will be initialized inside functions when needed

interface SpeakingAnalysisRequest {
  transcriptId: string;
  speakerMappings: Record<string, string>; // speaker ID -> participant UID
  transcriptContent: any[];
  analysisType?: "simple" | "comprehensive"; // New parameter for analysis type
  prompt?: string; // For simple analysis
  model?: string; // For simple analysis
}

interface UserSpeakingReport {
  userId: string;
  transcriptId: string;
  speakerId: string;
  userScript: string;
  analysis: {
    overallScore: number;
    fluency: {
      score: number;
      feedback: string;
    };
    vocabulary: {
      score: number;
      feedback: string;
    };
    grammar: {
      score: number;
      feedback: string;
    };
    pronunciation: {
      score: number;
      feedback: string;
    };
    engagement: {
      score: number;
      feedback: string;
    };
    strengths: string[];
    areasForImprovement: string[];
    specificSuggestions: string[];
  };
  metadata: {
    wordCount: number;
    speakingDuration: number;
    averageWordsPerMinute: number;
    createdAt: admin.firestore.Timestamp;
    articleId?: string;
    sessionNumber?: number;
  };
}

export const generateSpeakingReports = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 300, // 5 minutes timeout for AI processing
    memory: "1GiB",
  },
  async (request) => {
    const {
      transcriptId,
      speakerMappings,
      transcriptContent,
      analysisType = "comprehensive",
      prompt,
      model = "gpt-4o-mini",
    }: SpeakingAnalysisRequest = request.data;

    // Initialize OpenAI client inside the function
    const apiKey = process.env.NEXT_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Handle simple analysis (replaces the old API route)
    if (analysisType === "simple") {
      if (!prompt) {
        throw new Error("Prompt is required for simple analysis");
      }

      try {
        logger.info("Starting simple speech analysis");

        const completion = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert English language assessment AI specializing in analyzing Korean learners' speaking skills. Provide precise, professional evaluations using the specified scoring system and respond only in valid JSON format.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent scoring
          max_tokens: 800,
          response_format: { type: "json_object" },
        });

        const analysisContent = completion.choices[0]?.message?.content;
        if (!analysisContent) {
          throw new Error("No analysis content received from OpenAI");
        }

        // Parse the JSON response from OpenAI
        let analysis;
        try {
          analysis = JSON.parse(analysisContent);
        } catch (parseError) {
          logger.error("Failed to parse OpenAI response:", analysisContent);
          throw new Error("Invalid response format from OpenAI");
        }

        // Validate the analysis structure
        if (!analysis.complexity || !analysis.accuracy || !analysis.fluency) {
          logger.error("Invalid analysis structure:", analysis);
          throw new Error("Invalid analysis structure received");
        }

        logger.info("Simple speech analysis completed successfully");
        return {
          success: true,
          analysis,
          model: model,
          usage: completion.usage,
        };
      } catch (error) {
        logger.error("Error in simple speech analysis:", error);
        throw new Error(
          `Simple analysis failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle comprehensive analysis (original logic)
    if (!transcriptId || !speakerMappings || !transcriptContent) {
      throw new Error(
        "Missing required parameters for comprehensive analysis: transcriptId, speakerMappings, or transcriptContent"
      );
    }

    try {
      logger.info(`Starting report generation for transcript ${transcriptId}`);

      // Get transcript document for metadata
      const transcriptDoc = await admin
        .firestore()
        .doc(`transcripts/${transcriptId}`)
        .get();
      const transcriptData = transcriptDoc.data();

      if (!transcriptData) {
        throw new Error("Transcript not found");
      }

      const reports: UserSpeakingReport[] = [];

      // Group speakerIds by userId to merge multiple speaker labels for the same person
      // Ignore unmapped or falsy userIds
      const userIdToSpeakerIds: Record<string, string[]> = {};
      Object.entries(speakerMappings).forEach(([speakerId, userId]) => {
        if (!userId) return;
        if (!userIdToSpeakerIds[userId]) userIdToSpeakerIds[userId] = [];
        userIdToSpeakerIds[userId].push(speakerId);
      });

      // Process each user (merged across all mapped speakerIds)
      for (const [userId, speakerIds] of Object.entries(userIdToSpeakerIds)) {
        logger.info(
          `Processing merged speakers [${speakerIds.join(
            ", "
          )}] -> user ${userId}`
        );

        // Extract user's script across all mapped speakerIds
        const userScript = extractUserScriptForSpeakers(
          transcriptContent,
          speakerIds
        );

        if (!userScript || userScript.trim().length === 0) {
          logger.warn(
            `No script found for speakers [${speakerIds.join(", ")}], skipping`
          );
          continue;
        }

        // Calculate speaking metrics (merged across speakerIds)
        const wordCount = userScript
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        const speakingDuration = calculateSpeakingDurationForSpeakers(
          transcriptContent,
          speakerIds
        );
        const averageWordsPerMinute =
          speakingDuration > 0 ? wordCount / (speakingDuration / 60) : 0;

        // Compute richer local metrics for metadata
        const allSegments = extractSegments(transcriptContent);
        const merged = computeMergedUserSegments(allSegments, speakerIds);
        const turnStats = computeTurnMetrics(merged.userSegments);
        const interactionStats = computeInteractionMetrics(
          allSegments,
          merged.userSegments
        );
        const lexical = computeLexicalMetrics(userScript);

        // Generate AI analysis
        const analysis = await generateAIAnalysis(
          userScript,
          wordCount,
          speakingDuration,
          openai
        );

        // Create report object
        const report: UserSpeakingReport = {
          userId,
          transcriptId,
          speakerId: speakerIds.join("+"),
          userScript,
          analysis,
          metadata: {
            wordCount,
            speakingDuration,
            averageWordsPerMinute,
            createdAt: admin.firestore.Timestamp.now(),
            articleId: transcriptData.articleId,
            sessionNumber: transcriptData.sessionNumber,
            // Extended metrics
            ...(turnStats && {
              speakingTurns: turnStats.turns,
              avgTurnDuration: round2(turnStats.avgTurnSec),
              longestTurn: round2(turnStats.longestTurnSec),
            }),
            ...(lexical && {
              uniqueWords: lexical.uniqueWords,
              lexicalDiversity: round2(lexical.lexicalDiversityPct),
            }),
            ...(interactionStats && {
              avgResponseLatency: round2(
                interactionStats.avgResponseLatencySec
              ),
              interruptions: interactionStats.interruptions,
              talkTimeShare: round2(
                interactionStats.userTalkTimeSec > 0
                  ? (interactionStats.userTalkTimeSec /
                      interactionStats.totalTalkTimeSec) *
                      100
                  : 0
              ),
            }),
          } as any,
        };

        reports.push(report);

        // Save individual report to Firestore (deterministic doc id per transcript/user to prevent duplicates)
        const reportDocId = `${transcriptId}_${userId}`;
        await admin.firestore().doc(`reports/${reportDocId}`).set(report);

        // Also save/update under the user's document as a subcollection for per-user history
        await admin
          .firestore()
          .doc(`users/${userId}/speaking_reports/${reportDocId}`)
          .set(report);

        logger.info(
          `Report generated and saved for user ${userId}: ${wordCount} words, ${speakingDuration.toFixed(
            1
          )}s (merged speakers)`
        );
      }

      // Update transcript document with report generation info
      await admin.firestore().doc(`transcripts/${transcriptId}`).update({
        reportsGenerated: true,
        reportsGeneratedAt: admin.firestore.Timestamp.now(),
        reportCount: reports.length,
      });

      logger.info(
        `Successfully generated ${reports.length} reports for transcript ${transcriptId}`
      );

      return {
        success: true,
        reportCount: reports.length,
        reports: reports.map((r) => ({
          userId: r.userId,
          overallScore: r.analysis.overallScore,
          wordCount: r.metadata.wordCount,
        })),
      };
    } catch (error) {
      logger.error("Error generating speaking reports:", error);
      throw new Error(
        `Failed to generate reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// Deprecated single-speaker helpers kept for reference

// New: extract script for multiple speakers
function extractUserScriptForSpeakers(
  transcriptContent: any[],
  speakerIds: string[]
): string {
  const set = new Set(speakerIds);
  const userWords: string[] = [];
  transcriptContent.forEach((item) => {
    if (item.alternatives && item.alternatives[0]) {
      const word = item.alternatives[0];
      if (set.has(word.speaker) && word.content) {
        userWords.push(word.content);
      }
    }
  });
  return userWords.join(" ");
}

// Deprecated single-speaker helpers kept for reference

// New: duration across multiple speakers (merge overlapping)
function calculateSpeakingDurationForSpeakers(
  transcriptContent: any[],
  speakerIds: string[]
): number {
  const set = new Set(speakerIds);
  let totalDuration = 0;
  const segments: { start: number; end: number }[] = [];
  transcriptContent.forEach((item) => {
    if (item.alternatives && item.alternatives[0]) {
      const word = item.alternatives[0];
      if (
        set.has(word.speaker) &&
        item.start_time !== undefined &&
        item.end_time !== undefined
      ) {
        segments.push({ start: item.start_time, end: item.end_time });
      }
    }
  });
  if (segments.length === 0) return 0;
  segments.sort((a, b) => a.start - b.start);
  let currentStart = segments[0].start;
  let currentEnd = segments[0].end;
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    if (s.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, s.end);
    } else {
      totalDuration += currentEnd - currentStart;
      currentStart = s.start;
      currentEnd = s.end;
    }
  }
  totalDuration += currentEnd - currentStart;
  return totalDuration;
}

// Helper to round to 2 decimals
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Extract flat segments from transcript
function extractSegments(transcriptContent: any[]) {
  type Segment = { speaker: string; start: number; end: number };
  const segments: Segment[] = [];
  transcriptContent.forEach((item) => {
    if (
      item?.alternatives &&
      item.alternatives[0] &&
      item.start_time !== undefined &&
      item.end_time !== undefined
    ) {
      segments.push({
        speaker: item.alternatives[0].speaker,
        start: item.start_time,
        end: item.end_time,
      });
    }
  });
  return segments;
}

// Merge all segments of given speakerIds, and non-user segments
function computeMergedUserSegments(
  allSegments: { speaker: string; start: number; end: number }[],
  speakerIds: string[]
) {
  const set = new Set(speakerIds);
  const userSegments = allSegments
    .filter((s) => set.has(s.speaker))
    .sort((a, b) => a.start - b.start);
  const otherSegments = allSegments
    .filter((s) => !set.has(s.speaker))
    .sort((a, b) => a.start - b.start);

  return { userSegments, otherSegments };
}

// Compute turn metrics
function computeTurnMetrics(
  segments: { speaker: string; start: number; end: number }[]
) {
  if (segments.length === 0)
    return { turns: 0, avgTurnSec: 0, longestTurnSec: 0 };
  const durations = segments.map((s) => s.end - s.start);
  const turns = segments.length;
  const avgTurnSec = durations.reduce((a, b) => a + b, 0) / turns;
  const longestTurnSec = Math.max(...durations);
  return { turns, avgTurnSec, longestTurnSec };
}

// Interaction metrics: response latency, interruptions, talk time share
function computeInteractionMetrics(
  allSegments: { speaker: string; start: number; end: number }[],
  userSegments: { speaker: string; start: number; end: number }[]
) {
  if (allSegments.length === 0) {
    return {
      avgResponseLatencySec: 0,
      interruptions: 0,
      totalTalkTimeSec: 0,
      userTalkTimeSec: 0,
    };
  }

  const sorted = [...allSegments].sort((a, b) => a.start - b.start);
  // const userSet = new Set(userSegments.map((s) => s.start + ":" + s.end));

  let responseLatencies: number[] = [];
  let interruptions = 0;
  let totalTalkTimeSec = 0;
  let userTalkTimeSec = 0;

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const isUser = userSegments.some(
      (u) =>
        Math.abs(u.start - seg.start) < 1e-6 && Math.abs(u.end - seg.end) < 1e-6
    );
    const duration = Math.max(0, seg.end - seg.start);
    totalTalkTimeSec += duration;
    if (isUser) userTalkTimeSec += duration;

    // Response latency: time between a non-user seg end and the next user seg start
    if (!isUser) {
      // find next user segment
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        const nextIsUser = userSegments.some(
          (u) =>
            Math.abs(u.start - next.start) < 1e-6 &&
            Math.abs(u.end - next.end) < 1e-6
        );
        if (nextIsUser) {
          const gap = next.start - seg.end;
          if (gap >= 0 && gap < 10) {
            // cap at 10s to avoid long silences biasing too much
            responseLatencies.push(gap);
          }
          break;
        }
      }
    }

    // Interruption heuristic: user segment starts before previous non-user ended
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevIsUser = userSegments.some(
        (u) =>
          Math.abs(u.start - prev.start) < 1e-6 &&
          Math.abs(u.end - prev.end) < 1e-6
      );
      if (!prevIsUser && isUser && seg.start < prev.end) {
        interruptions += 1;
      }
    }
  }

  const avgResponseLatencySec =
    responseLatencies.length > 0
      ? responseLatencies.reduce((a, b) => a + b, 0) / responseLatencies.length
      : 0;

  return {
    avgResponseLatencySec,
    interruptions,
    totalTalkTimeSec,
    userTalkTimeSec,
  };
}

// Lexical metrics from script text
function computeLexicalMetrics(script: string) {
  const words = script
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
    .filter((w) => w.length > 0);
  const total = words.length;
  const unique = new Set(words).size;
  const lexicalDiversityPct = total > 0 ? (unique / total) * 100 : 0;
  return { uniqueWords: unique, lexicalDiversityPct };
}

async function generateAIAnalysis(
  userScript: string,
  wordCount: number,
  speakingDuration: number,
  openai: OpenAI
): Promise<UserSpeakingReport["analysis"]> {
  const prompt = `
You are an expert English speaking coach analyzing a transcript from an English conversation practice session. Please provide a comprehensive analysis of this speaker's performance.

TRANSCRIPT:
"${userScript}"

CONTEXT:
- Word count: ${wordCount}
- Speaking duration: ${speakingDuration.toFixed(1)} seconds
- This is from a structured English conversation practice session

Please analyze the following aspects and provide scores (1-10 scale) with detailed feedback:

1. FLUENCY: How smoothly and naturally does the speaker communicate?
2. VOCABULARY: Range and appropriateness of vocabulary used
3. GRAMMAR: Accuracy of grammatical structures
4. PRONUNCIATION: Clarity and accuracy (inferred from transcript patterns)
5. ENGAGEMENT: How well the speaker participates and contributes to conversation

For each category, provide:
- A score from 1-10
- Specific feedback explaining the score
- Actionable suggestions for improvement

Also provide:
- Overall score (average of all categories)
- Top 3 strengths
- Top 3 areas for improvement
- 3 specific, actionable suggestions for next practice sessions

Format your response as a JSON object with this exact structure:
{
  "overallScore": number,
  "fluency": {"score": number, "feedback": "string"},
  "vocabulary": {"score": number, "feedback": "string"},
  "grammar": {"score": number, "feedback": "string"},
  "pronunciation": {"score": number, "feedback": "string"},
  "engagement": {"score": number, "feedback": "string"},
  "strengths": ["string", "string", "string"],
  "areasForImprovement": ["string", "string", "string"],
  "specificSuggestions": ["string", "string", "string"]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert English speaking coach. Analyze the provided transcript and return only valid JSON with no additional text or formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const analysis = JSON.parse(response);

    // Validate the structure
    if (
      !analysis.overallScore ||
      !analysis.fluency ||
      !analysis.vocabulary ||
      !analysis.grammar ||
      !analysis.pronunciation ||
      !analysis.engagement
    ) {
      throw new Error("Invalid analysis structure from AI");
    }

    return analysis;
  } catch (error) {
    logger.error("Error generating AI analysis:", error);

    // Fallback analysis if AI fails
    return {
      overallScore: 5,
      fluency: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      vocabulary: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      grammar: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      pronunciation: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      engagement: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      strengths: [
        "Participated in the conversation",
        "Contributed to the discussion",
        "Engaged with the topic",
      ],
      areasForImprovement: [
        "Continue practicing",
        "Focus on consistency",
        "Build confidence",
      ],
      specificSuggestions: [
        "Keep practicing regularly",
        "Record yourself speaking",
        "Join more conversation sessions",
      ],
    };
  }
}

// Aggregate reports for a meetup event across all transcripts, merging by userId
export const aggregateMeetupReports = onCall(
  { region: "asia-northeast3", timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    const { eventId } = request.data as { eventId: string };
    if (!eventId || typeof eventId !== "string") {
      throw new Error("Invalid or missing eventId");
    }

    const db = admin.firestore();
    logger.info(`Aggregating meetup reports for event ${eventId}`);

    // 1) Load transcripts for this event
    const transcriptsSnap = await db
      .collection("transcripts")
      .where("eventId", "==", eventId)
      .get();
    if (transcriptsSnap.empty) {
      logger.warn(`No transcripts found for event ${eventId}`);
      return { success: true, message: "No transcripts for event", eventId };
    }

    const transcriptIds = transcriptsSnap.docs.map((d) => d.id);
    logger.info(
      `Found ${transcriptIds.length} transcripts for event ${eventId}`
    );

    // 2) Load reports for these transcripts (chunk in batches of 10 for "in" query)
    const chunks: string[][] = [];
    for (let i = 0; i < transcriptIds.length; i += 10) {
      chunks.push(transcriptIds.slice(i, i + 10));
    }

    type ReportDoc = {
      userId: string;
      transcriptId: string;
      analysis: {
        overallScore: number;
        fluency: { score: number; feedback: string };
        vocabulary: { score: number; feedback: string };
        grammar: { score: number; feedback: string };
        pronunciation: { score: number; feedback: string };
        engagement: { score: number; feedback: string };
        strengths: string[];
        areasForImprovement: string[];
        specificSuggestions: string[];
      };
      metadata: any;
    };

    const reports: ReportDoc[] = [];
    for (const chunk of chunks) {
      const snap = await db
        .collection("reports")
        .where("transcriptId", "in", chunk)
        .get();
      snap.forEach((doc) => reports.push(doc.data() as ReportDoc));
    }

    if (reports.length === 0) {
      logger.warn(`No reports found for event ${eventId}`);
      return { success: true, message: "No reports for event", eventId };
    }

    // 3) Aggregate per user
    interface Agg {
      userId: string;
      transcripts: string[];
      totalWords: number;
      totalSpeakingDuration: number;
      averageWPM: number;
      sessionsCount: number;
      // Turns aggregation
      totalTurns: number;
      weightedAvgTurnSec: number;
      longestTurnSec: number;
      // Interaction
      weightedAvgResponseLatencySec: number;
      interruptions: number;
      // Lexical (approximate)
      weightedLexicalDiversityPct: number;
      // Talk share (approximate, weighted by speaking duration)
      weightedTalkTimeSharePct: number;
      // Scores (avg of overall)
      avgOverallScore: number;
    }

    const byUser: Record<string, Agg> = {};

    for (const r of reports) {
      const userId = r.userId;
      const m = r.metadata || {};
      const words = Number(m.wordCount) || 0;
      const dur = Number(m.speakingDuration) || 0;
      const turns = Number(m.speakingTurns) || 0;
      const avgTurn = Number(m.avgTurnDuration) || Number(m.avgTurnSec) || 0;
      const longestTurn =
        Number(m.longestTurn) || Number(m.longestTurnSec) || 0;
      const respLatency =
        Number(m.avgResponseLatency) || Number(m.avgResponseLatencySec) || 0;
      const interruptions = Number(m.interruptions) || 0;
      const lexDiv =
        Number(m.lexicalDiversity) || Number(m.lexicalDiversityPct) || 0;
      const talkShare = Number(m.talkTimeShare) || 0;
      const overall = Number(r.analysis?.overallScore) || 0;

      if (!byUser[userId]) {
        byUser[userId] = {
          userId,
          transcripts: [],
          totalWords: 0,
          totalSpeakingDuration: 0,
          averageWPM: 0,
          sessionsCount: 0,
          totalTurns: 0,
          weightedAvgTurnSec: 0,
          longestTurnSec: 0,
          weightedAvgResponseLatencySec: 0,
          interruptions: 0,
          weightedLexicalDiversityPct: 0,
          weightedTalkTimeSharePct: 0,
          avgOverallScore: 0,
        };
      }

      const a = byUser[userId];
      a.transcripts.push(r.transcriptId);
      a.totalWords += words;
      a.totalSpeakingDuration += dur;
      a.sessionsCount += 1;
      a.totalTurns += turns;
      a.longestTurnSec = Math.max(a.longestTurnSec, longestTurn);
      a.interruptions += interruptions;

      // Weighted averages: use sensible weights
      // avgTurn: weight by number of turns
      if (turns > 0) {
        a.weightedAvgTurnSec =
          (a.weightedAvgTurnSec * (a.totalTurns - turns) + avgTurn * turns) /
          (a.totalTurns || 1);
      }

      // response latency: weight by turns
      if (turns > 0) {
        const prevTurns = a.totalTurns - turns;
        a.weightedAvgResponseLatencySec =
          (a.weightedAvgResponseLatencySec * prevTurns + respLatency * turns) /
          (a.totalTurns || 1);
      }

      // lexical diversity: weight by words
      if (words > 0) {
        const prevWords = a.totalWords - words;
        a.weightedLexicalDiversityPct =
          (a.weightedLexicalDiversityPct * prevWords + lexDiv * words) /
          (a.totalWords || 1);
      }

      // talk time share: weight by speaking duration
      if (dur > 0) {
        const prevDur = a.totalSpeakingDuration - dur;
        a.weightedTalkTimeSharePct =
          (a.weightedTalkTimeSharePct * prevDur + talkShare * dur) /
          (a.totalSpeakingDuration || 1);
      }

      // overall score: simple running average (weight each session equally)
      a.avgOverallScore =
        (a.avgOverallScore * (a.sessionsCount - 1) + overall) / a.sessionsCount;
    }

    // Finalize WPM per user
    Object.values(byUser).forEach((a) => {
      a.averageWPM =
        a.totalSpeakingDuration > 0
          ? a.totalWords / (a.totalSpeakingDuration / 60)
          : 0;
    });

    // Compute event-level shares (optional)
    const eventTotals = Object.values(byUser).reduce(
      (acc, a) => {
        acc.words += a.totalWords;
        acc.duration += a.totalSpeakingDuration;
        return acc;
      },
      { words: 0, duration: 0 }
    );

    // 4) Save aggregated docs under meetup_reports/{eventId}/users/{userId}
    const batch = db.batch();
    const baseRef = db.collection("meetup_reports").doc(eventId);
    batch.set(
      baseRef,
      {
        eventId,
        transcripts: transcriptIds,
        updatedAt: admin.firestore.Timestamp.now(),
        totals: eventTotals,
      },
      { merge: true }
    );

    for (const agg of Object.values(byUser)) {
      const ref = baseRef.collection("users").doc(agg.userId);
      batch.set(ref, {
        ...agg,
        eventId,
        wordSharePct:
          eventTotals.words > 0
            ? (agg.totalWords / eventTotals.words) * 100
            : 0,
        durationSharePct:
          eventTotals.duration > 0
            ? (agg.totalSpeakingDuration / eventTotals.duration) * 100
            : 0,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    await batch.commit();

    logger.info(
      `Aggregated ${
        Object.keys(byUser).length
      } user reports for event ${eventId}`
    );

    return {
      success: true,
      eventId,
      users: Object.keys(byUser).length,
    };
  }
);
