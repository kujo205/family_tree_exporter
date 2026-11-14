Follow the coding rules in @/Users/i.kuts/devtools/ai_agents_rules/CODE_STYLES.md

Plain JavaScript (ES modules) with JSDoc, no build step. Chrome MV3 extension that exports a FamilySearch pedigree to PDF.

Vendored (no runtime fetching allowed in an extension): src/vendor/pdf-lib.esm.js is pdf-lib 1.17.1; src/vendor/fontkit.esm.js is @pdf-lib/fontkit 1.1.1 bundled with esbuild (it imports pako). assets/fonts hold Noto Sans (OFL-1.1) so Cyrillic names render.
