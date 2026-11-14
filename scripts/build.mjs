import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const OUT_DIR = 'dist';
const FONT_PACKAGE_DIR = 'node_modules/@expo-google-fonts/noto-sans';
const SHARED_OPTIONS = { bundle: true, minify: true, target: 'chrome120', legalComments: 'none', logLevel: 'warning' };

await main();

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await Promise.all([bundlePopup(), bundleContentScript(), copyStaticFiles()]);
  console.log(`Built ${OUT_DIR}/ - load this folder as an unpacked extension.`);
}

function bundlePopup() {
  return build({ ...SHARED_OPTIONS, entryPoints: ['src/popup/popup.js'], outfile: `${OUT_DIR}/popup.js`, format: 'esm' });
}

function bundleContentScript() {
  return build({ ...SHARED_OPTIONS, entryPoints: ['src/content/content-main.js'], outfile: `${OUT_DIR}/content.js`, format: 'iife' });
}

async function copyStaticFiles() {
  await mkdir(`${OUT_DIR}/assets/fonts`, { recursive: true });
  await Promise.all([
    cp('src/manifest.json', `${OUT_DIR}/manifest.json`),
    cp('src/popup/popup.html', `${OUT_DIR}/popup.html`),
    cp('src/popup/popup.css', `${OUT_DIR}/popup.css`),
    cp('assets/icons', `${OUT_DIR}/assets/icons`, { recursive: true }),
    cp(`${FONT_PACKAGE_DIR}/400Regular/NotoSans_400Regular.ttf`, `${OUT_DIR}/assets/fonts/NotoSans-Regular.ttf`),
    cp(`${FONT_PACKAGE_DIR}/700Bold/NotoSans_700Bold.ttf`, `${OUT_DIR}/assets/fonts/NotoSans-Bold.ttf`),
  ]);
}
