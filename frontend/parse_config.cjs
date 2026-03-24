const fs = require('fs');
try {
  let content = fs.readFileSync('fb_config.json', 'utf8');
  if (content.charCodeAt(0) === 0xFFFE || content.charCodeAt(0) === 0xFEFF) {
    content = fs.readFileSync('fb_config.json', 'utf16le');
  }
  
  // Try to find the apiKey pattern using regex since JSON might be dirty
  const match = content.match(/"apiKey"\s*:\s*"([^"]+)"/);
  if (match) {
    console.log("SUCCESS_API_KEY=" + match[1]);
  } else {
    console.log("Failed to parse config. Raw data length: " + content.length);
    console.log("Raw preview: ", content.substring(0, 500));
  }
} catch (e) {
  console.log("Error reading file:", e.message);
}
