import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server na 5173; chamadas a /api são redirecionadas para o backend (3001).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
