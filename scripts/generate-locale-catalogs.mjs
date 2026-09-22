/**
 * Builds messages/{locale}.json and src/lib/phraseIndex.json from English source
 * strings already in the UI. Translations are written into the catalogs once;
 * the app never calls a translation service at runtime.
 *
 * Usage: node scripts/generate-locale-catalogs.mjs
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const enPath = path.join(root, 'messages/en.json');
const indexPath = path.join(root, 'src/lib/phraseIndex.json');

const TARGETS = {
  es: 'es',
  zh: 'zh-CN',
  tl: 'tl',
  vi: 'vi',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  ru: 'ru',
  de: 'de',
  ht: 'ht',
  hi: 'hi',
  pt: 'pt',
  it: 'it',
  pl: 'pl',
  ur: 'ur',
};

function phraseKey(text) {
  const key = text
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return key || 'empty';
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function collectEnglish(files) {
  const found = new Set();
  const sayRe = /say\(\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*\)|say\(\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\)/g;
  const propRe = /(?:name|sub|label|title|roleLabel|description|desc|detail|badge):\s*(?:'([^'\\]*)'|"([^"\\]*)")/g;
  const assignedRe = /(?:newErrors\.\w+|setStatus|text:)\s*=?\s*'([^'\\]+)'/g;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('usePhrase') && !src.includes('say(')) continue;
    for (const re of [sayRe, propRe, assignedRe]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(src))) {
        const text = (match[1] || match[2] || '').replace(/\\'/g, "'");
        if (!text || text.length > 180) continue;
        if (text.includes('${')) continue;
        found.add(text);
      }
    }
  }
  return [...found];
}

function uniqueKey(text, used) {
  let key = phraseKey(text);
  if (!used.has(key)) {
    used.add(key);
    return key;
  }
  let n = 2;
  while (used.has(`${key}_${n}`)) n += 1;
  const next = `${key}_${n}`;
  used.add(next);
  return next;
}

function protect(text) {
  const tokens = [];
  const shielded = text.replace(/\b(FixTray|DVI|ZIP|SMS|DTC|KPI|MRR)\b/g, (word) => {
    const token = `⟦${tokens.length}⟧`;
    tokens.push(word);
    return token;
  });
  return { shielded, tokens };
}

function restore(text, tokens) {
  return text.replace(/⟦(\d+)⟧/g, (_, n) => tokens[Number(n)] || '');
}

function flattenTranslated(data) {
  if (typeof data === 'string') return data;
  if (!Array.isArray(data)) return '';
  return data.map((part) => (Array.isArray(part) ? flattenTranslated(part) : String(part ?? ''))).join('');
}

async function translateOne(text, tl) {
  if (!text.trim()) return text;
  const { shielded, tokens } = protect(text);
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(shielded)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error(`translate ${tl} ${response.status}`);
  const data = await response.json();
  const translated = flattenTranslated(data).trim();
  if (!translated) throw new Error(`empty ${tl}`);
  return restore(translated, tokens);
}

function seedCache(enValue, localeValue, bucket) {
  if (typeof enValue === 'string' && typeof localeValue === 'string') {
    if (bucket[enValue] == null) bucket[enValue] = localeValue;
    return;
  }
  if (Array.isArray(enValue) && Array.isArray(localeValue)) {
    enValue.forEach((item, index) => seedCache(item, localeValue[index], bucket));
    return;
  }
  if (enValue && localeValue && typeof enValue === 'object' && typeof localeValue === 'object' && !Array.isArray(enValue)) {
    for (const key of Object.keys(enValue)) {
      if (key in localeValue) seedCache(enValue[key], localeValue[key], bucket);
    }
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

function translateTree(value, dictionary) {
  if (typeof value === 'string') return dictionary.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => translateTree(item, dictionary));
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, child] of Object.entries(value)) next[key] = translateTree(child, dictionary);
    return next;
  }
  return value;
}

function collectStrings(value, into) {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, into));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, into));
}

async function main() {
  const files = walkFiles(path.join(root, 'src'));
  const phrases = collectEnglish(files);
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const used = new Set(Object.keys(en.phrases || {}));
  const index = {};
  en.phrases = en.phrases || {};
  for (const text of phrases) {
    const existing = Object.entries(en.phrases).find(([, value]) => value === text);
    if (existing) {
      index[text] = existing[0];
      continue;
    }
    const key = uniqueKey(text, used);
    en.phrases[key] = text;
    index[text] = key;
  }
  fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`phrases ${Object.keys(en.phrases).length}`);

  const strings = new Set();
  collectStrings(en, strings);
  const unique = [...strings];
  console.log(`unique strings ${unique.length}`);

  const cachePath = path.join(root, 'messages/.translation-cache.json');
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};

  for (const [locale, tl] of Object.entries(TARGETS)) {
    cache[locale] = cache[locale] || {};
    const missing = unique.filter((text) => cache[locale][text] == null);
    console.log(`${locale}: translating ${missing.length}`);
    const existingPath = path.join(root, `messages/${locale}.json`);
    if (fs.existsSync(existingPath)) {
      seedCache(en, JSON.parse(fs.readFileSync(existingPath, 'utf8')), cache[locale]);
    }
    const stillMissing = unique.filter((text) => cache[locale][text] == null);
    console.log(`${locale}: translating ${stillMissing.length} (${missing.length} before seed)`);
    let done = 0;
    await mapPool(stillMissing, 4, async (text) => {
      let attempt = 0;
      while (attempt < 6) {
        try {
          cache[locale][text] = await translateOne(text, tl);
          done += 1;
          if (done % 40 === 0) {
            fs.writeFileSync(cachePath, JSON.stringify(cache));
            console.log(`${locale}: ${done}/${stillMissing.length}`);
          }
          return;
        } catch (error) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
          if (attempt === 6) {
            console.warn(`fallback ${locale}: ${text.slice(0, 60)} (${error.message})`);
            cache[locale][text] = text;
          }
        }
      }
    });
    const dictionary = new Map(Object.entries(cache[locale]));
    const translated = translateTree(en, dictionary);
    fs.writeFileSync(path.join(root, `messages/${locale}.json`), `${JSON.stringify(translated, null, 2)}\n`);
    fs.writeFileSync(cachePath, JSON.stringify(cache));
    console.log(`wrote ${locale}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
