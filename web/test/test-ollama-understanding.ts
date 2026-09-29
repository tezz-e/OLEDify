import http from 'http';

async function queryOllama(prompt: string, model: string = 'qwen2.5:1.5b'): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 500,
      }
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runUnderstandingTests() {
  const targetModel = process.argv[2] || 'qwen2.5:3b';
  console.log(`\n======================================================`);
  console.log(`RUNNING PUNJABI COMPREHENSION PROBE ON: [${targetModel}]`);
  console.log(`======================================================\n`);

  console.log('=== TEST 1: Direct Translation & Meaning of Romanized Punjabi ===');
  const t1Prompt = `You are a linguistics expert. Translate these Romanized Punjabi lyrics into English and explain the key cultural words:
Lyrics:
"Bebe kehndi tainu vihauna
Te mera shashtar de naal thaaka
SHASHTAR
Das ki kar laina kaava'n ni mera baaja aala rakha"

Specifically explain what these words mean:
1. Bebe
2. Shashtar
3. Thaaka
4. Kaava'n
5. Baaja aala rakha
`;
  const t1Result = await queryOllama(t1Prompt, targetModel);
  console.log('--- Model Response 1 ---');
  console.log(t1Result);

  console.log('\n=== TEST 2: Semantic Archetype Mapping with Reason (CoT) ===');
  const t2Prompt = `You are a motion designer for a 1-bit OLED kinetic typography screen.
Available archetypes:
- manga_impact: explosive violence, heavy hits, weapons, gunshots, aggressive threats
- smooth_fluid: sadness, romantic love, slow emotional tears, tenderness
- blade_slash: sharp cutting, swords, knives, sudden slices
- target_focus: aiming, targeting enemies, locked-on precision

Classify each of these Punjabi words with your reasoning explaining what the word means and why that archetype fits:
1. "Shashtar" (Punjabi)
2. "Hanjhu" (Punjabi)
3. "Bandook" (Punjabi)
4. "Pyaar" (Punjabi)

Respond in JSON format:
[
  {"word": "...", "punjabiMeaning": "...", "archetype": "...", "reason": "..."}
]`;
  const t2Result = await queryOllama(t2Prompt, targetModel);
  console.log('--- Model Response 2 ---');
  console.log(t2Result);

  console.log('\n=== TEST 3: Adversarial / Nonsense Test ===');
  const t3Prompt = `Classify these two words for kinetic motion:
1. "Goli" (Punjabi)
2. "Blipzorp" (Fake gibberish word)

Explain what each word means and pick an archetype:
[
  {"word": "...", "meaning": "...", "archetype": "..."}
]`;
  const t3Result = await queryOllama(t3Prompt, targetModel);
  console.log('--- Model Response 3 ---');
  console.log(t3Result);
}

runUnderstandingTests().catch(console.error);
