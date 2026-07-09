import fs from 'fs';
import path from 'path';

interface Verse {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export type BibleVersion = 'kjv' | 'rv1602p' | 'rvg10';

const bibleCache: Partial<Record<BibleVersion, Record<string, Verse[]>>> = {};

const BIBLE_FILES: Record<BibleVersion, string> = {
  kjv: 'bible.json',
  rv1602p: 'bible-rv1602p.json',
  rvg10: 'bible-rvg10.json',
};

export const BIBLE_VERSIONS: Record<BibleVersion, { label: string; language: string }> = {
  kjv: { label: 'King James Version', language: 'en' },
  rv1602p: { label: 'Reina-Valera 1602 Purificada', language: 'es' },
  rvg10: { label: 'Reina Valera Gómez 2010', language: 'es' },
};

function loadBible(version: BibleVersion = 'kjv') {
  if (!bibleCache[version]) {
    const biblePath = path.join(process.cwd(), 'src', 'data', BIBLE_FILES[version]);
    if (fs.existsSync(biblePath)) {
      const raw = fs.readFileSync(biblePath, 'utf-8');
      bibleCache[version] = JSON.parse(raw);
    } else {
      console.error("Bible JSON not found at:", biblePath);
    }
  }
  return bibleCache[version] ?? null;
}

const abbrevMap: Record<string, string> = {
  'gen': 'Genesis', 'gnesis': 'Genesis', 'gn': 'Genesis', 'ex': 'Exodus', 'exo': 'Exodus', 'xodo': 'Exodus', 'lev': 'Leviticus', 'levtico': 'Leviticus', 'lv': 'Leviticus', 'num': 'Numbers', 'nmeros': 'Numbers', 'nm': 'Numbers', 'deu': 'Deuteronomy', 'deut': 'Deuteronomy', 'deuteronomio': 'Deuteronomy',
  'jos': 'Joshua', 'josh': 'Joshua', 'josu': 'Joshua', 'jud': 'Judges', 'judg': 'Judges', 'jueces': 'Judges', 'jue': 'Judges', 'rut': 'Ruth', 'ruth': 'Ruth', 'rt': 'Ruth',
  '1sa': '1 Samuel', '1sam': '1 Samuel', '1s': '1 Samuel', '2sa': '2 Samuel', '2sam': '2 Samuel', '2s': '2 Samuel', '1ki': '1 Kings', '1kin': '1 Kings', '1reyes': '1 Kings', '1r': '1 Kings',
  '2ki': '2 Kings', '2kin': '2 Kings', '2reyes': '2 Kings', '2r': '2 Kings', '1ch': '1 Chronicles', '1chr': '1 Chronicles', '1crnicas': '1 Chronicles', '1cr': '1 Chronicles', '2ch': '2 Chronicles', '2chr': '2 Chronicles', '2crnicas': '2 Chronicles', '2cr': '2 Chronicles',
  'ezr': 'Ezra', 'esdras': 'Ezra', 'esd': 'Ezra', 'neh': 'Nehemiah', 'nehemas': 'Nehemiah', 'est': 'Esther', 'ester': 'Esther', 'job': 'Job', 'ps': 'Psalms', 'psa': 'Psalms', 'salmos': 'Psalms', 'sal': 'Psalms', 'pro': 'Proverbs', 'prov': 'Proverbs', 'proverbios': 'Proverbs',
  'ecc': 'Ecclesiastes', 'eccl': 'Ecclesiastes', 'eclesiasts': 'Ecclesiastes', 'ecl': 'Ecclesiastes', 'son': 'Song of Solomon', 'song': 'Song of Solomon', 'cantares': 'Song of Solomon', 'ct': 'Song of Solomon', 'isa': 'Isaiah', 'isaas': 'Isaiah', 'jer': 'Jeremiah', 'jeremas': 'Jeremiah', 'jr': 'Jeremiah',
  'lam': 'Lamentations', 'lamentaciones': 'Lamentations', 'lm': 'Lamentations', 'eze': 'Ezekiel', 'ezek': 'Ezekiel', 'ezequiel': 'Ezekiel', 'dan': 'Daniel', 'hos': 'Hosea', 'oseas': 'Hosea', 'os': 'Hosea', 'joe': 'Joel', 'amo': 'Amos',
  'oba': 'Obadiah', 'abdas': 'Obadiah', 'abd': 'Obadiah', 'jon': 'Jonah', 'jons': 'Jonah', 'mic': 'Micah', 'miqueas': 'Micah', 'nah': 'Nahum', 'hab': 'Habakkuk', 'habacuc': 'Habakkuk', 'zep': 'Zephaniah', 'zeph': 'Zephaniah', 'sofonas': 'Zephaniah', 'sof': 'Zephaniah',
  'hag': 'Haggai', 'hageo': 'Haggai', 'zec': 'Zechariah', 'zech': 'Zechariah', 'zacaras': 'Zechariah', 'zac': 'Zechariah', 'mal': 'Malachi', 'malaquas': 'Malachi',
  'mat': 'Matthew', 'matt': 'Matthew', 'mt': 'Matthew', 'mateo': 'Matthew', 'mar': 'Mark', 'mrk': 'Mark', 'mk': 'Mark', 'marcos': 'Mark', 'mc': 'Mark', 'luk': 'Luke', 'lk': 'Luke', 'lucas': 'Luke', 'lc': 'Luke',
  'joh': 'John', 'jn': 'John', 'juan': 'John', 'act': 'Acts', 'ac': 'Acts', 'hechos': 'Acts', 'hch': 'Acts', 'rom': 'Romans', 'ro': 'Romans', 'romanos': 'Romans', '1co': '1 Corinthians', '1cor': '1 Corinthians', '1corintios': '1 Corinthians',
  '2co': '2 Corinthians', '2cor': '2 Corinthians', '2corintios': '2 Corinthians', 'gal': 'Galatians', 'glatas': 'Galatians', 'gl': 'Galatians', 'eph': 'Ephesians', 'ep': 'Ephesians', 'efesios': 'Ephesians', 'ef': 'Ephesians', 'phi': 'Philippians',
  'php': 'Philippians', 'ph': 'Philippians', 'filipenses': 'Philippians', 'flp': 'Philippians', 'col': 'Colossians', 'colosenses': 'Colossians', '1th': '1 Thessalonians', '1the': '1 Thessalonians', '1thess': '1 Thessalonians', '1tesalonicenses': '1 Thessalonians', '1ts': '1 Thessalonians',
  '2th': '2 Thessalonians', '2the': '2 Thessalonians', '2thess': '2 Thessalonians', '2tesalonicenses': '2 Thessalonians', '2ts': '2 Thessalonians', '1ti': '1 Timothy', '1tim': '1 Timothy', '1timoteo': '1 Timothy', '2ti': '2 Timothy', '2tim': '2 Timothy', '2timoteo': '2 Timothy',
  'tit': 'Titus', 'ti': 'Titus', 'tito': 'Titus', 'phm': 'Philemon', 'phile': 'Philemon', 'filemn': 'Philemon', 'flm': 'Philemon', 'heb': 'Hebrews', 'he': 'Hebrews', 'hebreos': 'Hebrews', 'jam': 'James', 'jas': 'James', 'santiago': 'James', 'stg': 'James',
  '1pe': '1 Peter', '1pet': '1 Peter', '1pedro': '1 Peter', '2pe': '2 Peter', '2pet': '2 Peter', '2pedro': '2 Peter', '1jo': '1 John', '1jon': '1 John', '1jn': '1 John', '1juan': '1 John',
  '2jo': '2 John', '2jon': '2 John', '2jn': '2 John', '2juan': '2 John', '3jo': '3 John', '3jon': '3 John', '3jn': '3 John', '3juan': '3 John', 'jde': 'Jude', 'judas': 'Jude', 'jud': 'Jude',
  'rev': 'Revelation', 're': 'Revelation', 'apocalipsis': 'Revelation', 'ap': 'Revelation',
  // Starman's Two-Letter Abbreviations
  'am': 'Amos', 'cl': 'Colossians', 'da': 'Daniel', 'dt': 'Deuteronomy', 'ec': 'Ecclesiastes', 'er': 'Ezra', 'es': 'Esther', 'ez': 'Ezekiel', 
  'ga': 'Galatians', 'ge': 'Genesis', 'hb': 'Habakkuk', 'hg': 'Haggai', 'ho': 'Hosea', 'is': 'Isaiah', 'ja': 'James', 'jb': 'Job', 'jd': 'Jude', 
  'je': 'Jeremiah', 'jg': 'Judges', 'jl': 'Joel', 'jo': 'Jonah', 'js': 'Joshua', 'la': 'Lamentations', 'le': 'Leviticus', 'ma': 'Malachi', 'mi': 'Micah',
  'na': 'Nahum', 'ne': 'Nehemiah', 'nu': 'Numbers', 'ob': 'Obadiah', 'pm': 'Philemon', 'pr': 'Proverbs', 'ru': 'Ruth', 'so': 'Song of Solomon', 
  'ze': 'Zechariah', 'zp': 'Zephaniah'
};

export function lookupVerseRange(
  book: string,
  chapter: number,
  startVerse?: number,
  endVerse?: number,
  version: BibleVersion = 'kjv',
): Verse[] {
  const bible = loadBible(version);
  if (!bible) return [];
  
  // Normalize book name (match ignore case and remove spaces)
  const normalizedQueryBook = book.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappedBook = abbrevMap[normalizedQueryBook] || book;
  const normalizedSearchQuery = mappedBook.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let targetBookKey = '';
  for (const key of Object.keys(bible)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === normalizedSearchQuery || key.toLowerCase().startsWith(mappedBook.toLowerCase())) {
      targetBookKey = key;
      break;
    }
  }
  
  if (!targetBookKey) return [];
  
  const bookVerses = bible[targetBookKey] || [];
  
  if (startVerse === undefined) {
    return bookVerses.filter(v => v.chapter === chapter);
  }
  
  const end = endVerse || startVerse;
  
  return bookVerses.filter(v => v.chapter === chapter && v.verse >= startVerse && v.verse <= end);
}

export function listBooks(version: BibleVersion = 'kjv'): string[] {
  const bible = loadBible(version);
  return bible ? Object.keys(bible) : [];
}
