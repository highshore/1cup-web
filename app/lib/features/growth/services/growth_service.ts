import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  limit as fbLimit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import {
  GrowthPost,
  GrowthIteration,
  GrowthConfig,
  GrowthPostStatus,
  DEFAULT_GROWTH_CONFIG,
} from "../types/growth_types";

const POSTS = "growth_posts";
const ITERATIONS = "growth_iterations";
const CONFIG = "growth_config";
const CONFIG_DOC = "settings";

const toDate = (v: any): Date =>
  v?.toDate ? v.toDate() : v ? new Date(v) : new Date();

const toIso = (v: any): string | null =>
  v?.toDate ? v.toDate().toISOString() : v ? String(v) : null;

const docToPost = (d: any): GrowthPost => {
  const data = d.data();
  return {
    id: d.id,
    channel: data.channel || "koreapas",
    title: data.title || "",
    content: data.content || "",
    imageUrl: data.imageUrl || "",
    variant: data.variant || {},
    trackingCode: data.trackingCode || "",
    status: (data.status as GrowthPostStatus) || "draft",
    externalUrl: data.externalUrl || "",
    iterationId: data.iterationId || "",
    metrics: {
      impressions: data.metrics?.impressions ?? 0,
      clicks: data.metrics?.clicks ?? 0,
      signups: data.metrics?.signups ?? 0,
      likes: data.metrics?.likes ?? 0,
      comments: data.metrics?.comments ?? 0,
    },
    scheduledFor: toIso(data.scheduledFor),
    postedAt: toIso(data.postedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const docToIteration = (d: any): GrowthIteration => {
  const data = d.data();
  return {
    id: d.id,
    runAt: toDate(data.runAt),
    channel: data.channel || "koreapas",
    observation: data.observation || "",
    decision: data.decision || "",
    strategyChange: data.strategyChange || "",
    variant: data.variant || {},
    postId: data.postId || "",
    model: data.model || "",
    tokensUsed: data.tokensUsed ?? 0,
  };
};

// Short, URL-safe tracking code for a post's /r/<code> link.
const generateTrackingCode = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export const fetchGrowthPosts = async (): Promise<GrowthPost[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, POSTS), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(docToPost);
  } catch (error) {
    console.error("Error fetching growth posts:", error);
    return [];
  }
};

export const fetchGrowthIterations = async (
  max = 50
): Promise<GrowthIteration[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, ITERATIONS), orderBy("runAt", "desc"), fbLimit(max))
    );
    return snap.docs.map(docToIteration);
  } catch (error) {
    console.error("Error fetching growth iterations:", error);
    return [];
  }
};

export const fetchGrowthConfig = async (): Promise<GrowthConfig> => {
  try {
    const ref = doc(db, CONFIG, CONFIG_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ...DEFAULT_GROWTH_CONFIG };
    const data = snap.data();
    return {
      agentActive: !!data.agentActive,
      approveFirst: data.approveFirst ?? true,
      updatedAt: toDate(data.updatedAt),
    };
  } catch (error) {
    console.error("Error fetching growth config:", error);
    return { ...DEFAULT_GROWTH_CONFIG };
  }
};

export const updateGrowthConfig = async (
  partial: Partial<GrowthConfig>
): Promise<void> => {
  const ref = doc(db, CONFIG, CONFIG_DOC);
  await setDoc(
    ref,
    { ...partial, updatedAt: Timestamp.fromDate(new Date()) },
    { merge: true }
  );
};

export const createGrowthPost = async (
  data: Partial<GrowthPost>
): Promise<string> => {
  const now = Timestamp.fromDate(new Date());
  const post: any = {
    channel: data.channel || "koreapas",
    title: data.title || "",
    content: data.content || "",
    imageUrl: data.imageUrl || "",
    variant: data.variant || {},
    trackingCode: data.trackingCode || generateTrackingCode(),
    status: data.status || "draft",
    externalUrl: data.externalUrl || "",
    iterationId: data.iterationId || "",
    metrics: { clicks: 0, signups: 0 },
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, POSTS), post);
  return ref.id;
};

export const updateGrowthPostStatus = async (
  id: string,
  status: GrowthPostStatus,
  extra?: { externalUrl?: string }
): Promise<void> => {
  const ref = doc(db, POSTS, id);
  const update: any = {
    status,
    updatedAt: Timestamp.fromDate(new Date()),
  };
  if (status === "posted") update.postedAt = Timestamp.fromDate(new Date());
  if (extra?.externalUrl !== undefined) update.externalUrl = extra.externalUrl;
  await updateDoc(ref, update);
};

export const deleteGrowthPost = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, POSTS, id));
};
