import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Appen laddas ner som en enda HTML-fil och ska kunna öppnas direkt från disk (file://).
 * Därför relativa sökvägar och allt inlinat i bygget – ingen server, inget nätverk.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
  },
});
