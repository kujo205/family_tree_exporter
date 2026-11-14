/**
 * @typedef {Object} PluralForms
 * @property {string} one
 * @property {string} other
 * @property {string=} few
 * @property {string=} many
 *
 * @typedef {Object} Language
 * @property {string} id
 * @property {string} name the language's own name
 * @property {string} locale used to format dates and pick plural forms
 * @property {string} pedigree
 * @property {PluralForms} people
 * @property {PluralForms} generations
 * @property {string} exportedPrefix
 * @property {string} createdWith
 * @property {string} generationLabel
 * @property {string} seeAbove
 * @property {string} birthPrefix
 * @property {string[]} relations names for generation 1, 2, 3, ...
 * @property {(generation: number) => string} deeperRelation name for generations beyond the named ones
 */

const DEFAULT_LANGUAGE_ID = 'en';

/** @type {Language[]} */
const LANGUAGES = [
  {
    id: 'en',
    name: 'English',
    locale: 'en-GB',
    pedigree: 'Pedigree',
    people: { one: 'person', other: 'people' },
    generations: { one: 'generation', other: 'generations' },
    exportedPrefix: 'Exported',
    createdWith: 'Created with',
    generationLabel: 'Generation',
    seeAbove: 'see above',
    birthPrefix: 'b.',
    relations: ['Start person', 'Parents', 'Grandparents', 'Great-grandparents'],
    deeperRelation: (generation) => `${toEnglishOrdinal(generation - 3)} great-grandparents`,
  },
  {
    id: 'uk',
    name: 'Українська',
    locale: 'uk-UA',
    pedigree: 'Родовід',
    people: { one: 'людина', few: 'людини', many: 'людей', other: 'людей' },
    generations: { one: 'покоління', few: 'покоління', many: 'поколінь', other: 'покоління' },
    exportedPrefix: 'Експортовано',
    createdWith: 'Створено за допомогою',
    generationLabel: 'Покоління',
    seeAbove: 'див. вище',
    birthPrefix: 'нар.',
    relations: ['Початкова особа', 'Батьки', 'Бабусі й дідусі', 'Прабабусі й прадідусі', 'Прапрабабусі й прапрадідусі'],
    deeperRelation: () => 'Предки',
  },
  {
    id: 'de',
    name: 'Deutsch',
    locale: 'de-DE',
    pedigree: 'Ahnentafel',
    people: { one: 'Person', other: 'Personen' },
    generations: { one: 'Generation', other: 'Generationen' },
    exportedPrefix: 'Exportiert am',
    createdWith: 'Erstellt mit',
    generationLabel: 'Generation',
    seeAbove: 'siehe oben',
    birthPrefix: 'geb.',
    relations: ['Startperson', 'Eltern', 'Großeltern', 'Urgroßeltern', 'Ururgroßeltern', 'Urururgroßeltern'],
    deeperRelation: () => 'Vorfahren',
  },
  {
    id: 'es',
    name: 'Español',
    locale: 'es-ES',
    pedigree: 'Árbol genealógico',
    people: { one: 'persona', other: 'personas' },
    generations: { one: 'generación', other: 'generaciones' },
    exportedPrefix: 'Exportado el',
    createdWith: 'Creado con',
    generationLabel: 'Generación',
    seeAbove: 'ver arriba',
    birthPrefix: 'n.',
    relations: ['Persona inicial', 'Padres', 'Abuelos', 'Bisabuelos', 'Tatarabuelos', 'Trastatarabuelos'],
    deeperRelation: () => 'Antepasados',
  },
];

/**
 * @returns {Language[]}
 */
export function listLanguages() {
  return LANGUAGES;
}

/**
 * @param {string} id
 * @returns {Language} the matching language, or English for an unknown id
 */
export function getLanguage(id) {
  return LANGUAGES.find((language) => language.id === id) ?? LANGUAGES.find((language) => language.id === DEFAULT_LANGUAGE_ID);
}

/**
 * @param {{ language: Language, peopleCount: number, generationCount: number }} request
 * @returns {string} for example "Pedigree · 42 people · 8 generations"
 */
export function formatSubtitle({ language, peopleCount, generationCount }) {
  const people = `${peopleCount} ${pickPlural({ forms: language.people, count: peopleCount, locale: language.locale })}`;
  const generations = `${generationCount} ${pickPlural({ forms: language.generations, count: generationCount, locale: language.locale })}`;
  return `${language.pedigree}  ·  ${people}  ·  ${generations}`;
}

/**
 * @param {{ language: Language, date: Date }} request
 * @returns {string} for example "Exported 14 November 2026"
 */
export function formatExportedLine({ language, date }) {
  const formattedDate = date.toLocaleDateString(language.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${language.exportedPrefix} ${formattedDate}`;
}

/**
 * @param {{ language: Language, generation: number }} request generation 1 is the start person
 * @returns {string} the relationship name, such as "Grandparents"
 */
export function formatRelation({ language, generation }) {
  return language.relations[generation - 1] ?? language.deeperRelation(generation);
}

/**
 * @param {{ language: Language, generation: number }} request
 * @returns {string} for example "Generation 3"
 */
export function formatGenerationNumber({ language, generation }) {
  return `${language.generationLabel} ${generation}`;
}

function pickPlural({ forms, count, locale }) {
  return forms[new Intl.PluralRules(locale).select(count)] ?? forms.other;
}

function toEnglishOrdinal(number) {
  const lastTwoDigits = number % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${number}th`;
  }
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${number}${suffixes[number % 10] ?? 'th'}`;
}
