import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(import.meta.env?.VITE_PORT || 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${Number(import.meta.env?.VITE_BACKEND_PORT || 5000)}`,
        changeOrigin: true,
      },
    },
  },
});
