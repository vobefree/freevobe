import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const port = Number(process.env.VIBEFORGE_E2E_PORT ?? 1420);
const agentUrl = process.env.VITE_VIBEFORGE_AGENT_URL ?? 'http://127.0.0.1:4319';

export default defineConfig({
  plugins: [react(), tailwind()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  define: {
    __VIBEFORGE_DEFAULT_AGENT_URL__: JSON.stringify(agentUrl),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 4_000,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
          editor: ['@monaco-editor/react'],
          terminal: ['@xterm/xterm', '@xterm/addon-fit'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['monaco-editor'],
  },
});
