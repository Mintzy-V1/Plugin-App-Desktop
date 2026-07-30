const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'Mintzy Bars Iconic Mark Green.jpg');
const OUT_ASSETS = path.join(ROOT, 'assets', 'icon.png');
const OUT_BUILD = path.join(ROOT, 'build', 'icon.png');

if (!fs.existsSync(SOURCE)) {
  console.error('Missing Mintzy logo at assets/Mintzy Bars Iconic Mark Green.jpg');
  process.exit(1);
}

fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });

function convertWithSips(outPath, size) {
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), SOURCE, '--out', outPath], {
    stdio: 'inherit',
  });
}

try {
  convertWithSips(OUT_ASSETS, 512);
  convertWithSips(OUT_BUILD, 256);
  console.log('Generated Mintzy icons:');
  console.log(' -', path.relative(ROOT, OUT_ASSETS));
  console.log(' -', path.relative(ROOT, OUT_BUILD));
} catch (err) {
  // Fallback for CI (Windows runners): copy/resize isn't available via sips.
  // electron-builder accepts the JPG via a pre-made PNG committed to the repo.
  console.warn('sips unavailable — ensuring existing PNG icons are present.');
  if (!fs.existsSync(OUT_ASSETS) || !fs.existsSync(OUT_BUILD)) {
    console.error('No icon.png found. Commit assets/icon.png and build/icon.png before CI builds.');
    process.exit(1);
  }
  console.log('Using committed icon.png files.');
}
