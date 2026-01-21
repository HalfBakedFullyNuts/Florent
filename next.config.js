/** @type {import('next').NextConfig} */
const nextConfig = {
    // Use 'export' for static hosting (StaticHost.eu), 'standalone' for Docker
    // Default to 'export' for StaticHost.eu deployment
    output: 'export',
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
};

module.exports = nextConfig;
