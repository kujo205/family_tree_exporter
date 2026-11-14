const NAMED_GENERATIONS = ['Start person', 'Parents', 'Grandparents', 'Great-grandparents'];

/**
 * @param {number} generation 1 is the start person
 * @returns {string} the relationship name, such as "Grandparents" or "3rd great-grandparents"
 */
export function relationLabel(generation) {
  if (generation <= NAMED_GENERATIONS.length) {
    return NAMED_GENERATIONS[generation - 1];
  }
  return `${ordinal(generation - 3)} great-grandparents`;
}

function ordinal(number) {
  const lastTwoDigits = number % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${number}th`;
  }
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${number}${suffixes[number % 10] ?? 'th'}`;
}
