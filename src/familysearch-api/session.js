/**
 * Reads the FamilySearch session id that the site itself uses as its bearer token.
 * @returns {string}
 * @throws {Error} when the user is not signed in
 */
export function getSessionToken() {
  const match = document.cookie.match(/(?:^|; )fssessionid=([^;]+)/);
  if (!match) {
    throw new Error('Not signed in to FamilySearch');
  }
  return match[1];
}
