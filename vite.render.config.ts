import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./render-client', import.meta.url)),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_DATA_API_URL': JSON.stringify(
      process.env.NEXT_PUBLIC_DATA_API_URL ?? '',
    ),
  },
  build: {
    outDir: '../dist/render-client',
    emptyOutDir: true,
  },
});
