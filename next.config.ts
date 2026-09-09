import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Product images travel inside the server action request. The default
      // 1 MB cap aborts any upload past it (413 "Body exceeded limit"), so
      // vendors crash on submit. Allow the full budget the forms themselves
      // enforce: up to 20 images at 5 MB each.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
