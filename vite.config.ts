import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    // Not 3000: other projects' dev servers (and any service workers they
    // registered) share that origin.
    port: 3075,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3076}` },
  },
});
