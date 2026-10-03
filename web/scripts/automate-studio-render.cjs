const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm'
};

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startStaticServer(distDir, port = 5179) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(distDir, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // SPA Fallback to index.html
        const indexPath = path.join(distDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      const v = args[i + 1];
      if (v && !v.startsWith('--')) {
        opts[k] = v;
        i++;
      } else {
        opts[k] = 'true';
      }
    }
  }
  return opts;
}

// Default Presets
const PRESET_LYRICS = {
  '52bars': {
    title: '52 Bars',
    artist: 'Karan Aujla',
    lrc: `[ti:52 Bars]
[ar:Karan Aujla]
[00:00.00]Boleya kyunki chup baitha dekhda
[00:02.60]Zameer'an kidan ruldiyan rahiyan ne
[00:05.20]Rakhe kade kade patshah vi chup
[00:07.80]Te kade kade raniyan vi rulldiyan ne`
  },
  'shape_of_you': {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    lrc: `[ti:Shape of You]
[ar:Ed Sheeran]
[00:00.00]The club isn't the best place to find a lover
[00:02.60]So the bar is where I go
[00:05.00]Me and my friends at the table doing shots
[00:07.80]Drinking fast and then we talk slow`
  }
};

async function main() {
  const opts = parseCliArgs();
  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const presetKey = opts.preset || (opts.song && opts.song.toLowerCase().includes('shape') ? 'shape_of_you' : '52bars');
  const preset = PRESET_LYRICS[presetKey] || PRESET_LYRICS['52bars'];

  const songTitle = opts.song || preset.title;
  const artist = opts.artist || preset.artist;
  let lrcText = preset.lrc;

  if (opts.lyrics) {
    if (fs.existsSync(opts.lyrics)) {
      lrcText = fs.readFileSync(opts.lyrics, 'utf8');
    } else {
      lrcText = opts.lyrics;
    }
  }

  const outPath = path.resolve(opts.out || path.join(__dirname, `../exports/kinetic_${songTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.webm`));
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const port = 5179;
  console.log('================================================================');
  console.log('🚀 AUTOMATED BROWSER KINETIC STUDIO & RECORDER');
  console.log(`🎵 Song:    "${songTitle}" by ${artist}`);
  console.log(`🎯 Output:  ${outPath}`);
  console.log(`🌐 Server:  http://127.0.0.1:${port}/?view=lyrics-studio`);
  console.log('================================================================\n');

  // Step 1: Start local HTTP server for dist
  console.log('⚡ [1/5] Launching local production server...');
  const server = await startStaticServer(distDir, port);

  // Step 2: Launch Google Chrome headlessly
  console.log('🖥️ [2/5] Launching Google Chrome engine...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=swiftshader',
      '--enable-features=NetworkService,NetworkServiceInProcess'
    ]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  // Step 3: Open Lyrics Studio
  console.log('🎨 [3/5] Navigating to Lyrics Studio and loading fonts...');
  await page.goto(`http://127.0.0.1:${port}/?view=lyrics-studio`, { waitUntil: 'networkidle0' });

  // Wait for __oledStudio hook to become available
  await page.waitForFunction(() => typeof window.__oledStudio !== 'undefined', { timeout: 15000 });

  // Ingest Song & Lyrics
  console.log('📝 [4/5] Injecting lyrics and running Groq AI Director...');
  await page.evaluate((t, a, l, p) => {
    window.__oledStudio.setSong(t, a, l, p);
  }, songTitle, artist, lrcText, opts.pacing);

  // Allow brief moment for reactive layout to settle
  await new Promise(r => setTimeout(r, 800));

  // Run AI Director
  console.log('🤖 Triggering AI Director classification in browser...');
  await page.evaluate(async () => {
    await window.__oledStudio.runAiDirector();
  });

  // Wait until preview frames are rendered
  await page.waitForFunction(() => {
    return window.__oledStudio.getFramesCount() > 0;
  }, { timeout: 30000 });

  const frameCount = await page.evaluate(() => window.__oledStudio.getFramesCount());
  console.log(`✨ Rendered ${frameCount} frames in browser canvas with full fonts!`);

  // Step 5: Export WebM directly via browser MediaRecorder
  console.log('📹 [5/5] Recording high-definition WebM video from OLED canvas...');
  const base64Webm = await page.evaluate(async () => {
    return await window.__oledStudio.exportWebmBase64();
  });

  // Save WebM to disk
  const buffer = Buffer.from(base64Webm, 'base64');
  fs.writeFileSync(outPath, buffer);

  console.log(`\n================================================================`);
  console.log(`🎉 SUCCESS: WebM Video Recorded & Saved!`);
  console.log(`📁 File Size: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log(`📍 Path:      ${outPath}`);
  console.log(`================================================================\n`);

  await browser.close();
  server.close();
}

main().catch(err => {
  console.error('Fatal automation error:', err);
  process.exit(1);
});
