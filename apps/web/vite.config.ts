import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'apps/web', plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001', '/admin':'http://127.0.0.1:3003', '/gateway':{target:'http://127.0.0.1:3002',rewrite:path=>path.replace(/^\/gateway/,'')} } },
  build: { outDir: '../../dist/web', emptyOutDir: true }
});
