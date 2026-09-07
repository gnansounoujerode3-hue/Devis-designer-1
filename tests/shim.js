/* ============================================================
   Environnement minimal pour rendre des composants React hors du
   navigateur (Node + react-dom/server). Volontairement petit : ce que
   l'app utilise au rendu, rien de plus. Les suites s'assurent qu'aucun
   composant testé n'a besoin du DOM (effets = non exécutés au rendu).
   ============================================================ */
(function () {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: k => { store.delete(String(k)); },
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const cls = new Set();
  const classList = {
    add: c => cls.add(c), remove: c => cls.delete(c),
    toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c),
  };
  const el = () => ({ style: {}, classList, setAttribute() {}, appendChild: x => x, addEventListener() {}, removeEventListener() {} });
  globalThis.document = {
    documentElement: { classList, style: {} }, body: el(), head: el(),
    createElement: el, createTextNode: t => ({ nodeValue: t }),
    getElementById: () => null, querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  };
  globalThis.window = globalThis;
  globalThis.location = {
    href: 'https://devisdesigner.netlify.app/', search: '', hash: '',
    origin: 'https://devisdesigner.netlify.app', assign() {}, replace() {},
  };
  const nav = { language: 'fr-FR', userAgent: 'node' };
  try { Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true }); }
  catch { try { globalThis.navigator = nav; } catch { /* Node 22 l'expose déjà */ } }
  globalThis.scrollTo = () => {};
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
})();
