// icon.svg dan PNG belgilarni yasaydi: node assets/render_icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
(async () => {
  const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');
  const b = await chromium.launch();
  for (const s of [180, 192, 512, 1024]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    await p.screenshot({ path: path.join(root, `icon-${s}.png`), omitBackground: true });
    await p.close();
  }
  await b.close();
  console.log('PNG belgilar tayyor');
})();
