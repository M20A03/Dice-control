const { execSync } = require('child_process');
try {
  const output = execSync('npx firebase-tools apps:sdkconfig web --project dice-roller-choice --json', { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  if (parsed.result && parsed.result.sdkConfig) {
     console.log("EXTRACTED_KEY=" + parsed.result.sdkConfig.apiKey);
  } else {
     console.log("Could not find apiKey in JSON:", output);
  }
} catch (e) {
  console.log("Error:", e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout);
}
