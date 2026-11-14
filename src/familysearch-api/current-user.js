import { fetchJsonWithRetry } from './http.js';

/**
 * @returns {Promise<string>} the signed-in user's own person id, or an empty string if there is none
 */
export async function fetchCurrentUserPersonId() {
  const json = await fetchJsonWithRetry({
    path: '/platform/users/current',
    accept: 'application/json',
  });
  return json.users?.[0]?.personId ?? '';
}
