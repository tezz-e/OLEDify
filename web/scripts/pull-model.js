import http from 'http';

const modelName = process.argv[2] || 'qwen2.5:3b';

console.log(`Sending /api/pull request for model: "${modelName}"...`);

const postData = JSON.stringify({
  name: modelName,
  stream: true
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 11434,
  path: '/api/pull',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  }
}, (res) => {
  let lastStatus = '';
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.status !== lastStatus || json.total) {
          if (json.total && json.completed) {
            const pct = Math.round((json.completed / json.total) * 100);
            process.stdout.write(`\r[${json.status}] ${pct}% (${(json.completed / 1e6).toFixed(1)}MB / ${(json.total / 1e6).toFixed(1)}MB)   `);
          } else {
            console.log(`\nStatus: ${json.status}`);
          }
          lastStatus = json.status;
        }
      } catch (e) {
        // ignore incomplete chunks
      }
    }
  });

  res.on('end', () => {
    console.log(`\n\nModel pull completed successfully for: "${modelName}"!`);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Pull failed with error:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();
