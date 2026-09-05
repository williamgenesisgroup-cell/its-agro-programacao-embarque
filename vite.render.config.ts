import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

function gitVersion() {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  root: fileURLToPath(new URL('./render-client', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
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
    'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify(
      process.env.RENDER_GIT_COMMIT?.slice(0, 7) || gitVersion(),
    ),
  },
  build: {
    outDir: '../dist/render-client',
    emptyOutDir: true,
  },
});
