// NAVER Maps client key (new standalone "Maps" product, uses ncpKeyId).
// This is a public, domain-restricted client key — not a secret — so it is
// safe to ship in the bundle. Centralized here so migrating the key only
// touches one line (or the NEXT_PUBLIC_NAVER_MAP_KEY env var).
//
// Migration note (NCP "AI NAVER API" → "Maps", deadline 2026-11-24): confirm
// this key is subscribed under the new Maps product in the NCP console.
export const NAVER_MAPS_KEY_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_KEY ?? "3cyz9x5q6l";

// Build the maps.js loader URL for the Web Dynamic Map + geocoder submodule.
// `callbackName` is the global function NAVER invokes once the SDK is ready.
export const naverMapsScriptSrc = (callbackName: string): string =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAPS_KEY_ID}&submodules=geocoder&callback=${callbackName}`;
