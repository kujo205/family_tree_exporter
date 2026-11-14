import { fetchAncestryChunk } from '../familysearch-api/ancestry.js';

const MAX_GENERATIONS_PER_REQUEST = 8;
const ABSOLUTE_MAX_GENERATIONS = 30;

/**
 * @typedef {import('../familysearch-api/ancestry.js').Person} Person
 *
 * @typedef {Object} AncestryTree
 * @property {string} rootId
 * @property {Person[]} people
 * @property {Record<string, string[]>} parentIdsByPersonId
 * @property {number} generationCount how many generations were actually found, the start person being the first
 *
 * @typedef {Object} CrawlProgress
 * @property {number} peopleFound
 * @property {number} requestCount
 * @property {number} generation
 */

/**
 * Walks up the tree from a person, chaining 8-generation requests until the tree ends or the limit is reached.
 * Leaving maxGenerations out means all generations, bounded by a safety cap.
 * @param {{
 *   personId: string,
 *   maxGenerations?: number,
 *   onProgress?: (progress: CrawlProgress) => void,
 *   signal?: AbortSignal
 * }} options
 * @returns {Promise<AncestryTree>}
 */
export async function crawlAncestry({ personId, maxGenerations, onProgress = ignoreProgress, signal }) {
  const generationLimit = Math.min(maxGenerations ?? ABSOLUTE_MAX_GENERATIONS, ABSOLUTE_MAX_GENERATIONS);
  const tree = { rootId: personId, people: new Map(), parentIdsByPersonId: {}, generationCount: 1 };
  const expandedIds = new Set([personId]);
  let frontier = [{ personId, generation: 1 }];
  let requestCount = 0;

  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const entry of frontier) {
      signal?.throwIfAborted();
      const chunkSize = Math.min(MAX_GENERATIONS_PER_REQUEST, generationLimit - entry.generation + 1);
      const chunk = await fetchAncestryChunk({ personId: entry.personId, generations: chunkSize, signal });
      requestCount++;
      addChunkToTree({ tree, chunk });
      tree.generationCount = Math.max(tree.generationCount, entry.generation + deepestGenerationIn(chunk) - 1);
      onProgress({ peopleFound: tree.people.size, requestCount, generation: entry.generation + chunkSize - 1 });
      nextFrontier.push(...findUnexpandedDeepestPeople({ chunk, chunkSize, entry, expandedIds, generationLimit }));
    }
    frontier = nextFrontier;
  }

  return {
    rootId: tree.rootId,
    people: [...tree.people.values()],
    parentIdsByPersonId: tree.parentIdsByPersonId,
    generationCount: tree.generationCount,
  };
}

function ignoreProgress() {}

function deepestGenerationIn(chunk) {
  return Math.max(1, ...chunk.map((person) => generationOfAscendancyNumber(person.ascendancyNumber)));
}

function addChunkToTree({ tree, chunk }) {
  const personIdByAscendancyNumber = new Map(chunk.map(toAscendancyEntry));
  for (const person of chunk) {
    if (!tree.people.has(person.id)) {
      tree.people.set(person.id, person);
    }
    const parentIds = [person.ascendancyNumber * 2, person.ascendancyNumber * 2 + 1]
      .map((number) => personIdByAscendancyNumber.get(number))
      .filter((id) => id !== undefined);
    if (parentIds.length > 0) {
      tree.parentIdsByPersonId[person.id] = parentIds;
    }
  }
}

function toAscendancyEntry(person) {
  return [person.ascendancyNumber, person.id];
}

function findUnexpandedDeepestPeople({ chunk, chunkSize, entry, expandedIds, generationLimit }) {
  const deepestGeneration = entry.generation + chunkSize - 1;
  if (deepestGeneration >= generationLimit) {
    return [];
  }
  const found = [];
  for (const person of chunk) {
    const isDeepest = generationOfAscendancyNumber(person.ascendancyNumber) === chunkSize;
    if (isDeepest && !expandedIds.has(person.id)) {
      expandedIds.add(person.id);
      found.push({ personId: person.id, generation: deepestGeneration });
    }
  }
  return found;
}

function generationOfAscendancyNumber(ascendancyNumber) {
  return Math.floor(Math.log2(ascendancyNumber)) + 1;
}
