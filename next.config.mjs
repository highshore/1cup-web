/** @type {import('next').NextConfig} */
const supabaseUpstream = (
  process.env.SUPABASE_UPSTREAM_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://hetiycbotgjeluteicyk.supabase.co"
).replace(/\/+$/, "");

const supabaseProxyPaths = [
  "rest/v1",
  "auth/v1",
  "functions/v1",
  "storage/v1",
  "realtime/v1",
  "graphql/v1",
];

const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return supabaseProxyPaths.map((prefix) => ({
      source: `/${prefix}/:path*`,
      destination: `${supabaseUpstream}/${prefix}/:path*`,
    }));
  },
  async headers() {
    return supabaseProxyPaths.map((prefix) => ({
      source: `/${prefix}/:path*`,
      headers: [
        { key: "x-vercel-enable-rewrite-caching", value: "0" },
        { key: "Cache-Control", value: "private, no-store" },
      ],
    }));
  },
  // Serve modern formats and allow optimizing remote images from the hosts
  // that actually serve user/content images at runtime.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
    ],
  },
  // Tree-shake large barrel packages so only used icons/utils are bundled.
  experimental: {
    optimizePackageImports: [
      "react-icons",
      "@heroicons/react",
      "date-fns",
      "lottie-react",
    ],
  },
  // SSR/SSG enabled for optimal performance
  webpack: (config, { isServer }) => {
    // Handle Speechmatics real-time client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
