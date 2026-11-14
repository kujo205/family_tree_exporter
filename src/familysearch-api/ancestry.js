import { fetchJsonWithRetry } from './http.js';

const GEDCOMX_JSON = 'application/x-gedcomx-v1+json';

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {number} ascendancyNumber 1 is the start person, 2 and 3 their parents, 4-7 grandparents, and so on
 * @property {string} name
 * @property {string} gender
 * @property {string} lifespan
 * @property {string} birthDate
 * @property {string} birthPlace
 * @property {string} deathDate
 * @property {string} deathPlace
 */

/**
 * Fetches a start person and their ancestors. FamilySearch returns at most 8 generations per call.
 * @param {{ personId: string, generations: number, signal?: AbortSignal }} request
 * @returns {Promise<Person[]>}
 */
export async function fetchAncestryChunk({ personId, generations, signal }) {
  const path = `/platform/tree/ancestry?person=${encodeURIComponent(personId)}&generations=${generations}&personDetails=`;
  const json = await fetchJsonWithRetry({ path, accept: GEDCOMX_JSON, signal });
  return (json.persons ?? []).map(toPerson).filter(hasAscendancyNumber);
}

function toPerson(raw) {
  const display = raw.display ?? {};
  return {
    id: raw.id,
    ascendancyNumber: Number(display.ascendancyNumber),
    name: display.name ?? '',
    gender: display.gender ?? '',
    lifespan: display.lifespan ?? '',
    birthDate: display.birthDate ?? '',
    birthPlace: display.birthPlace ?? '',
    deathDate: display.deathDate ?? '',
    deathPlace: display.deathPlace ?? '',
  };
}

function hasAscendancyNumber(person) {
  return Number.isFinite(person.ascendancyNumber);
}
