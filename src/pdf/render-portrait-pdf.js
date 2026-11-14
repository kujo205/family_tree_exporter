import { LineCapStyle, PDFDocument, PDFString, rgb } from '../vendor/pdf-lib.esm.js';
import fontkit from '../vendor/fontkit.esm.js';
import { formatExportedLine, formatGenerationNumber, formatRelation, formatSubtitle } from './languages.js';
import { parseHex, pickAccentColor, pickBandColor, pickBoxColors } from './color-schemes.js';
import { layoutPortraitTree } from './portrait-layout.js';

const PROJECT_NAME = 'Family Tree Exporter';
const PROJECT_URL = 'https://github.com/kujo205/family_tree_exporter';
const FOOTER_SIZE = 8;
const FOOTER_BASELINE = 12;
const MAX_PAGE_SIZE = 14400;
const BOX_PADDING = 6;
const CORNER_RADIUS = 6;
const ACCENT_WIDTH = 5;
const BAND_RADIUS = 10;
const BAND_OVERHANG = 9;
const CONNECTOR_RADIUS = 8;
const CONNECTOR_THICKNESS = 1.2;

/**
 * Renders a portrait pedigree: the start person at the bottom, ancestors above.
 * @param {{
 *   tree: import('../crawler/crawl-ancestry.js').AncestryTree,
 *   colorScheme: import('./color-schemes.js').ColorScheme,
 *   detail: 'compact' | 'detailed',
 *   language: import('./languages.js').Language,
 *   fontBytes: { regular: ArrayBuffer | Uint8Array, bold: ArrayBuffer | Uint8Array },
 *   exportedAt: Date
 * }} request
 * @returns {Promise<Uint8Array>} the PDF file
 */
export async function renderPortraitPdf({ tree, colorScheme, detail, language, fontBytes, exportedAt }) {
  const layout = layoutPortraitTree({ tree, detail });
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fonts = {
    regular: await document.embedFont(fontBytes.regular, { subset: false }),
    bold: await document.embedFont(fontBytes.bold, { subset: false }),
  };
  const page = document.addPage([layout.width, layout.height]);
  const canvas = { document, page, fonts, layout, colorScheme, language };

  drawBackground(canvas);
  drawBanner({ canvas, tree, exportedAt });
  drawGenerationRows(canvas);
  drawLinks(canvas);
  drawBoxes({ canvas, detail });
  linkBannerToStartPerson({ canvas, tree });
  drawFooter(canvas);
  shrinkToFitPageLimit({ page, layout });

  return document.save();
}

function drawBackground({ page, layout, colorScheme }) {
  page.drawRectangle({ x: 0, y: 0, width: layout.width, height: layout.height, color: toColor(colorScheme.background) });
}

function drawBanner({ canvas, tree, exportedAt }) {
  const { page, fonts, layout, colorScheme, language } = canvas;
  const root = tree.people.find((person) => person.id === tree.rootId);
  const textColor = toColor(colorScheme.bannerText);
  const maxWidth = layout.width - layout.margin * 2;
  page.drawRectangle({
    x: 0,
    y: layout.height - layout.bannerHeight,
    width: layout.width,
    height: layout.bannerHeight,
    color: toColor(colorScheme.banner),
  });
  const [title] = fitLines({ text: root?.name ?? tree.rootId, font: fonts.bold, size: 26, maxWidth, maxLines: 1 });
  page.drawText(title, { x: layout.margin, y: layout.height - 48, font: fonts.bold, size: 26, color: textColor });
  page.drawText(formatSubtitle({ language, peopleCount: tree.people.length, generationCount: tree.generationCount }), {
    x: layout.margin,
    y: layout.height - 72,
    font: fonts.regular,
    size: 11,
    color: textColor,
    opacity: 0.8,
  });
  const exportedText = formatExportedLine({ language, date: exportedAt });
  page.drawText(exportedText, {
    x: layout.width - layout.margin - fonts.regular.widthOfTextAtSize(exportedText, 10),
    y: layout.height - 72,
    font: fonts.regular,
    size: 10,
    color: textColor,
    opacity: 0.8,
  });
}

function drawGenerationRows({ page, fonts, layout, colorScheme, language }) {
  const bandWidth = layout.width - layout.margin;
  for (const row of layout.rows) {
    page.drawSvgPath(roundedRectanglePath({ width: bandWidth, height: row.height + BAND_OVERHANG * 2, radius: BAND_RADIUS }), {
      x: layout.margin / 2,
      y: layout.height - (row.top - BAND_OVERHANG),
      color: toColor(pickBandColor(colorScheme)),
      borderWidth: 0,
    });
    drawRowLabel({ canvas: { page, fonts, layout, colorScheme, language }, row });
  }
}

function drawRowLabel({ canvas, row }) {
  const { page, fonts, layout, colorScheme, language } = canvas;
  const relation = formatRelation({ language, generation: row.generation });
  const nameLines = fitLines({ text: relation, font: fonts.bold, size: 9, maxWidth: layout.labelWidth, maxLines: 2 });
  const lines = [
    ...nameLines.map((text) => ({ text, font: fonts.bold, size: 9, lineHeight: 11 })),
    { text: formatGenerationNumber({ language, generation: row.generation }), font: fonts.regular, size: 7.5, lineHeight: 10 },
  ];
  const blockHeight = lines.reduce((total, line) => total + line.lineHeight, 0);
  let top = row.top + (row.height - blockHeight) / 2;
  for (const line of lines) {
    page.drawText(line.text, {
      x: layout.margin,
      y: layout.height - top - line.size,
      font: line.font,
      size: line.size,
      color: toColor(colorScheme.mutedText),
    });
    top += line.lineHeight;
  }
}

function drawLinks({ page, layout, colorScheme }) {
  if (layout.links.length === 0) {
    return;
  }
  page.drawSvgPath(layout.links.map(linkPath).join(' '), {
    x: 0,
    y: layout.height,
    borderColor: toColor(colorScheme.line),
    borderWidth: CONNECTOR_THICKNESS,
    borderLineCap: LineCapStyle.Round,
  });
}

function linkPath({ child, parents, busY }) {
  const stem = `M ${child.x} ${child.y} V ${busY}`;
  return [stem, ...parents.map((parent) => branchPath({ parent, childX: child.x, busY }))].join(' ');
}

function branchPath({ parent, childX, busY }) {
  const distance = childX - parent.x;
  if (Math.abs(distance) < 0.01) {
    return `M ${parent.x} ${parent.bottomY} V ${busY}`;
  }
  const direction = Math.sign(distance);
  const radius = Math.min(CONNECTOR_RADIUS, Math.abs(distance) / 2, busY - parent.bottomY);
  return `M ${parent.x} ${parent.bottomY} V ${busY - radius} Q ${parent.x} ${busY} ${parent.x + direction * radius} ${busY} H ${childX}`;
}

function drawBoxes({ canvas, detail }) {
  for (const box of canvas.layout.boxes) {
    const colors = pickBoxColors({
      scheme: canvas.colorScheme,
      person: box.person,
      position: { generation: box.generation, maxGeneration: canvas.layout.maxGeneration },
    });
    drawBox({ canvas, box, fill: colors.fill });
    drawAccentStripe({ canvas, box });
    drawBoxText({ canvas, box, colors, detail });
    addLinkAnnotation({
      canvas,
      area: { x: box.x, y: box.y, width: box.width, height: box.height },
      url: personUrl(box.person.id),
    });
  }
}

function drawFooter(canvas) {
  const { page, fonts, layout, colorScheme, language } = canvas;
  const text = `${language.createdWith} ${PROJECT_NAME}  ·  ${PROJECT_URL.replace('https://', '')}`;
  const textWidth = fonts.regular.widthOfTextAtSize(text, FOOTER_SIZE);
  const x = layout.width - layout.margin - textWidth;
  page.drawText(text, {
    x,
    y: FOOTER_BASELINE,
    font: fonts.regular,
    size: FOOTER_SIZE,
    color: toColor(colorScheme.mutedText),
    opacity: 0.85,
  });
  addLinkAnnotation({
    canvas,
    area: { x, y: layout.height - FOOTER_BASELINE - FOOTER_SIZE - 2, width: textWidth, height: FOOTER_SIZE + 4 },
    url: PROJECT_URL,
  });
}

function linkBannerToStartPerson({ canvas, tree }) {
  const { layout } = canvas;
  addLinkAnnotation({
    canvas,
    area: { x: 0, y: 0, width: layout.width, height: layout.bannerHeight },
    url: personUrl(tree.rootId),
  });
}

function personUrl(personId) {
  return `https://www.familysearch.org/en/tree/person/details/${personId}`;
}

function addLinkAnnotation({ canvas, area, url }) {
  const { document, page, layout } = canvas;
  const annotation = document.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [area.x, layout.height - area.y - area.height, area.x + area.width, layout.height - area.y],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  page.node.addAnnot(document.context.register(annotation));
}

function drawBox({ canvas, box, fill }) {
  const { page, layout, colorScheme } = canvas;
  page.drawSvgPath(roundedRectanglePath({ width: box.width, height: box.height, radius: CORNER_RADIUS }), {
    x: box.x,
    y: layout.height - box.y,
    color: toColor(fill),
    borderColor: toColor(colorScheme.border),
    borderWidth: 1,
    borderDashArray: box.isRepeat ? [3, 2] : [],
  });
}

function drawAccentStripe({ canvas, box }) {
  const { page, layout, colorScheme } = canvas;
  const r = CORNER_RADIUS;
  const w = ACCENT_WIDTH;
  const h = box.height;
  page.drawSvgPath(`M ${r} 0 H ${w} V ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, {
    x: box.x,
    y: layout.height - box.y,
    color: toColor(pickAccentColor({ scheme: colorScheme, person: box.person })),
    borderWidth: 0,
  });
}

function roundedRectanglePath({ width, height, radius }) {
  const r = radius;
  return `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`;
}

function drawBoxText({ canvas, box, colors, detail }) {
  const { page, fonts, layout } = canvas;
  const textLeft = box.x + ACCENT_WIDTH;
  const textWidth = box.width - ACCENT_WIDTH;
  const lines = buildTextLines({ box, fonts, colors, detail, language: canvas.language, maxWidth: textWidth - BOX_PADDING * 2 });
  const blockHeight = lines.reduce((total, line) => total + line.lineHeight, 0);
  let top = box.y + (box.height - blockHeight) / 2;
  for (const line of lines) {
    const lineWidth = line.font.widthOfTextAtSize(line.text, line.size);
    page.drawText(line.text, {
      x: textLeft + (textWidth - lineWidth) / 2,
      y: layout.height - top - line.size,
      font: line.font,
      size: line.size,
      color: toColor(line.color),
    });
    top += line.lineHeight;
  }
}

function buildTextLines({ box, fonts, colors, detail, language, maxWidth }) {
  const { person } = box;
  const nameLines = fitLines({ text: person.name, font: fonts.bold, size: 9.5, maxWidth, maxLines: 2 });
  const lines = nameLines.map((text) => ({ text, font: fonts.bold, size: 9.5, lineHeight: 11.5, color: colors.text }));
  if (person.lifespan) {
    lines.push({ text: person.lifespan, font: fonts.regular, size: 8.5, lineHeight: 10.5, color: colors.mutedText });
  }
  if (detail === 'detailed' && person.birthPlace) {
    const [placeLine] = fitLines({ text: `${language.birthPrefix} ${person.birthPlace}`, font: fonts.regular, size: 7.5, maxWidth, maxLines: 1 });
    lines.push({ text: placeLine, font: fonts.regular, size: 7.5, lineHeight: 9.5, color: colors.mutedText });
  }
  if (box.isRepeat) {
    lines.push({ text: language.seeAbove, font: fonts.regular, size: 7.5, lineHeight: 9.5, color: colors.mutedText });
  }
  return lines;
}

function fitLines({ text, font, size, maxWidth, maxLines }) {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current !== '') {
      lines.push(current);
    }
    current = word;
  }
  if (current !== '') {
    lines.push(current);
  }
  return truncateToLimit({ lines, font, size, maxWidth, maxLines });
}

function truncateToLimit({ lines, font, size, maxWidth, maxLines }) {
  const kept = lines.slice(0, maxLines);
  if (kept.length === 0) {
    return [''];
  }
  const wasCut = lines.length > maxLines;
  const lastIndex = kept.length - 1;
  kept[lastIndex] = ellipsize({ text: wasCut ? `${kept[lastIndex]}…` : kept[lastIndex], font, size, maxWidth });
  return kept;
}

function ellipsize({ text, font, size, maxWidth }) {
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(result, size) > maxWidth) {
    result = `${result.slice(0, -2)}…`;
  }
  return result;
}

function shrinkToFitPageLimit({ page, layout }) {
  const scale = Math.min(1, MAX_PAGE_SIZE / Math.max(layout.width, layout.height));
  if (scale < 1) {
    page.scale(scale, scale);
  }
}

function toColor(hex) {
  const [red, green, blue] = parseHex(hex);
  return rgb(red / 255, green / 255, blue / 255);
}
