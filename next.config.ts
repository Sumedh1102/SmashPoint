import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy. Scripts are limited to our origin plus Razorpay Checkout
 * (Next.js' own inline bootstrap scripts need 'unsafe-inline' without per-request nonces);
 * frames and API calls to Razorpay. Dev additionally needs eval and websockets for Fast Refresh.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.razorpay.com${isProd ? "" : " ws: wss:"}`,
  "frame-src 'self' https://*.razorpay.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile); Vercel doesn't need it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 80],
  },
  serverExternalPackages: ["pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Pages of the earlier academy app (coach/student dashboards, attendance, sign-up, …) were
  // removed; send old links somewhere useful instead of a 404.
  async redirects() {
    const home = ["/about", "/coaches", "/coaches/:path*", "/coaching", "/events", "/events/:path*", "/membership", "/facilities", "/contact", "/register"];
    return [
      { source: "/login", destination: "/admin/login", permanent: true },
      { source: "/forgot-password", destination: "/admin/login", permanent: true },
      { source: "/reset-password", destination: "/admin/login", permanent: true },
      { source: "/dashboard", destination: "/admin", permanent: true },
      { source: "/dashboard/:path*", destination: "/admin", permanent: true },
      { source: "/book", destination: "/#book", permanent: true },
      ...home.map((source) => ({ source, destination: "/", permanent: true })),
    ];
  },
};

export default nextConfig;
