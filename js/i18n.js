const dict = {};
let langs = [];
let current = 'es';

export async function loadI18n() {
  langs = (await (await fetch('i18n/languages.json')).json()).languages;
  await Promise.all(
    langs.map(async (l) => {
      dict[l.code] = await (await fetch(`i18n/${l.code}.json`)).json();
    })
  );
}

export const languages = () => langs;
export const getLang = () => current;

export function setLang(code) {
  current = dict[code] ? code : langs[0].code;
  document.documentElement.lang = current;
}

export const otherLang = (code) => (langs.find((l) => l.code !== code) || { code }).code;

export function detectLang() {
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return langs.some((l) => l.code === nav) ? nav : 'en';
}

function lookup(lang, key) {
  let v = dict[lang];
  for (const p of key.split('.')) {
    if (v == null) return undefined;
    v = v[p];
  }
  return v;
}

export function raw(key, lang = current) {
  const v = lookup(lang, key);
  return v !== undefined ? v : lookup('en', key);
}

export function t(key, params) {
  const v = raw(key);
  if (typeof v !== 'string') return key;
  return v.replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? params[k] : m));
}
