/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Serve modern formats and allow optimizing remote images from the hosts
  // that actually serve user/content images at runtime.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "hetiycbotgjeluteicyk.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return ["admin", "auth", "profile", "messages", "notifications", "payment", "vocabulary", "report"].map((root) => ({
      source: `/${root}/:path*`, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/new-home", destination: "/", permanent: true },
      // The Daily storefront launched at /newsletter before it was renamed.
      { source: "/newsletter", destination: "/daily", permanent: true },
      { source: "/newsletter/:path*", destination: "/daily", permanent: true },
      // Shadowing and the speaking test/exam center were retired (Oct 2026).
      { source: "/shadow", destination: "/", permanent: false },
      { source: "/shadow/:path*", destination: "/", permanent: false },
      { source: "/library", destination: "/", permanent: false },
      { source: "/speaking-test", destination: "/", permanent: false },
      { source: "/speaking-test/:path*", destination: "/", permanent: false },
      { source: "/exam-center", destination: "/", permanent: false },
      { source: "/exam-center/:path*", destination: "/", permanent: false },
      { source: "/admin/shadow", destination: "/admin", permanent: false },
      { source: "/admin/test-center", destination: "/admin", permanent: false },
      { source: "/admin/test-center/:path*", destination: "/admin", permanent: false },
      { source: "/admin/speaking-test-builder", destination: "/admin", permanent: false },
    ];
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
