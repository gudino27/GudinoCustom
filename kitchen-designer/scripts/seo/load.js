// Loads the app's ES module sources (translations, site facts and routes) into
// the CommonJS build scripts, on Node 20 and later, with no dependencies.
//
// translations.js and src/seo/site.js use `export` syntax in .js files of a
// package without "type": "module", so require() refuses them and a plain
// import() would read them as CommonJS. Importing their source as a data: URL
// makes Node parse them as ES modules. They must not import anything.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

async function importEsm(file) {
  const code = fs.readFileSync(file, 'utf8');
  if (/^\s*import\s/m.test(code)) {
    throw new Error(`${path.relative(ROOT, file)} must not import other modules: the build loads it on its own`);
  }
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

async function loadSources() {
  const translations = (await importEsm(path.join(ROOT, 'src/utils/translations.js'))).default;
  const site = await importEsm(path.join(ROOT, 'src/seo/site.js'));
  return { translations, site };
}

// Same behaviour as t() in src/contexts/LanguageContext.js, plus a record of
// missing keys so a build fails instead of printing a raw key.
function makeTranslator(translations, lang, missing = new Set()) {
  return (key, fallback) => {
    const translation = translations[lang] ? translations[lang][key] : undefined;
    if (translation === undefined || translation === null) missing.add(`${lang}: ${key}`);
    const base = (translation !== undefined && translation !== null)
      ? translation
      : (typeof fallback === 'string' ? fallback : key);
    if (base && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return String(base).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, p1) => {
        const v = fallback[p1];
        return v === undefined || v === null ? m : String(v);
      });
    }
    return base;
  };
}

module.exports = { ROOT, loadSources, makeTranslator };
