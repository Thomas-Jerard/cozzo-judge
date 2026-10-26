import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@xenova/transformers", "ffmpeg-static", "onnxruntime-web", "onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/transcribe": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/@xenova/transformers/dist/ort-wasm-simd.wasm",
      "./node_modules/@xenova/transformers/dist/ort-wasm.wasm",
      "./node_modules/@xenova/transformers/node_modules/sharp/**/*",
    ],
    "/api/health": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/@xenova/transformers/dist/ort-wasm-simd.wasm",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
