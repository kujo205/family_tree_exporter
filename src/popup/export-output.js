import { getColorScheme } from '../pdf/color-schemes.js';
import { renderPortraitPdf } from '../pdf/render-portrait-pdf.js';

/**
 * @typedef {Object} ExportSettings
 * @property {'portrait-pdf' | 'json'} format
 * @property {string} colorSchemeId
 * @property {'compact' | 'detailed'} detail
 */

/**
 * Turns a crawled tree into a downloaded file.
 * @param {{ tree: import('../crawler/crawl-ancestry.js').AncestryTree, settings: ExportSettings }} request
 * @returns {Promise<void>}
 */
export async function exportTree({ tree, settings }) {
  if (settings.format === 'json') {
    downloadBlob({
      blob: new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' }),
      filename: `${findRootName(tree)}_Family-tree-data.json`,
    });
    return;
  }
  const bytes = await renderPortraitPdf({
    tree,
    colorScheme: getColorScheme(settings.colorSchemeId),
    detail: settings.detail,
    fontBytes: await loadFontBytes(),
    exportedAt: new Date(),
  });
  downloadBlob({
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `${findRootName(tree)}_Pedigree_${tree.generationCount}-generations_${capitalize(settings.colorSchemeId)}.pdf`,
  });
}

function findRootName(tree) {
  const root = tree.people.find((person) => person.id === tree.rootId);
  const safeName = (root?.name ?? '').replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
  return safeName === '' ? tree.rootId : safeName;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function loadFontBytes() {
  const [regular, bold] = await Promise.all([
    fetchBytes('../../assets/fonts/NotoSans-Regular.ttf'),
    fetchBytes('../../assets/fonts/NotoSans-Bold.ttf'),
  ]);
  return { regular, bold };
}

async function fetchBytes(relativePath) {
  const response = await fetch(new URL(relativePath, import.meta.url));
  return response.arrayBuffer();
}

function downloadBlob({ blob, filename }) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
