import type { NextConfig } from "next";

const backendUrl =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://zoom-clone-dq29.onrender.com"
    : "http://localhost:8000");

const nextConfig: NextConfig = {
  env: {
    API_URL: backendUrl,
    NEXT_PUBLIC_API_URL: backendUrl,
  },
};

export default nextConfig;
