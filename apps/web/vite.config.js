import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.VITE_API_PORT || 8080;
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules/')) return;
            // Charts only used in admin — keep separate so storefront visitors don't download them
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory')) return 'charts';
            // Everything else in one vendor chunk to avoid React singleton conflicts
            return 'vendor';
          },
        },
      },
    },
  };
});
