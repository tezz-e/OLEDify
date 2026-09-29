import http from 'http';

const modelfileContent = `FROM D:\\ollama-models\\blobs\\sha256-00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4
PARAMETER temperature 0.1
PARAMETER num_ctx 4096
`;

console.log('Sending /api/create for "qwen3.5:4b"...');

const postData = JSON.stringify({
  model: 'qwen35',
  from: 'D:\\ollama-models\\blobs\\sha256-00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
  parameters: {
    temperature: 0.1,
    num_ctx: 4096,
  },
  stream: true,
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 11434,
  path: '/api/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  }
}, (res) => {
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        console.log(`Status: ${json.status || JSON.stringify(json)}`);
      } catch (e) {}
    }
  });

  res.on('end', () => {
    console.log('Finished /api/create request.');
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error during /api/create:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();
