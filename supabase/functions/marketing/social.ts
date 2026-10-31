// Threads and Instagram publishing through Meta's official Graph APIs.
//
// Both APIs publish in two steps: create a media container, wait until Meta has
// processed it, then publish the container. Carousels create one container per image
// first. Access tokens are long-lived user tokens (about 60 days) that an admin pastes
// in /admin/marketing; `refreshAccessToken` extends them before they expire.
//
// Tokens are only ever sent to graph.threads.net / graph.instagram.com. Error messages
// are built from Meta's error body, never from the request URL, so a token cannot leak
// into run records or logs.

export type SocialChannel = "threads" | "instagram";

export type ChannelAccount = {
  channel: SocialChannel;
  accountId: string;
  username: string;
  accessToken: string;
};

export type PublishResult = { mediaId: string; permalink: string };
export type SocialMetrics = { impressions: number; likes: number; comments: number };

const THREADS_API = "https://graph.threads.net/v1.0";
const THREADS_ROOT = "https://graph.threads.net";
const INSTAGRAM_VERSION = Deno.env.get("INSTAGRAM_GRAPH_VERSION")?.trim() || "v23.0";
const INSTAGRAM_API = `https://graph.instagram.com/${INSTAGRAM_VERSION}`;
const INSTAGRAM_ROOT = "https://graph.instagram.com";

export const THREADS_TEXT_LIMIT = 500;
export const THREADS_MAX_IMAGES = 20;
export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_MAX_IMAGES = 10;

const CONTAINER_POLL_INTERVAL_MS = 3_000;
const CONTAINER_POLL_ATTEMPTS = 20; // ~60 seconds for images
const VIDEO_POLL_ATTEMPTS = 50; // ~150 seconds: Instagram transcodes reels before they can publish

const label = (channel: SocialChannel) => (channel === "threads" ? "Threads" : "Instagram");

type GraphParams = Record<string, string | number | boolean | undefined>;

const graph = async (
  channel: SocialChannel,
  method: "GET" | "POST",
  url: string,
  params: GraphParams,
  accessToken: string,
): Promise<Record<string, unknown>> => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  search.set("access_token", accessToken);

  const response = await fetch(method === "GET" ? `${url}?${search}` : url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? search : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.error) {
    const error = (body.error ?? {}) as Record<string, unknown>;
    const message =
      (typeof error.error_user_msg === "string" && error.error_user_msg) ||
      (typeof error.message === "string" && error.message) ||
      `request failed with ${response.status}`;
    throw new Error(`${label(channel)}: ${message}`);
  }
  return body;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Meta processes image containers asynchronously; publishing before FINISHED fails.
const waitForContainer = async (account: ChannelAccount, containerId: string, attempts = CONTAINER_POLL_ATTEMPTS) => {
  const base = account.channel === "threads" ? THREADS_API : INSTAGRAM_API;
  const field = account.channel === "threads" ? "status" : "status_code";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const body = await graph(
      account.channel,
      "GET",
      `${base}/${containerId}`,
      { fields: account.channel === "threads" ? "status,error_message" : "status_code,status" },
      account.accessToken,
    );
    const status = String(body[field] ?? "");
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const detail = typeof body.error_message === "string" ? body.error_message : String(body.status ?? status);
      throw new Error(`${label(account.channel)} could not process the media: ${detail}`);
    }
    await sleep(CONTAINER_POLL_INTERVAL_MS);
  }
  throw new Error(`${label(account.channel)} did not finish processing the media in time.`);
};

const idOf = (body: Record<string, unknown>, what: string, channel: SocialChannel): string => {
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) throw new Error(`${label(channel)} did not return a ${what} id.`);
  return id;
};

const permalinkOf = async (account: ChannelAccount, mediaId: string): Promise<string> => {
  const base = account.channel === "threads" ? THREADS_API : INSTAGRAM_API;
  try {
    const body = await graph(account.channel, "GET", `${base}/${mediaId}`, { fields: "permalink" }, account.accessToken);
    return typeof body.permalink === "string" ? body.permalink : "";
  } catch (error) {
    console.warn(`${label(account.channel)} permalink lookup failed`, error);
    return "";
  }
};

// ------------------------------------------------------------------- accounts
export const verifyAccessToken = async (
  channel: SocialChannel,
  accessToken: string,
): Promise<{ accountId: string; username: string }> => {
  if (channel === "threads") {
    const body = await graph(channel, "GET", `${THREADS_API}/me`, { fields: "id,username" }, accessToken);
    return { accountId: idOf(body, "account", channel), username: String(body.username ?? "") };
  }
  // With Instagram Login, `user_id` is the professional account id used for publishing.
  const body = await graph(channel, "GET", `${INSTAGRAM_API}/me`, { fields: "user_id,username" }, accessToken);
  const accountId = typeof body.user_id === "string" && body.user_id ? body.user_id : idOf(body, "account", channel);
  return { accountId, username: String(body.username ?? "") };
};

// Long-lived tokens can be refreshed once they are at least 24 hours old; each
// refresh returns a new token valid for another ~60 days.
export const refreshAccessToken = async (
  channel: SocialChannel,
  accessToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> => {
  const body =
    channel === "threads"
      ? await graph(channel, "GET", `${THREADS_ROOT}/refresh_access_token`, { grant_type: "th_refresh_token" }, accessToken)
      : await graph(channel, "GET", `${INSTAGRAM_ROOT}/refresh_access_token`, { grant_type: "ig_refresh_token" }, accessToken);
  const token = typeof body.access_token === "string" ? body.access_token : "";
  if (!token) throw new Error(`${label(channel)} did not return a refreshed token.`);
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 60 * 24 * 60 * 60;
  return { accessToken: token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
};

// ------------------------------------------------------------------- publish
// Text, one image, a carousel of images, or (with videoUrl) a single video. Videos are
// processed by Threads before they can publish, so their container gets the longer wait.
export const publishToThreads = async (
  account: ChannelAccount,
  text: string,
  imageUrls: string[],
  videoUrl?: string,
): Promise<PublishResult> => {
  const endpoint = `${THREADS_API}/${account.accountId}/threads`;
  const images = imageUrls.slice(0, THREADS_MAX_IMAGES);
  let containerId: string;

  if (videoUrl) {
    containerId = idOf(
      await graph("threads", "POST", endpoint, { media_type: "VIDEO", video_url: videoUrl, text }, account.accessToken),
      "container",
      "threads",
    );
  } else if (images.length === 0) {
    containerId = idOf(
      await graph("threads", "POST", endpoint, { media_type: "TEXT", text }, account.accessToken),
      "container",
      "threads",
    );
  } else if (images.length === 1) {
    containerId = idOf(
      await graph("threads", "POST", endpoint, { media_type: "IMAGE", image_url: images[0], text }, account.accessToken),
      "container",
      "threads",
    );
  } else {
    const children: string[] = [];
    for (const imageUrl of images) {
      children.push(
        idOf(
          await graph(
            "threads",
            "POST",
            endpoint,
            { media_type: "IMAGE", image_url: imageUrl, is_carousel_item: true },
            account.accessToken,
          ),
          "carousel item",
          "threads",
        ),
      );
    }
    await Promise.all(children.map((child) => waitForContainer(account, child)));
    containerId = idOf(
      await graph(
        "threads",
        "POST",
        endpoint,
        { media_type: "CAROUSEL", children: children.join(","), text },
        account.accessToken,
      ),
      "container",
      "threads",
    );
  }

  await waitForContainer(account, containerId, videoUrl ? VIDEO_POLL_ATTEMPTS : CONTAINER_POLL_ATTEMPTS);
  const mediaId = idOf(
    await graph(
      "threads",
      "POST",
      `${THREADS_API}/${account.accountId}/threads_publish`,
      { creation_id: containerId },
      account.accessToken,
    ),
    "media",
    "threads",
  );
  return { mediaId, permalink: await permalinkOf(account, mediaId) };
};

// Posts each reply under the previous post, so a daily thread reads top to bottom.
// Returns the media ids of the replies in order.
export const publishThreadsReplies = async (
  account: ChannelAccount,
  parentMediaId: string,
  replies: string[],
): Promise<string[]> => {
  const endpoint = `${THREADS_API}/${account.accountId}/threads`;
  const ids: string[] = [];
  let replyTo = parentMediaId;
  for (const text of replies) {
    // A post that was just published can take a few seconds to become a valid
    // reply_to_id ("The media with ID … cannot be found"); retry with a back-off.
    let created: Record<string, unknown> | null = null;
    for (let attempt = 0; ; attempt += 1) {
      try {
        await sleep(attempt === 0 ? 3_000 : 4_000 * attempt);
        created = await graph("threads", "POST", endpoint, { media_type: "TEXT", text, reply_to_id: replyTo }, account.accessToken);
        break;
      } catch (error) {
        const notFound = error instanceof Error && /cannot be found|does not exist|not found/i.test(error.message);
        if (!notFound || attempt >= 4) throw error;
      }
    }
    const containerId = idOf(created ?? {}, "reply container", "threads");
    await waitForContainer(account, containerId);
    replyTo = idOf(
      await graph(
        "threads",
        "POST",
        `${THREADS_API}/${account.accountId}/threads_publish`,
        { creation_id: containerId },
        account.accessToken,
      ),
      "reply",
      "threads",
    );
    ids.push(replyTo);
  }
  return ids;
};

export const publishToInstagram = async (
  account: ChannelAccount,
  caption: string,
  imageUrls: string[],
): Promise<PublishResult> => {
  const images = imageUrls.slice(0, INSTAGRAM_MAX_IMAGES);
  if (images.length === 0) throw new Error("Instagram posts need at least one photo.");
  const endpoint = `${INSTAGRAM_API}/${account.accountId}/media`;
  let containerId: string;

  if (images.length === 1) {
    containerId = idOf(
      await graph("instagram", "POST", endpoint, { image_url: images[0], caption }, account.accessToken),
      "container",
      "instagram",
    );
  } else {
    const children: string[] = [];
    for (const imageUrl of images) {
      children.push(
        idOf(
          await graph("instagram", "POST", endpoint, { image_url: imageUrl, is_carousel_item: true }, account.accessToken),
          "carousel item",
          "instagram",
        ),
      );
    }
    await Promise.all(children.map((child) => waitForContainer(account, child)));
    containerId = idOf(
      await graph(
        "instagram",
        "POST",
        endpoint,
        { media_type: "CAROUSEL", children: children.join(","), caption },
        account.accessToken,
      ),
      "container",
      "instagram",
    );
  }

  await waitForContainer(account, containerId);
  const mediaId = idOf(
    await graph(
      "instagram",
      "POST",
      `${INSTAGRAM_API}/${account.accountId}/media_publish`,
      { creation_id: containerId },
      account.accessToken,
    ),
    "media",
    "instagram",
  );
  return { mediaId, permalink: await permalinkOf(account, mediaId) };
};

// A Reel from an MP4 at a public URL (H.264/AAC, 9:16). share_to_feed also shows it on
// the profile grid; cover_url sets the grid thumbnail.
export const publishInstagramReel = async (
  account: ChannelAccount,
  videoUrl: string,
  caption: string,
  coverUrl?: string,
): Promise<PublishResult> => {
  const containerId = idOf(
    await graph(
      "instagram",
      "POST",
      `${INSTAGRAM_API}/${account.accountId}/media`,
      { media_type: "REELS", video_url: videoUrl, caption, cover_url: coverUrl, share_to_feed: true },
      account.accessToken,
    ),
    "container",
    "instagram",
  );
  await waitForContainer(account, containerId, VIDEO_POLL_ATTEMPTS);
  const mediaId = idOf(
    await graph(
      "instagram",
      "POST",
      `${INSTAGRAM_API}/${account.accountId}/media_publish`,
      { creation_id: containerId },
      account.accessToken,
    ),
    "media",
    "instagram",
  );
  return { mediaId, permalink: await permalinkOf(account, mediaId) };
};

// ------------------------------------------------------------------- insights
const metricValue = (entry: Record<string, unknown>): number => {
  const total = (entry.total_value ?? {}) as Record<string, unknown>;
  if (typeof total.value === "number") return total.value;
  const values = Array.isArray(entry.values) ? (entry.values as Array<Record<string, unknown>>) : [];
  const value = values[0]?.value;
  return typeof value === "number" ? value : 0;
};

const readInsights = (body: Record<string, unknown>): Map<string, number> => {
  const data = Array.isArray(body.data) ? (body.data as Array<Record<string, unknown>>) : [];
  return new Map(data.map((entry) => [String(entry.name ?? ""), metricValue(entry)]));
};

export const fetchMediaMetrics = async (
  account: ChannelAccount,
  mediaId: string,
): Promise<SocialMetrics> => {
  if (account.channel === "threads") {
    const metrics = readInsights(
      await graph("threads", "GET", `${THREADS_API}/${mediaId}/insights`, { metric: "views,likes,replies" }, account.accessToken),
    );
    return {
      impressions: metrics.get("views") ?? 0,
      likes: metrics.get("likes") ?? 0,
      comments: metrics.get("replies") ?? 0,
    };
  }

  // Instagram has been renaming media metrics (impressions -> views); fall back to the
  // long-standing set if the newer one is rejected for this media or API version.
  let metrics: Map<string, number>;
  try {
    metrics = readInsights(
      await graph("instagram", "GET", `${INSTAGRAM_API}/${mediaId}/insights`, { metric: "views,reach,likes,comments" }, account.accessToken),
    );
  } catch {
    metrics = readInsights(
      await graph("instagram", "GET", `${INSTAGRAM_API}/${mediaId}/insights`, { metric: "reach,likes,comments" }, account.accessToken),
    );
  }
  return {
    impressions: metrics.get("views") || metrics.get("reach") || 0,
    likes: metrics.get("likes") ?? 0,
    comments: metrics.get("comments") ?? 0,
  };
};
