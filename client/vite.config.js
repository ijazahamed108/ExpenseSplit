import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs separately on :3000; proxy avoids CORS entirely.
// In production the Express server serves the built `dist/` on the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false },
});
