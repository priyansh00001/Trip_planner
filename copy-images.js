const fs = require('fs');
const path = require('path');

const src = 'C:/Users/abhis/.gemini/antigravity/brain/38272afc-53dc-4ee4-96be-5862c4d28bb8';
const dst = path.join(__dirname, 'public');

const files = {
  'kashmir_dal_lake_1779129314100.png': 'kashmir.png',
  'rishikesh_river_1779129500331.png': 'rishikesh.png',
  'udaipur_lake_1779129526480.png': 'udaipur.png',
  'delhi_india_gate_1779126530718.png': 'delhi.png',
};

for (const [srcFile, dstFile] of Object.entries(files)) {
  const srcPath = path.join(src, srcFile);
  const dstPath = path.join(dst, dstFile);
  try {
    fs.copyFileSync(srcPath, dstPath);
    console.log(`✓ ${srcFile} → ${dstFile}`);
  } catch (e) {
    console.error(`✗ ${srcFile}: ${e.message}`);
  }
}
