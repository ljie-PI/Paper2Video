/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
    '@remotion/cli',
    'remotion',
    'esbuild',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  }
};

export default nextConfig;
