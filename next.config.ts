import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@prisma/client', 'prisma'],
  devIndicators: {
    position: 'bottom-right',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/email-configs',
        destination: '/emails',
        permanent: true, // 301 重定向
      },
    ];
  },
};

export default nextConfig;
