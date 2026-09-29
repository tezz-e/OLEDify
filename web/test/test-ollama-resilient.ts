import { testSinglePromptWithOllama } from '../src/engine/kinetic/ollamaClassifier';

async function run() {
  const lyrics = `Bebe kehndi tainu vihauna
Te mera shashtar de naal thaaka
SHASHTAR
Das ki kar laina kaava'n ni mera baaja aala rakha`;

  console.log('Testing testSinglePromptWithOllama...');
  const res = await testSinglePromptWithOllama(lyrics, {
    model: 'qwen2.5:1.5b',
    songTitle: 'Ashke',
    artist: 'Karan Aujla',
  });

  console.log('Classifications count:', res.parsedClassifications.length);
  console.log('Classifications:', res.parsedClassifications);
  console.log('Eval tokens:', res.evalCount);
  console.log('Speed tok/s:', res.tokensPerSecond);
  console.log('Latency ms:', res.totalDurationMs);
  if (res.error) {
    console.error('Error:', res.error);
  }
}

run().catch(console.error);
