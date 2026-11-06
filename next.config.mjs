/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a second local copy (e.g. a test server) use its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
