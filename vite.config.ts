import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
  plugins: [vinext(), sites()],
});
