import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers() {
    // In development, relax CORS for local Hardhat node access
    const isDev = process.env.NODE_ENV === 'development';
    
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            // Use 'same-origin-allow-popups' to allow wallet SDKs to communicate
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            // Use 'credentialless' to allow external resources and wallet connections
            value: 'credentialless',
          },
        ],
      },
    ]);
  }
};

export default nextConfig;
