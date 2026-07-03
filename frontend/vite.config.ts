import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev server na 5173; chamadas a /api são redirecionadas para o backend (3001).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
    // O projeto vive em D:\ montado no WSL via 9p — esse tipo de mount não
    // propaga eventos de inotify, então o watcher nativo do Vite nunca
    // percebe as mudanças. Polling força ele a checar os arquivos periodicamente.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
