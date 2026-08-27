// Function to convert Float32Array PCM data to Int16Array ArrayBuffer (needed for Azure)
export function convertFloat32ToInt16(buffer: ArrayBuffer): ArrayBuffer {
  const l = buffer.byteLength / 4; // Float32 is 4 bytes
  const output = new Int16Array(l);
  const input = new Float32Array(buffer);
  for (let i = 0; i < l; i++) {
    output[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff; // Convert to 16-bit PCM
  }
  return output.buffer;
}

// Function to encode WAV file
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  const numChannels = 1;
  const bitDepth = 16; // Convert Float32 to Int16 for WAV

  writeString(0, "RIFF"); // RIFF identifier
  view.setUint32(4, 36 + samples.length * 2, true); // RIFF chunk length
  writeString(8, "WAVE"); // WAVE identifier
  writeString(12, "fmt "); // fmt sub-chunk identifier
  view.setUint32(16, 16, true); // fmt chunk length
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // Byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // Block align
  view.setUint16(34, bitDepth, true); // Bits per sample
  writeString(36, "data"); // data sub-chunk identifier
  view.setUint32(40, samples.length * 2, true); // data chunk length

  // Convert Float32 samples to Int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

// Function to get color based on Azure pronunciation score
export const getAzurePronunciationColor = (score?: number): string => {
  if (score === undefined) return "gray";
  if (score >= 80) return "green";
  if (score >= 60) return "orange";
  return "red";
};

// Helper to get original form (basic lemmatization)
export const getOriginalForm = (word: string): string => {
  const w = word.toLowerCase();
  if (w.endsWith("ies") && w.length > 3) return w.slice(0, -3) + "y";
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3)
    return w.slice(0, -1);
  return w;
};

// Convert YouTube URL to embed URL
export const convertToEmbedUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    let videoId: string | null = null;
    if (urlObj.hostname === "youtu.be") videoId = urlObj.pathname.substring(1);
    else if (
      urlObj.hostname === "www.youtube.com" ||
      urlObj.hostname === "youtube.com"
    ) {
      if (urlObj.pathname === "/embed") {
        const pathPart = urlObj.pathname.split("/").pop();
        videoId = pathPart !== undefined ? pathPart : null;
      } else if (urlObj.pathname === "/watch")
        videoId = urlObj.searchParams.get("v");
    }
    if (videoId) {
      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
      embedUrl.searchParams.set("enablejsapi", "1");
      urlObj.searchParams.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!["v", "feature", "si", "enablejsapi"].includes(lowerKey))
          embedUrl.searchParams.set(key, value);
      });
      return embedUrl.toString();
    }
    console.warn("Could not extract videoId from URL:", url);
    return null;
  } catch (e) {
    console.error("Error parsing YouTube URL for embed:", e);
    return null;
  }
};

// Extract word from clicked position
export const extractWordFromText = (
  element: HTMLElement,
  clickX: number,
  clickY: number
): { word: string; rect?: DOMRect } => {
  try {
    const range = document.caretRangeFromPoint(clickX, clickY);
    if (!range) return { word: "" };

    const textContainer = element.closest(".transcript-text");
    if (!textContainer) return { word: "" };

    const fullText = textContainer.textContent || "";
    const clickedNode = range.startContainer;
    const clickOffset = range.startOffset;

    let currentPosition = 0;
    let clickPosition = -1;

    const findPosition = (node: Node) => {
      if (clickPosition >= 0) return;

      if (node === clickedNode) {
        clickPosition = currentPosition + clickOffset;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        currentPosition += node.textContent?.length || 0;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          findPosition(child);
        }
      }
    };

    findPosition(textContainer);

    if (clickPosition < 0) return { word: "" };

    let startPos = clickPosition;
    let endPos = clickPosition;

    while (
      startPos > 0 &&
      fullText[startPos - 1] !== " " &&
      fullText[startPos - 1] !== "—"
    ) {
      startPos--;
    }

    while (
      endPos < fullText.length &&
      fullText[endPos] !== " " &&
      fullText[endPos] !== "—"
    ) {
      endPos++;
    }

    let word = fullText.substring(startPos, endPos);
    word = word.replace(/[.,!?;:'"()[\]{}]|…/g, "").trim();

    return {
      word,
      rect:
        (range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : (range.startContainer as Element)
        )?.getBoundingClientRect() || undefined,
    };
  } catch (error) {
    console.error("Error extracting word from text:", error);
    return { word: "" };
  }
};

// Get word definition function
export const getWordDefinition = async (
  word: string,
  context: string
): Promise<string> => {
  try {
    const response = await fetch("/api/shadow/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "definition", word, context }),
    });

    if (!response.ok) {
      throw new Error("뜻풀이를 지금 가져올 수 없습니다.");
    }

    const data = await response.json();
    if (typeof data.definition !== "string") {
      throw new Error("뜻풀이를 지금 가져올 수 없습니다.");
    }
    return data.definition;
  } catch (error) {
    console.error("GPT API Error:", error);
    return `뜻풀이를 가져오는 중 오류가 발생했습니다: ${error}`;
  }
};

// Function to fetch word definition from Free Dictionary API
export const fetchWordFromDictionaryApi = async (
  word: string
): Promise<any | null> => {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No definitions found for "${word}" from API.`);
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Free Dictionary API Error:", error);
    return null;
  }
};

// Function to get OpenAI ephemeral token
export const getOpenAIEphemeralToken = async (): Promise<string> => {
  const response = await fetch("/api/shadow/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "transcription-token" }),
  });

  if (!response.ok) {
    throw new Error("실시간 받아쓰기를 지금 시작할 수 없습니다.");
  }

  const data = await response.json();
  if (typeof data.client_secret !== "string") {
    throw new Error("실시간 받아쓰기를 지금 시작할 수 없습니다.");
  }
  return data.client_secret;
};
