import { crawlAncestry } from '../crawler/crawl-ancestry.js';
import { fetchAncestryChunk } from '../familysearch-api/ancestry.js';
import { fetchCurrentUserPersonId } from '../familysearch-api/current-user.js';
import { findPersonIdInUrl } from '../familysearch-api/person-id-from-url.js';
import { CRAWL_EVENT, CRAWL_PORT_NAME, GET_START_OPTIONS } from '../messaging/messages.js';

chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.onConnect.addListener(handleConnect);

function handleMessage(message, sender, sendResponse) {
  if (message.type !== GET_START_OPTIONS) {
    return false;
  }
  loadStartOptions().then(sendResponse);
  return true;
}

function handleConnect(port) {
  if (port.name !== CRAWL_PORT_NAME) {
    return;
  }
  const controller = new AbortController();
  port.onMessage.addListener(function handleCrawlMessage(message) {
    if (message.type === CRAWL_EVENT.START) {
      runCrawl({ port, request: message, signal: controller.signal });
    }
    if (message.type === CRAWL_EVENT.CANCEL) {
      controller.abort();
    }
  });
  port.onDisconnect.addListener(function abortOnDisconnect() {
    controller.abort();
  });
}

async function runCrawl({ port, request, signal }) {
  try {
    const tree = await crawlAncestry({
      personId: request.personId,
      maxGenerations: request.maxGenerations,
      onProgress: (progress) => port.postMessage({ type: CRAWL_EVENT.PROGRESS, progress }),
      signal,
    });
    port.postMessage({ type: CRAWL_EVENT.DONE, tree });
  } catch (error) {
    if (!signal.aborted) {
      port.postMessage({ type: CRAWL_EVENT.FAILED, message: error.message });
    }
  }
}

async function loadStartOptions() {
  try {
    const pagePersonId = findPersonIdInUrl(location.href);
    const ownPersonId = await fetchCurrentUserPersonId();
    const candidates = toCandidates({ pagePersonId, ownPersonId });
    const options = await Promise.all(candidates.map(describeCandidate));
    return { options };
  } catch (error) {
    return { options: [], error: error.message };
  }
}

function toCandidates({ pagePersonId, ownPersonId }) {
  if (pagePersonId !== '' && pagePersonId === ownPersonId) {
    return [{ personId: pagePersonId, label: 'This page (me)' }];
  }
  const candidates = [];
  if (pagePersonId !== '') {
    candidates.push({ personId: pagePersonId, label: 'This page' });
  }
  if (ownPersonId !== '') {
    candidates.push({ personId: ownPersonId, label: 'Me' });
  }
  return candidates;
}

async function describeCandidate({ personId, label }) {
  const [person] = await fetchAncestryChunk({ personId, generations: 1 });
  return { personId, label, name: person?.name ?? personId, lifespan: person?.lifespan ?? '' };
}
