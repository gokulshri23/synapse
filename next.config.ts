import type { NextConfig } from 'next';

// Ensure development & local environments handle self-signed or intermediate proxy certs gracefully
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
