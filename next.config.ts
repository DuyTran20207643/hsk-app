import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Mặc định 1 MB. Ảnh từ vựng tối đa 1 MB cộng phần đầu của form, và dữ liệu
      // import Excel (tối đa 1.000 dòng) cần nhiều hơn một chút.
      bodySizeLimit: "2mb",
    },
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
