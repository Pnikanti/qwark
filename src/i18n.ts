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
  /* --- settings --- */
  settings: 'Asetukset',
  gymSetup: 'Salin välineet',
  barWeight: 'Tangon paino',
  availableDiscs: 'Käytettävissä olevat levyt (kg)',
  smallestStep: (kg: number) => `Pienin muutos: ${kg} kg (kevyin levypari).`,
  needOneDisc: 'Vähintään yksi levykoko tarvitaan.',
  restoreDefaults: 'Palauta oletukset',
  restoredDefaults: 'Oletukset palautettu',

  /* --- own movements --- */
  newMovement: 'Uusi liike',
  newMovementPlaceholder: 'Esim. Reisiloitonnus laitteessa',
  create: 'Luo',
  createMovement: 'Luo oma liike',
  movementCreated: (name: string) => `Liike "${name}" luotu`,
  ownMovement: 'Oma',
  deleteMovement: 'Poista liike',
  movementDeleted: 'Liike poistettu',
  movementInUse: 'Liike on käytössä historiassa. Piilota se sen sijaan.',

  /* --- training --- */
  today: 'Tänään',
  /**
   * Time-of-day greeting, with the name when one is set. "Hyvää huomenta" rather
   * than "Hyvää aamua" — both are correct, huomenta is what is actually said.
   * Late night gets a plain "Hei": "Hyvää yötä" is a farewell, not a greeting.
   */
  timeGreeting: (at: number) => {
    const hour = new Date(at).getHours()
    const base =
      hour < 5
        ? 'Hei'
        : hour < 10
          ? 'Hyvää huomenta'
          : hour < 17
            ? 'Hyvää päivää'
            : hour < 23
              ? 'Hyvää iltaa'
              : 'Hei'
    return base
  },
  yourName: 'Nimi',
  yourNameHint: 'Näkyy etusivun tervehdyksessä.',
  addWorkout: 'Lisää treeni',
  startWorkout: 'Aloita treeni',
  chooseWorkout: 'Valitse treeni',
  chooseFromRoutines: 'Ohjelmista tai tyhjältä pohjalta',
  add: 'Lisää',
  addEmpty: 'Lisää tyhjä treeni',
  loggingFor: (day: string) => `Kirjataan: ${day}`,
  startEmpty: 'Aloita tyhjä treeni',
  start: 'Aloita',
  resume: 'Jatka treeniä',
  discard: 'Hylkää',
  chooseRoutine: 'Valitse ohjelma',
  otherRoutines: 'Muut',
  otherOptions: 'Valitse toinen treeni',
  inProgress: 'Kesken',
  trainedToday: 'Tänään treenattu',
  nextTime: 'Seuraavaksi',
  anotherWorkout: 'Lisää toinen treeni',
  pickToBegin: 'Valitse mistä aloitat.',
  firstRunHint: 'Valitse ohjelma tai aloita tyhjä treeni. Voit muokata kaikkea matkan varrella.',
  yourRoutines: 'Omat ohjelmat',
  lastSession: 'Viime treeni',
  weekNumber: (n: number) => `Viikko ${n}`,
  sessionCount: (n: number) => (n === 1 ? '1 treeni' : `${n} treeniä`),
  noTrainingThisWeek: 'Ei treenejä tällä viikolla',
  noTrainingThatDay: 'Ei treeniä tänä päivänä',
  openToday: 'Tämän päivän treenit',
  openTodayHint: 'Ohjelmat ja tyhjä treeni',
  startEmptyHint: 'Valitse liikkeet matkan varrella',
  muscleBalance: 'Lihasryhmät tällä viikolla',
  showMore: 'Näytä',
  showLess: 'Piilota',
  worksThese: 'Kuormittaa näitä lihasryhmiä',
  nextInCycle: '· seuraava',
  lastDone: (when: string) => `Tehty ${when}`,
  noHistory: 'Ei vielä treenejä',
  startedAgo: (t: string) => `aloitettu ${t} sitten`,
  setCount: (n: number) => (n === 1 ? '1 sarja' : `${n} sarjaa`),
  movementWord: (n: number) => (n === 1 ? 'liike' : 'liikettä'),
  setsOf: (done: number, total: number) =>
    `${done} / ${total} ${total === 1 ? 'sarja' : 'sarjaa'}`,
  reps: 'toistoa',
  set: 'Sarja',
  setOf: (n: number, total: number) => (total > 0 ? `Sarja ${n} / ${total}` : `Sarja ${n}`),
  warmupNumber: (n: number) => `Lämmittely ${n}`,
  extraSet: (n: number) => `Lisäsarja ${n}`,
  plusExtra: (n: number) => `+${n}`,
  setKind: 'Sarjan tyyppi',
  warmupsLabel: 'Lämmittely',
  workingLabel: 'Työsarjat',
  logSet: 'Merkitse tehdyksi',
  needBoth: 'Syötä paino ja toistot',
  needWeight: 'Syötä paino — 0 = oma paino',
  needReps: 'Syötä toistot',
  warmup: 'Lämmittely',
  working: 'Työsarja',
  previous: 'Edellinen',
  applySuggestion: 'Täytä',
  suggestRepeat: (kg: string) => `Sama kuin edellinen ${kg} kg`,
  suggestRamp: (kg: string, reps: number | null) =>
    `Viimeksi lämmittelyssä ${kg} kg${reps ? ` × ${reps}` : ''}`,
  proposalIncrease: (kg: string, delta: string) => `Ehdotus ${kg} kg (+${delta})`,
  proposalHold: (kg: string) => `Ehdotus ${kg} kg — sama kuin viimeksi`,
  proposalDeload: (kg: string) => `Ehdotus ${kg} kg — kevennys`,
  noPrevious: 'Ei aiempaa tietoa',
  addSet: 'Lisää sarja',
  remainingMovements: (n: number) =>
    n === 1 ? '1 liike jäljellä' : `${n} liikettä jäljellä`,
  addMovement: 'Lisää liike',
  removeSet: 'Poista sarja',
  removeMovement: 'Poista liike',
  reorder: 'Siirrä',
  finish: 'Lopeta treeni',
  note: 'Muistiinpano',
  notePlaceholder: 'Esim. otetta leveämmäksi',
  rest: 'Palautus',
  nextUp: 'Seuraava',
  yourNextWorkout: 'Seuraava treenisi',
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
  plateHintBelowBar: (barKg: number) => `Alle tangon painon (${barKg} kg)`,
  snapToBar: (rem: number) => `Pyöristä (${rem} kg ei mahdu)`,
  decimal: 'Desimaalipilkku',
  deleteDigit: 'Poista numero',
  estimatedMax: 'Arvioitu maksimi',

} as const

export const muscleFi = (key: string): string => tax.muscles[key] ?? key
export const equipmentFi = (key: string | null): string =>
  key ? (tax.equipment[key] ?? key) : '–'
