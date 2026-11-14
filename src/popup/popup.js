import { CRAWL_EVENT, CRAWL_PORT_NAME, GET_START_OPTIONS } from '../messaging/messages.js';
import { listColorSchemes, pickPreviewColors } from '../pdf/color-schemes.js';
import { exportTree } from './export-output.js';

const DEFAULT_COLOR_SCHEME_ID = 'classic';

const startPersonSelect = document.getElementById('start-person');
const generationsInput = document.getElementById('generations');
const generationLimitRadio = document.getElementById('generation-limit');
const formatGroup = document.getElementById('format-group');
const pdfOptions = document.getElementById('pdf-options');
const colorSchemeGrid = document.getElementById('color-schemes');
const exportButton = document.getElementById('export');
const cancelButton = document.getElementById('cancel');
const progressBar = document.getElementById('progress');
const statusLine = document.getElementById('status');

let activeTabId = 0;
let crawlPort = undefined;

colorSchemeGrid.replaceChildren(...listColorSchemes().map(toSwatchElement));
generationsInput.addEventListener('focus', selectGenerationLimit);
formatGroup.addEventListener('change', showOptionsForFormat);
exportButton.addEventListener('click', startExport);
cancelButton.addEventListener('click', cancelExport);
showOptionsForFormat();
init();

async function init() {
  setStatus({ text: 'Loading...' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://www.familysearch.org/')) {
    setStatus({ text: 'Open a FamilySearch page first.' });
    return;
  }
  activeTabId = tab.id;
  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { type: GET_START_OPTIONS });
    showStartOptions(response);
  } catch {
    setStatus({ text: 'Reload the FamilySearch tab and try again.', tone: 'error' });
  }
}

function toSwatchElement(scheme) {
  const colors = pickPreviewColors(scheme);
  const label = document.createElement('label');
  label.className = 'swatch';
  label.title = scheme.name;
  label.innerHTML = `
    <input type="radio" name="color-scheme" value="${scheme.id}" ${scheme.id === DEFAULT_COLOR_SCHEME_ID ? 'checked' : ''} />
    <span class="swatch-preview"></span>
    <span class="swatch-name">${scheme.name}</span>`;
  const preview = label.querySelector('.swatch-preview');
  preview.style.setProperty('--swatch-bg', colors.background);
  preview.style.setProperty('--swatch-banner', colors.banner);
  preview.style.setProperty('--swatch-fill', colors.fill);
  preview.style.setProperty('--swatch-accent', colors.accent);
  return label;
}

function showOptionsForFormat() {
  pdfOptions.hidden = readChoice('format') !== 'portrait-pdf';
}

function showStartOptions({ options, error }) {
  if (options.length === 0) {
    setStatus({ text: error ?? 'No person found. Open a person page.', tone: 'error' });
    return;
  }
  startPersonSelect.replaceChildren(...options.map(toPersonOption));
  exportButton.disabled = false;
  setStatus({ text: '' });
}

function toPersonOption({ personId, label, name, lifespan }) {
  const element = document.createElement('option');
  element.value = personId;
  element.textContent = `${label}: ${name} (${lifespan})`;
  return element;
}

function startExport() {
  crawlPort = chrome.tabs.connect(activeTabId, { name: CRAWL_PORT_NAME });
  crawlPort.onMessage.addListener(handleCrawlEvent);
  crawlPort.postMessage({
    type: CRAWL_EVENT.START,
    personId: startPersonSelect.value,
    maxGenerations: readMaxGenerations(),
  });
  showCrawlRunning();
  setStatus({ text: 'Collecting your family tree...' });
}

function cancelExport() {
  crawlPort?.postMessage({ type: CRAWL_EVENT.CANCEL });
  crawlPort?.disconnect();
  showCrawlStopped();
  setStatus({ text: 'Cancelled.' });
}

function selectGenerationLimit() {
  generationLimitRadio.checked = true;
}

function readMaxGenerations() {
  if (readChoice('generation-mode') === 'all') {
    return undefined;
  }
  const value = parseInt(generationsInput.value, 10);
  const min = Number(generationsInput.min);
  const max = Number(generationsInput.max);
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : min;
}

function readChoice(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function readExportSettings() {
  return {
    format: readChoice('format'),
    colorSchemeId: readChoice('color-scheme'),
    detail: readChoice('detail'),
  };
}

function handleCrawlEvent(event) {
  if (event.type === CRAWL_EVENT.PROGRESS) {
    const { peopleFound, generation } = event.progress;
    setStatus({ text: `${peopleFound} people found, generation ${generation}...` });
  }
  if (event.type === CRAWL_EVENT.DONE) {
    finishExport(event.tree);
  }
  if (event.type === CRAWL_EVENT.FAILED) {
    showCrawlStopped();
    setStatus({ text: `Failed: ${event.message}`, tone: 'error' });
  }
}

async function finishExport(tree) {
  setStatus({ text: `Building file for ${tree.people.length} people...` });
  try {
    await exportTree({ tree, settings: readExportSettings() });
    setStatus({ text: `Done: ${tree.people.length} people exported.`, tone: 'success' });
  } catch (error) {
    setStatus({ text: `Failed: ${error.message}`, tone: 'error' });
  }
  showCrawlStopped();
}

function showCrawlRunning() {
  exportButton.disabled = true;
  cancelButton.hidden = false;
  progressBar.hidden = false;
}

function showCrawlStopped() {
  exportButton.disabled = false;
  cancelButton.hidden = true;
  progressBar.hidden = true;
}

function setStatus({ text, tone = 'neutral' }) {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}
