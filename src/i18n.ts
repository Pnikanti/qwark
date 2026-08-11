import taxonomy from '../data/taxonomy.json'
import type { Taxonomy } from './types'

export const tax = taxonomy as Taxonomy

/** UI copy lives here so English can be added later without touching components. */
export const fi = {
  appName: 'Qwark',

  library: 'Liikekirjasto',
  search: 'Hae liikettä',
  allMuscles: 'Kaikki lihasryhmät',
  allEquipment: 'Kaikki välineet',
  needsReview: 'Tarkistettavat',
  showHidden: 'Näytä piilotetut',
  results: (n: number) => `${n} liikettä`,
  noResults: 'Ei tuloksia',
  loading: 'Ladataan…',

  edit: 'Muokkaa',
  editMovement: 'Liikkeen muokkaus',
  bulkTranslate: 'Joukkokäännös',
  back: 'Takaisin',
  done: 'Valmis',

  nameFi: 'Nimi (FI)',
  nameEn: 'Nimi (EN)',
  primaryMuscles: 'Ensisijaiset lihakset',
  secondaryMuscles: 'Toissijaiset lihakset',
  equipment: 'Välineet',
  mechanic: 'Tyyppi',
  force: 'Suunta',
  level: 'Taso',
  instructions: 'Suoritusohje',

  edited: 'muokattu',
  resetField: 'Palauta alkuperäinen',
  hidden: 'Piilotettu',
  hideMovement: 'Piilota liike',
  hiddenNote: 'Piilotettu liike ei näy valinnassa, mutta historia säilyy.',
  idNote: 'Tunniste on pysyvä eikä muutu nimen mukana.',

  missing: 'puuttuu',
  translated: (done: number, total: number) => `${done} / ${total} käännetty`,
  untranslatedOnly: 'Vain kääntämättömät',

  export: 'Vie',
  import: 'Tuo',
  exportHint: 'Tallenna tiedostona data/overrides.json ja aja skripti uudelleen.',
  copy: 'Kopioi',
  copied: 'Kopioitu',
  imported: (n: number) => `${n} muutosta tuotu`,
  importUnknown: (ids: string[]) => `Tuntemattomat tunnisteet: ${ids.join(', ')}`,
  noOverrides: 'Ei muokkauksia',
  overrideCount: (n: number) => `${n} muokattua liikettä`,
} as const

export const muscleFi = (key: string): string => tax.muscles[key] ?? key
export const equipmentFi = (key: string | null): string =>
  key ? (tax.equipment[key] ?? key) : '—'
