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
} as const

export const muscleFi = (key: string): string => tax.muscles[key] ?? key
export const equipmentFi = (key: string | null): string =>
  key ? (tax.equipment[key] ?? key) : '–'
