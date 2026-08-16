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
  yourRoutines: 'Omat ohjelmat',
  lastSession: 'Viime treeni',
  weekNumber: (n: number) => `Viikko ${n}`,
  sessionCount: (n: number) => (n === 1 ? '1 treeni' : `${n} treeniä`),
  noTrainingThisWeek: 'Ei treenejä tällä viikolla',
  startEmptyHint: 'Valitse liikkeet matkan varrella',
  muscleBalance: 'Lihasryhmät tällä viikolla',
  showMore: 'Näytä',
  showLess: 'Piilota',
  worksThese: 'Kuormittaa näitä lihasryhmiä',
  nextInCycle: '· seuraava',
  lastDone: (when: string) => `Tehty ${when}`,
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
  /** "Last time", not "Edellinen" — that read equally as the previous *set*. */
  previous: 'Viime kerralla',
  applySuggestion: 'Täytä',
  suggestRepeat: (kg: string) => `Sama kuin edellinen ${kg} kg`,
  suggestRamp: (kg: string, reps: number | null) =>
    `Viimeksi lämmittelyssä ${kg} kg${reps ? ` × ${reps}` : ''}`,
  proposalIncrease: (kg: string, delta: string) => `Ehdotus ${kg} kg (+${delta})`,
  proposalHold: (kg: string) => `Ehdotus ${kg} kg — sama kuin viimeksi`,
  proposalDeload: (kg: string) => `Ehdotus ${kg} kg — kevennys`,
  /* --- dialogue: Ensi kerralle --- */
  /** Titled by what it is about — proposals — rather than "Palaute". */
  nextTimeSheet: 'Ensi kerralle',
  /** The permanent way back in, on Yhteenveto. */
  openNextTime: 'Ehdotukset ensi kerralle',

  /** The observation. `setsLine` writes the numbers; the target is bare, since
   *  the reps are unmistakable after the ×, which also avoids "1 toistoa". */
  shortfallSeen: (name: string, line: string, target: number) =>
    `${name}: ${line}. Tavoite ${target}.`,
  shortfallSeenNoTarget: (name: string, line: string) => `${name}: ${line}.`,
  /** Why this is raised at all, and what happens if nothing is said — stated
   *  before the question, so closing the sheet is an informed choice. */
  shortfallTwice: (kg: string) =>
    `Sama kuorma jäi tavoitteesta kahdesti peräkkäin. Ilman muuta tietoa ehdotus ensi kerralle on ${kg} kg.`,
  /** The session-level opener, when more than one lift stalled. */
  shortfallMany: (names: string) =>
    `Useampi liike jäi tavoitteesta: ${names}. Ehdotukset kevenevät, ellei niitä muuta.`,
  /** Beyond the three asked about, the rest are stated rather than queried. */
  shortfallRest: (names: string) =>
    `Sama toistui myös näissä: ${names}. Ehdotukset kevenevät, ellei niitä muuta.`,

  askShortfall: 'Mistä se johtui?',
  causeLoad: 'Paino oli liian raskas',
  causeDay: 'Päivä oli huono',
  causeUnsure: 'En osaa sanoa',

  /** Three replies of the same shape, each stating the resulting load. None is
   *  written as the right answer. Unit abbreviations stay uninflected — `kg` is
   *  read *kilogramma*, so `kg:hen` would be wrong Finnish. */
  replyCauseLoad: (kg: string) => `Kevennys jää voimaan. Ehdotus ensi kerralle on ${kg} kg.`,
  replyCauseDay: (kg: string) =>
    `Kevennys peruttu. Ehdotus ensi kerralle on ${kg} kg. Jos sama toistuu, tämä kysytään uudelleen.`,
  replyCauseUnsure: (kg: string) => `Ehdotus ensi kerralle on ${kg} kg.`,
  replyManyDay: 'Kevennykset peruttu. Kuormat pysyvät ennallaan.',

  answerTag: 'Vastasit',
  nextTimeTag: 'Ensi kerralla',
  clearAnswer: 'Poista vastaus',
  /** The lower half of the sheet: every movement and its next proposed load. */
  nextLoads: 'Ehdotukset',
  nextNoProposal: 'ei ehdotusta',
  /** Accurate about the mechanism: the field is never pre-filled. */
  proposalsAreOffers: 'Ehdotus tarjotaan kirjatessa, ei täytetä valmiiksi.',

  /* --- proposal reasons, on the session screen's suggestion row --- */
  /** A deload the user declined: the load stands because they said the miss
   *  was the day, not the weight. Without this the change would be silent. */
  proposalHeld: (kg: string) => `Ehdotus ${kg} kg — kevennys peruttu`,
  /** Bodyweight work proposed "Ehdotus 0 kg" until this existed. */
  proposalBodyweight: 'Oma paino — kehitys tulee toistoista',
  proposalMixedLoads: (kg: string) => `Ehdotus ${kg} kg — raskain viime kerralta`,
  proposalNoTarget: (kg: string) => `Ehdotus ${kg} kg — ei tavoitetoistoja`,

  /** Labels the greyed number in the pad, so it is never read as entered. */
  padCurrent: 'Nykyinen',
  padOffer: 'Ehdotus',
  addSet: 'Lisää sarja',
  remainingMovements: (n: number) =>
    n === 1 ? '1 liike jäljellä' : `${n} liikettä jäljellä`,
  addMovement: 'Lisää liike',
  removeSet: 'Poista sarja',
  removeMovement: 'Poista liike',
  reorder: 'Siirrä',
  finish: 'Lopeta treeni',
  checkBeforeFinish: 'Tarkista',
  warmupOnlyIntro: (n: number) =>
    n === 1
      ? 'Tässä liikkeessä on vain lämmittelysarjoja:'
      : 'Näissä liikkeissä on vain lämmittelysarjoja:',
  /* A negated list takes eikä on the last item, not a second eivät. */
  warmupOnlyWhy:
    'Lämmittelyt eivät näy volyymissä, ennätyksissä eikä kehityksessä. Jos ne olivat työsarjoja, merkitse ne nyt.',
  markAsWorking: 'Merkitse työsarjoiksi',
  finishAnyway: 'Lopeta silti',
  markedAsWorking: (n: number) =>
    n === 1 ? '1 liike merkittiin työsarjoiksi' : `${n} liikettä merkittiin työsarjoiksi`,
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

  manage: 'Hallinta',
  doneEditing: 'Valmis',
  trainedCount: (n: number) => (n === 0 ? 'ei vielä tehtyjä' : `${n} tehty`),
  trainedOnly: 'Tehdyt',
  recentlyTrained: 'Viimeksi tehdyt',
  otherMovements: 'Muut liikkeet',
  moreTrained: (n: number) => `${n} muuta tehtyä liikettä`,
  timesDone: (n: number) => `${n} ×`,
  movementDetails: 'Tiedot',

  alerts: 'Palautuksen merkki',
  alertsHint:
    'Miten palautuksen loppu ilmoitetaan. Tärinä toimii myös taskussa; ilmoitus vaatii luvan ja tulee perille kun sovellus on auki taustalla — lukitulla puhelimella se voi tulla myöhässä.',
  alertVibrate: 'Tärinä',
  alertSound: 'Äänimerkki',
  alertNotify: 'Ilmoitus',
  notifyDenied: 'Ilmoituslupa evätty. Voit sallia sen selaimen asetuksista.',
  notifyUnsupported: 'Tämä selain ei tue ilmoituksia.',
  alertTest: 'Testaa',
  alertTestOff: 'Kytke ensin jokin merkki päälle.',
  vibrateUnsupported: 'Tämä laite ei tue tärinää.',

  /* --- onboarding --- */
  welcome: 'Tervetuloa',
  onboardingIntro:
    'Muutama tieto, niin sovellus tietää kuka treenaa ja mistä kannattaa aloittaa.',
  onboardingOnlyName: 'Vain nimi on pakollinen. Muut voit täyttää myöhemmin asetuksissa.',
  onboardingStep: (n: number, total: number) => `Vaihe ${n} / ${total}`,
  continueOn: 'Jatka',
  chooseFirstRoutine: 'Mistä aloitat?',
  chooseFirstRoutineHint:
    'Valitse ohjelma tai aloita tyhjä treeni. Voit muokata kaikkea matkan varrella.',
  recommended: '· suositus',
  startLater: 'Aloitan myöhemmin',

  bodyweight: 'Paino',
  bodyweightHint: 'Tallennetaan päivämäärän kanssa, jotta kehitystä voi seurata myöhemmin.',
  sex: 'Sukupuoli',
  sexMale: 'Mies',
  sexFemale: 'Nainen',
  birthYear: 'Syntymävuosi',
  birthYearHint: 'Ikä vanhenee, syntymävuosi ei.',
  goal: 'Tavoite',
  goalStrength: 'Voima',
  goalMuscle: 'Lihaskasvu',
  goalHabit: 'Yleiskunto',
  goalHint:
    'Vaikuttaa vain siihen, minkä ohjelman sovellus ehdottaa ensin. Voit valita minkä tahansa.',
  profileStoredHint:
    'Sukupuolta ja syntymävuotta ei vielä käytetä mihinkään — ne tallennetaan tulevia laskelmia varten.',
  profile: 'Profiili',

  demoData: 'Esimerkkidata',
  demoDataHint:
    'Luo 12 viikon treenihistoria pisimmälle ohjelmakierrolle, jotta grafiikat ja historia näyttävät jotain. Poistaminen koskee vain tätä dataa — omat treenit säilyvät.',
  generateDemoData: 'Luo esimerkkidata',
  removeDemoData: 'Poista esimerkkidata',
  demoDataAdded: (n: number, from: string, to: string) =>
    `${n} treeniä luotu (${from} – ${to})`,
  demoDataRemoved: (n: number) => `${n} esimerkkitreeni${n === 1 ? '' : 'ä'} poistettu`,
  demoDataPresent: (n: number) =>
    `Esimerkkidataa on nyt ${n} treeniä. Ne on merkitty erikseen, joten poisto ei kosketa omia treenejäsi.`,
  demoDataNoRoutines: 'Ei ohjelmia, joista dataa voisi luoda',

  history: 'Historia',
  openHistory: 'Näytä koko historia',
  allSessions: (n: number) =>
    n === 1 ? 'Näytä treeni' : `Näytä kaikki ${n} treeniä`,
  /** Column label in the history summary — the sheet is already titled Historia. */
  sessionsLabel: 'Treenejä',
  oneRepMax: '1RM-arvio',
  loadAxis: 'Kuorma',
  dotSizeIsReps: 'pallon koko = toistot',
  axisMax: 'enint.',
  volumePerWeek: 'Volyymi viikoittain',
  lastNSessions: (n: number) => `viimeiset ${n}`,
  noMovementHistory: 'Tätä liikettä ei ole vielä kirjattu.',
  noMovementHistoryHint: 'Merkitse ensimmäinen sarja tehdyksi, niin se näkyy täällä.',
  retroLogged: 'jälkikäteen kirjattu',

} as const

export const muscleFi = (key: string): string => tax.muscles[key] ?? key
/**
 * Empty, not a dash, for a movement with no equipment. Absence is the caller's
 * business: every caller composing a line does so with `.filter(Boolean)`, and a
 * dash is truthy — which is how a bodyweight movement came to read `Rinta · –`.
 */
export const equipmentFi = (key: string | null): string =>
  key ? (tax.equipment[key] ?? key) : ''
