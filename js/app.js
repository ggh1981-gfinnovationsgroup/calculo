import { ctx } from './ctx.js';
import { store } from './store.js';
import { clear } from './dom.js';
import { loadI18n, setLang, detectLang, otherLang } from './i18n.js';
import { LocalProvider } from './providers/local.js';
import { CloudProvider } from './providers/cloud.js';
import { welcome } from './screens/welcome.js';
import { selector, profileForm } from './screens/profiles.js';
import { home } from './screens/home.js';
import { practice } from './screens/practice.js';
import { endScreen } from './screens/end.js';
import { world } from './screens/world.js';
import { reading } from './screens/reading.js';
import { parentPanel } from './screens/parent.js';
import { printSheet } from './screens/printsheet.js';
import { privacy, install } from './screens/info.js';

const root = document.getElementById('app');
let view = null;

const json = async (p) => (await fetch(p)).json();

function route() {
  const [name = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  view?._destroy?.();
  view = null;
  const st = store.state;
  const profile = id ? store.profile(id) : null;

  ctx.currentProfileId = profile?.id || null;
  document.body.classList.toggle('reduce-motion', !!profile?.reduceMotion);
  setLang(profile ? profile.lang : st.lang || detectLang());

  let el;
  const needsSetup = !st.parent.pin;
  if (needsSetup && !['privacy', 'install'].includes(name)) el = welcome();
  else {
    switch (name) {
      case '': el = selector(); break;
      case 'new': el = profileForm(null); break;
      case 'edit': el = profileForm(id); break;
      case 'home': el = home(id); break;
      case 'play': el = practice(id); break;
      case 'end': el = endScreen(id); break;
      case 'world': el = world(id); break;
      case 'read': el = reading(id); break;
      case 'parent': el = parentPanel(); break;
      case 'print': el = printSheet(id); break;
      case 'privacy': el = privacy(); break;
      case 'install': el = install(); break;
      default: el = selector();
    }
  }
  if (!el) return;
  view = el;
  clear(root);
  root.append(el);
  window.scrollTo(0, 0);
}

async function boot() {
  const [app, levels, badges, shop] = await Promise.all([
    json('config/app.json'), json('config/levels.json'), json('config/badges.json'), json('data/shop.json'),
  ]);
  ctx.cfg = { app, levels, badges, shop };
  await loadI18n();
  const local = new LocalProvider();
  const provider = new CloudProvider(local, { url: app.syncUrl });
  ctx.provider = provider;
  provider.store = store;
  await store.init(provider);
  ctx.rerender = route;

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ctx.deferredInstall = e;
  });
  route();

  if (store.state.sync) provider.syncNow().then(() => route()).catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot().catch((e) => {
  root.textContent = 'Error: ' + e.message;
});
