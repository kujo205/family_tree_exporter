import { getSessionToken } from './session.js';

const MIN_REQUEST_INTERVAL_MS = 250;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

let lastRequestAt = 0;

export class HttpError extends Error {
  /**
   * @param {{ status: number, path: string }} details
   */
  constructor({ status, path }) {
    super(`FamilySearch request failed with ${status}: ${path}`);
    this.status = status;
  }
}

/**
 * GETs a FamilySearch API path, retrying on throttling and server errors.
 * @param {{ path: string, accept: string, signal?: AbortSignal }} request
 * @returns {Promise<any>}
 */
export async function fetchJsonWithRetry(request) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJsonThrottled(request);
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[attempt];
      if (!isRetryable(error) || delayMs === undefined) {
        throw error;
      }
      await sleep(delayMs);
    }
  }
}

async function fetchJsonThrottled(request) {
  await waitForRequestSlot();
  return fetchJson(request);
}

async function fetchJson({ path, accept, signal }) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: accept, Authorization: `Bearer ${getSessionToken()}` },
    signal,
  });
  if (!response.ok) {
    throw new HttpError({ status: response.status, path });
  }
  if (response.status === 204) {
    return {};
  }
  return response.json();
}

async function waitForRequestSlot() {
  const elapsedMs = Date.now() - lastRequestAt;
  if (elapsedMs < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsedMs);
  }
  lastRequestAt = Date.now();
}

function isRetryable(error) {
  return error instanceof HttpError && (error.status === 429 || error.status >= 500);
}

function sleep(milliseconds) {
  return new Promise(function resolveAfterDelay(resolve) {
    setTimeout(resolve, milliseconds);
  });
}
