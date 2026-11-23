import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Dev: the app calls /api/v1/* on its own origin and Vite proxies to the backend,
// so no CORS setup is needed locally. Set VITE_API_URL for deployed builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': { target: process.env.BACKEND_URL ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
});
