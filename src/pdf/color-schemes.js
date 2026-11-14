/**
 * @typedef {Object} ColorScheme
 * @property {string} id
 * @property {string} name
 * @property {string} background
 * @property {string} text
 * @property {string} mutedText
 * @property {string} line
 * @property {string} border
 * @property {string} banner
 * @property {string} bannerText
 * @property {{ male: string, female: string, unknown: string }} accent the stripe on each box, by gender
 * @property {{ male: string, female: string, unknown: string }=} genderFill boxes are tinted by gender
 * @property {{ from: string, to: string }=} generationFill boxes shade from the start person outward
 */

/** @type {ColorScheme[]} */
const COLOR_SCHEMES = [
  {
    id: 'classic',
    name: 'Classic',
    background: '#FFFFFF',
    text: '#1F2933',
    mutedText: '#5F6B76',
    line: '#7B8794',
    border: '#B4BEC9',
    banner: '#2F4B6E',
    bannerText: '#FFFFFF',
    accent: { male: '#3F7CC0', female: '#D05A82', unknown: '#98A2AD' },
    genderFill: { male: '#E6F0FB', female: '#FCE9EF', unknown: '#F1F3F5' },
  },
  {
    id: 'parchment',
    name: 'Parchment',
    background: '#F6EEDC',
    text: '#3B2A18',
    mutedText: '#6E5A41',
    line: '#9C7C4C',
    border: '#C9B48C',
    banner: '#6B4A26',
    bannerText: '#F6EEDC',
    accent: { male: '#7C5C2E', female: '#B5573A', unknown: '#8F8268' },
    genderFill: { male: '#EFE3C8', female: '#F4DFCB', unknown: '#ECE3D0' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#F4F8FB',
    text: '#12263A',
    mutedText: '#3E5870',
    line: '#4A6F8F',
    border: '#0B3C5D',
    banner: '#0B3C5D',
    bannerText: '#FFFFFF',
    accent: { male: '#2E9BD6', female: '#E0629A', unknown: '#8896A6' },
    generationFill: { from: '#0B3C5D', to: '#D6EAF8' },
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#F5FAF6',
    text: '#14281D',
    mutedText: '#3D5A48',
    line: '#4F7A5E',
    border: '#1B4332',
    banner: '#1B4332',
    bannerText: '#FFFFFF',
    accent: { male: '#3A8FBF', female: '#D26588', unknown: '#8A9A90' },
    generationFill: { from: '#1B4332', to: '#DDF3E2' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#FFF9F2',
    text: '#3A1A14',
    mutedText: '#7A4A3C',
    line: '#B56A55',
    border: '#8E1B2E',
    banner: '#8E1B2E',
    bannerText: '#FFF3E0',
    accent: { male: '#3F73B5', female: '#E8467F', unknown: '#A08A80' },
    generationFill: { from: '#8E1B2E', to: '#FFE6BF' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#111827',
    text: '#F3F4F6',
    mutedText: '#A3AAB8',
    line: '#6B7280',
    border: '#3A4A66',
    banner: '#1B2436',
    bannerText: '#F3F4F6',
    accent: { male: '#5AA0F0', female: '#F07AA8', unknown: '#8A94A6' },
    genderFill: { male: '#1E3A5F', female: '#5B2A45', unknown: '#2B3340' },
  },
];

const DEFAULT_COLOR_SCHEME_ID = 'classic';
const BAND_STRENGTH = 0.06;
const MIN_MUTED_CONTRAST = 4.5;

/**
 * @returns {ColorScheme[]}
 */
export function listColorSchemes() {
  return COLOR_SCHEMES;
}

/**
 * @param {string} id
 * @returns {ColorScheme} the matching scheme, or the default one for an unknown id
 */
export function getColorScheme(id) {
  return COLOR_SCHEMES.find((scheme) => scheme.id === id) ?? COLOR_SCHEMES.find((scheme) => scheme.id === DEFAULT_COLOR_SCHEME_ID);
}

/**
 * Picks a box's fill and a text color that stays readable on it.
 * @param {{ scheme: ColorScheme, person: { gender: string }, position: { generation: number, maxGeneration: number } }} request
 * @returns {{ fill: string, text: string, mutedText: string }}
 */
export function pickBoxColors({ scheme, person, position }) {
  const fill = scheme.generationFill ? fillByGeneration(scheme.generationFill, position) : pickByGender(scheme.genderFill, person);
  if (scheme.generationFill && contrastRatio('#FFFFFF', fill) > contrastRatio(scheme.text, fill)) {
    return { fill, text: '#FFFFFF', mutedText: '#E4EAF0' };
  }
  return { fill, text: scheme.text, mutedText: readableMutedText({ scheme, fill }) };
}

function readableMutedText({ scheme, fill }) {
  return contrastRatio(scheme.mutedText, fill) >= MIN_MUTED_CONTRAST ? scheme.mutedText : scheme.text;
}

/**
 * @param {{ scheme: ColorScheme, person: { gender: string } }} request
 * @returns {string} the stripe color for the person's gender
 */
export function pickAccentColor({ scheme, person }) {
  return pickByGender(scheme.accent, person);
}

/**
 * @param {ColorScheme} scheme
 * @returns {string} a faint tint of the text color over the background, used behind each generation row
 */
export function pickBandColor(scheme) {
  return mixColors({ from: scheme.background, to: scheme.text, progress: BAND_STRENGTH });
}

/**
 * Colors for a tiny preview of the scheme in the popup.
 * @param {ColorScheme} scheme
 * @returns {{ background: string, banner: string, fill: string, accent: string }}
 */
export function pickPreviewColors(scheme) {
  const sample = { gender: 'Male' };
  const { fill } = pickBoxColors({ scheme, person: sample, position: { generation: 2, maxGeneration: 4 } });
  return { background: scheme.background, banner: scheme.banner, fill, accent: pickAccentColor({ scheme, person: sample }) };
}

function pickByGender(colorsByGender, person) {
  if (person.gender === 'Male') {
    return colorsByGender.male;
  }
  if (person.gender === 'Female') {
    return colorsByGender.female;
  }
  return colorsByGender.unknown;
}

function fillByGeneration({ from, to }, { generation, maxGeneration }) {
  const progress = maxGeneration <= 1 ? 0 : (generation - 1) / (maxGeneration - 1);
  return mixColors({ from, to, progress });
}

function mixColors({ from, to, progress }) {
  const start = parseHex(from);
  const end = parseHex(to);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * progress));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function contrastRatio(firstHex, secondHex) {
  const [lighter, darker] = [relativeLuminance(firstHex), relativeLuminance(secondHex)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex) {
  const [red, green, blue] = parseHex(hex).map(toLinearChannel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function toLinearChannel(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {string} hex like #RRGGBB
 * @returns {[number, number, number]} channels from 0 to 255
 */
export function parseHex(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
