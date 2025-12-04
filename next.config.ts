import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const cspHeader = `
    default-src 'self';
    script-src 'self' 
        ${isDev ? "'unsafe-eval'" : ""}
        'unsafe-inline'
        https://va.vercel-scripts.com/v1/script.debug.js
        https://*.walletconnect.com
        https://*.walletconnect.org
        https://plausible.paperclip.xyz;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: 
        https://*.walletconnect.org 
        https://*.walletconnect.com 
        https://tokens-data.1inch.io 
        https://tokens.1inch.io 
        https://ipfs.io 
        https://cdn.zerion.io
        https://cdn.whisk.so
        https://cdn.morpho.org
        https://raw.githubusercontent.com/trustwallet/assets/**
        https://coin-images.coingecko.com/coins/images/**;
    font-src 'self' https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' 
      https://*.alchemy.com
      https://*.infura.io
      https://*.quiknode.pro
      https://*.walletconnect.com 
      https://*.walletconnect.org
      wss://*.walletconnect.com
      wss://*.walletconnect.org
      wss://www.walletlink.org
      https://chain-proxy.wallet.coinbase.com
      https://va.vercel-scripts.com/v1/script.debug.js
      https://plausible.paperclip.xyz
      https://api.paraswap.io;
    frame-src 'self' 
        https://verify.walletconnect.com 
        https://verify.walletconnect.org 
        https://secure.walletconnect.com 
        https://secure.walletconnect.org;
    upgrade-insecure-requests;
    report-to csp-report-endpoint;
`;

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Fix MetaMask SDK React Native dependency warnings in web builds
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
          {
            key: "Reporting-Endpoints",
            value: `csp-report-endpoint="${process.env.NEXT_PUBLIC_URL!}/api/csp-report"`,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            // Allow wallet connection popups
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Referrer-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
        ],
      },
    ];
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  redirects: async () => {
    return [
      {
        source: "/earn",
        destination: "/",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/trustwallet/assets/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        port: "",
        pathname: "/coins/images/**",
      },
      {
        protocol: "https",
        hostname: "cdn.morpho.org",
        port: "",
        pathname: "/*/assets/**",
      },
      {
        protocol: "https",
        hostname: "cdn.whisk.so",
        port: "",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
