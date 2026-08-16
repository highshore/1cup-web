// Featured article IDs shown in the home "topics" showcase — the article table
// primary keys (original Firestore doc ids).
//
// Single source of truth for both fetch paths: topics_service.ts (server,
// service-role) and topics_service_client.ts (browser). They used to keep
// separate copies of this list, which drifted (the server list was missing the
// newest article, so SSR and the client render disagreed).
export const FEATURED_ARTICLE_IDS = [
  "Alx2pN2Wrv9jbP2MCNKo",
  "7WHMBwU9m8LtBYI2wQVA",
  "hienPf1lJL8GMBKkjnKm",
  "H1hBMM5hB7MqdXkbvvxp",
  "xI3D8ijG6Fp7UHHCvu9B",
  "Xi1YVDM6xqHYNTfnhW6X",
  "foxCpkxHU7C7Fwf0kPRW",
];
