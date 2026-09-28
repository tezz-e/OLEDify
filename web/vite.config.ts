import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'motion',
      'motion/react',
      'framer-motion',
      'clsx',
      'tailwind-merge',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/esptool-js')) {
            return 'esptool';
          }
          if (id.includes('node_modules/@dicebear')) {
            return 'dicebear';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/ogl')) {
            return 'graphics-3d';
          }
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
        },
      },
    },
  },
});
