import { h } from '../dom.js';
import { t, setLang, otherLang, getLang } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame } from '../layout.js';
import { dateKey, checkBadges } from '../rewards.js';
import { rng } from '../prng.js';

const cache = {};
async function passages(lang) {
  cache[lang] ||= (await (await fetch(`data/reading/${lang}.json`)).json()).passages;
  return cache[lang];
}

export function reading(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  const lang = p.bilingual ? otherLang(p.lang) : p.lang;
  setLang(lang);
  const box = h('div', { class: 'stack' }, h('p', {}, '…'));
  const dk = dateKey();

  passages(lang).then((list) => {
    const ok = list.filter((x) => x.levels[0] <= p.level && p.level <= x.levels[1]);
    const pool = ok.length ? ok : list;
    const passage = pool[Math.floor(rng(`${p.id}|${dk}|read`)() * pool.length)];
    let i = 0;
    let right = 0;
    const draw = () => {
      if (i >= passage.questions.length) return finish();
      const q = passage.questions[i];
      const msg = h('p', { class: 'feedback', role: 'status' });
      box.replaceChildren(
        h('h1', {}, passage.title),
        h('p', { class: 'reading-text' }, passage.text),
        h('h2', {}, q.q),
        ...q.options.map((o, n) =>
          h('button', { class: 'btn big secondary', type: 'button', onclick: (e) => {
            const good = n === q.answer;
            if (good) right += 1;
            msg.className = `feedback ${good ? 'good' : 'gentle'}`;
            msg.textContent = good ? `✓ ${t('reading.good')}` : t('reading.wrong', { answer: q.options[q.answer] });
            box.querySelectorAll('button').forEach((b) => (b.disabled = true));
            setTimeout(() => { i += 1; draw(); }, good ? 700 : 1800);
          } }, o)),
        msg
      );
    };
    const finish = () => {
      let coinsText = null;
      if (p.readDate !== dk) {
        p.readDate = dk;
        p.coins += ctx.cfg.app.rewards.readingCoins;
        p.stats.readings = (p.stats.readings || 0) + 1;
        checkBadges(p, ctx.cfg.badges, ctx.cfg.app);
        store.commit();
        coinsText = t('reading.coins', { n: ctx.cfg.app.rewards.readingCoins });
      }
      box.replaceChildren(
        h('h1', {}, `📖 ${t('reading.done')}`),
        h('p', {}, t('reading.score', { ok: right, n: passage.questions.length })),
        coinsText ? h('p', { class: 'positive' }, coinsText) : null,
        h('button', { class: 'btn big', type: 'button', onclick: () => go(`#/home/${id}`) }, t('end.back'))
      );
    };
    draw();
  });

  return frame(box, { profile: p, back: `#/home/${id}`, hideLang: true });
}
