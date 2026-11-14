const PERSON_ID_PATTERN = /\b[0-9A-Z]{4}-[0-9A-Z]{3,4}\b/;

/**
 * @param {string} url a FamilySearch page URL
 * @returns {string} the person id found in the path, or an empty string
 */
export function findPersonIdInUrl(url) {
  const match = new URL(url).pathname.match(PERSON_ID_PATTERN);
  return match ? match[0] : '';
}
