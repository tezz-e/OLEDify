import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

function esp32FlashPlugin(): Plugin {
  return {
    name: 'esp32-flash-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/flash' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              const projectRoot = path.resolve(__dirname, '..');
              const tempAnimPath = path.resolve(projectRoot, 'temp_anim.bin');
              const fwPath = path.resolve(projectRoot, '.pio/build/esp32-s3-devkitc-1/firmware.bin');
              const scriptPath = path.resolve(projectRoot, 'scripts/flash_device.py');
              const userHome = process.env.USERPROFILE || process.env.HOME || '';
              const pyExe = path.join(userHome, '.platformio/penv/Scripts/python.exe');

              fs.writeFileSync(tempAnimPath, buffer);

              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
              });

              const sendEvent = (percent: number, message: string) => {
                res.write(`data: ${JSON.stringify({ percent, message })}\n\n`);
              };

              sendEvent(10, 'Connected to PlatformIO flashing engine...');

              const args = [scriptPath];
              if (fs.existsSync(fwPath)) {
                args.push('--firmware', fwPath);
              }
              args.push('--animation', tempAnimPath);

              const child = spawn(pyExe, args);

              child.stdout.on('data', (data) => {
                const text = data.toString();
                const lines = text.split('\n');
                for (const rawLine of lines) {
                  const line = rawLine.trim();
                  if (line.startsWith('PROGRESS:')) {
                    const match = line.match(/PROGRESS:\s*(\d+)%\s*(.*)/);
                    if (match) {
                      sendEvent(parseInt(match[1]), match[2]);
                    }
                  } else if (line.startsWith('STATUS:')) {
                    sendEvent(15, line);
                  }
                }
              });

              child.stderr.on('data', (data) => {
                console.error('[flasher-stderr]', data.toString());
              });

              child.on('close', (code) => {
                try {
                  if (fs.existsSync(tempAnimPath)) {
                    fs.unlinkSync(tempAnimPath);
                  }
                } catch {}

                if (code === 0) {
                  sendEvent(100, 'Flash complete! 30 FPS high-speed engine running on OLED.');
                } else {
                  sendEvent(-1, `Hardware flash failed with code ${code}. Check device connection.`);
                }
                try { res.end(); } catch {}
              });

              child.on('error', (err) => {
                console.error('[flasher-spawn-error]', err);
                sendEvent(-1, `Failed to start flasher: ${err.message}`);
                try { res.end(); } catch {}
              });

              res.on('close', () => {
                if (!res.writableEnded) {
                  try {
                    child.kill();
                  } catch {}
                }
              });
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err?.message || 'Server flash error' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), esp32FlashPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: false,
    proxy: {
      '/ollama-proxy': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-proxy/, ''),
      },
    },
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
