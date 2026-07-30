const path = require('path');
const { app, nativeImage } = require('electron');
const fs = require('fs');

function candidatePaths() {
  const roots = [
    path.join(__dirname, '..', '..'),           // project root (dev)
    process.resourcesPath || '',                // packaged resources
    app?.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : '',
    app?.isPackaged ? path.join(process.resourcesPath, 'app') : '',
  ].filter(Boolean);

  const names = [
    path.join('assets', 'icon.png'),
    path.join('build', 'icon.png'),
    path.join('assets', 'Mintzy Bars Iconic Mark Green.jpg'),
  ];

  const out = [];
  for (const root of roots) {
    for (const name of names) out.push(path.join(root, name));
  }
  // Also relative to this file (src/main → ../../assets)
  out.push(path.join(__dirname, '..', '..', 'assets', 'icon.png'));
  out.push(path.join(__dirname, '..', '..', 'build', 'icon.png'));
  return out;
}

function resolveIconPath() {
  for (const p of candidatePaths()) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  return null;
}

function loadAppIcon(size) {
  const iconPath = resolveIconPath();
  if (!iconPath) return nativeImage.createEmpty();
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) return img;
  if (size) img = img.resize({ width: size, height: size, quality: 'best' });
  return img;
}

module.exports = { resolveIconPath, loadAppIcon };
