Follow the coding rules in @/Users/i.kuts/devtools/ai_agents_rules/CODE_STYLES.md

Plain JavaScript (ES modules) with JSDoc. Chrome MV3 extension that exports a FamilySearch pedigree to PDF.

Build: `npm run build` bundles `src/` with esbuild (scripts/build.mjs) into `dist/`, which is what gets loaded as the unpacked extension. Dependencies (pdf-lib, @pdf-lib/fontkit) come from npm and are bundled in, because extensions cannot load remote code. The Noto Sans fonts (OFL-1.1, so Cyrillic names render) are copied from the @expo-google-fonts/noto-sans dev dependency into `dist/assets/fonts`. The manifest source is `src/manifest.json`, with paths relative to `dist/`.
