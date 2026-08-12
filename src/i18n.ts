import taxonomy from '../data/taxonomy.json'
import type { Taxonomy } from './types'

export const tax = taxonomy as Taxonomy

/**
 * UI copy. Finnish numerals govern case: 1 takes the nominative singular,
 * everything else the partitive — "1 liike" but "68 liikettä". Getting this
 * wrong is the fastest way to make an interface read as machine-translated.
 */
export const fi = {
  appName: 'Qwark',

  library: 'Liikekirjasto',
  search: 'Hae liikettä',
  allMuscles: 'Kaikki lihasryhmät',
  allEquipment: 'Kaikki välineet',
  needsReview: 'Tarkistettavat',
  showHidden: 'Piilotetut',
  movementCount: (n: number) => (n === 1 ? '1 liike' : `${n} liikettä`),
  editedCount: (n: number) =>
    n === 0 ? 'ei muokkauksia' : n === 1 ? '1 muokattu' : `${n} muokattua`,
  noResults: 'Ei osumia',
  noResultsHint: 'Kokeile toista hakusanaa tai poista rajaukset.',
  loading: 'Ladataan',

  editMovement: 'Muokkaa liikettä',
  bulkRename: 'Nimeä sarjassa',
  overrides: 'Muokkaukset',
  back: 'Takaisin',
  done: 'Valmis',

  nameFi: 'Nimi suomeksi',
  nameEn: 'Nimi englanniksi',
  muscles: 'Lihasryhmät',
  change: 'Muuta',
  close: 'Sulje',
  primaryMuscles: 'Ensisijaiset lihakset',
  secondaryMuscles: 'Toissijaiset lihakset',
  equipment: 'Väline',
  mechanic: 'Tyyppi',
  force: 'Suunta',
  level: 'Vaativuus',
  instructions: 'Suoritus',
  identity: 'Tunniste',

  mechanicValue: { compound: 'Moninivel', isolation: 'Eristävä' } as Record<string, string>,
  forceValue: { push: 'Työntö', pull: 'Veto', static: 'Staattinen' } as Record<string, string>,
  levelValue: {
    beginner: 'Aloittaja',
    intermediate: 'Kokenut',
    expert: 'Edistynyt',
  } as Record<string, string>,

  edited: 'Muokattu',
  revert: 'Palauta',
  hidden: 'Piilotettu',
  visible: 'Näkyvissä',
  visibility: 'Näkyvyys',
  hiddenNote: 'Piilotettu liike ei näy liikevalinnassa. Historia säilyy ennallaan.',
  identityNote: 'Tunniste pysyy samana, vaikka nimi vaihtuu. Kirjatut sarjat viittaavat siihen.',
  incomplete: 'Puuttuu',

  renameProgress: (done: number, total: number) => `${done} / ${total} nimetty`,
  untranslatedOnly: 'Vain nimeämättömät',

  exportFile: 'Lataa tiedosto',
  importFile: 'Tuo tiedosto',
  copyJson: 'Kopioi',
  copied: 'Kopioitu',
  exportHint:
    'Tallenna tiedostoksi data/overrides.json ja aja npm run data, niin muutokset siirtyvät seuraavaan koontiin.',
  imported: (n: number) => (n === 1 ? '1 muutos tuotu' : `${n} muutosta tuotu`),
  importUnknown: (ids: string[]) => `Tuntematon tunniste: ${ids.join(', ')}`,
  noOverrides: 'Ei muokkauksia',
  noOverridesHint: 'Muokkaa liikkeen nimeä tai tietoja, niin muutos näkyy täällä.',
  /* --- training --- */
  today: 'Tänään',
  startEmpty: 'Aloita tyhjä treeni',
  start: 'Aloita',
  resume: 'Jatka treeniä',
  discard: 'Hylkää',
  chooseRoutine: 'Valitse ohjelma',
  firstRunHint: 'Valitse ohjelma tai aloita tyhjä treeni. Voit muokata kaikkea matkan varrella.',
  yourRoutines: 'Omat ohjelmat',
  lastSession: 'Viime treeni',
  noHistory: 'Ei vielä treenejä',
  startedAgo: (t: string) => `aloitettu ${t} sitten`,
  setCount: (n: number) => (n === 1 ? '1 sarja' : `${n} sarjaa`),
  movementWord: (n: number) => (n === 1 ? 'liike' : 'liikettä'),
  setsOf: (done: number, total: number) =>
    `${done} / ${total} ${total === 1 ? 'sarja' : 'sarjaa'}`,
  reps: 'toistoa',
  set: 'Sarja',
  warmup: 'Lämmittely',
  working: 'Työsarja',
  previous: 'Edellinen',
  noPrevious: 'Ei aiempaa tietoa',
  addSet: 'Lisää sarja',
  addMovement: 'Lisää liike',
  removeSet: 'Poista sarja',
  removeMovement: 'Poista liike',
  reorder: 'Siirrä',
  finish: 'Lopeta treeni',
  note: 'Muistiinpano',
  notePlaceholder: 'Esim. otetta leveämmäksi',
  rest: 'Palautus',
  nextUp: 'Seuraava',
  allSetsDone: 'Kaikki sarjat tehty',
  markDone: 'Merkitse tehdyksi',
  editLogged: 'Muokkaa',
  hideLogged: 'Piilota tehdyt sarjat',
  emptySessionHint: 'Lisää liike, niin pääset kirjaamaan sarjoja.',
  skipRest: 'Ohita',
  restDone: 'Palautus ohi',
  volume: 'Volyymi',
  duration: 'Kesto',
  completedSets: 'Sarjoja',
  summary: 'Yhteenveto',
  record: 'Ennätys',
  saveAsTemplate: 'Tallenna ohjelmaksi',
  templateName: 'Ohjelman nimi',
  save: 'Tallenna',
  templateSaved: (name: string) => `Ohjelma "${name}" tallennettu`,
  dismiss: 'Sulje ilmoitus',
  discarded: 'Treeni hylättiin, koska yhtään sarjaa ei merkitty tehdyksi.',
  perSide: 'Per puoli',
  barOnly: 'Pelkkä tanko',
  plateHintBelowBar: `Alle tangon painon (${20} kg)`,
  snapToBar: (rem: number) => `Pyöristä (${rem} kg ei mahdu)`,
  decimal: 'Desimaalipilkku',
  deleteDigit: 'Poista numero',
  estimatedMax: 'Arvioitu maksimi',

} as const

export const muscleFi = (key: string): string => tax.muscles[key] ?? key
export const equipmentFi = (key: string | null): string =>
  key ? (tax.equipment[key] ?? key) : '–'
