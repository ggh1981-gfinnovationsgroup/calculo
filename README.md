# Cálculo diario / Daily Math

Aplicación web instalable (PWA) para practicar cálculo mental 15 minutos al día. Sin anuncios, sin cuentas, sin costo.
Installable web app (PWA) to practice mental math 15 minutes a day. No ads, no accounts, no cost.

---

## Español

### Qué hace
- 15 minutos de tiempo **activo** por sesión (el reloj se pausa si el niño deja de interactuar, cambia de pestaña o minimiza).
- Racha con días de gracia, monedas, mascota que crece, insignias, cofre diario y meta semanal.
- Modos: grado, reto (el niño no lo ve), confianza, una cifra y dificultad adaptativa.
- Hoja imprimible de 100 operaciones en 5 columnas, más una página con respuestas.
- Lectura (en español e inglés), tienda de objetos, panel de padres con PIN, exportar/importar/borrar datos.
- Los negativos siempre van entre paréntesis, las divisiones son exactas y no se repiten operaciones.

### Publicarla gratis (GitHub Pages)
1. Sube esta carpeta a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. La página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
4. Dominio propio: copia `tools/CNAME.txt` a la raíz con el nombre `CNAME` (contiene `calculo.gfinnovationsgroup.com`). En Squarespace (DNS del dominio) crea un registro **CNAME** con host `calculo` y valor `TU-USUARIO.github.io`. Después activa **Enforce HTTPS** en Pages.

### Instalarla en el móvil
- **iPhone/iPad:** abrir en Safari → Compartir → *Añadir a pantalla de inicio*.
- **Android:** abrir en Chrome → menú ⋮ → *Instalar aplicación*.

### Cambiar contenido
- Dificultad por grado: `config/levels.json`.
- Tiempos, monedas y premios: `config/app.json`.
- Textos: `i18n/es.json` y `i18n/en.json` (deben tener las mismas claves; `npm test` lo comprueba).
- **Añadir un idioma:** crea `i18n/<codigo>.json` copiando `en.json`, `data/reading/<codigo>.json` y una línea en `i18n/languages.json`; añade los archivos a la lista de `sw.js`.
- Después de cualquier cambio, **sube el número de versión de `CACHE` en `sw.js`** (`calculo-v2`, etc.) para que los dispositivos se actualicen.

### Mensaje secreto de cumpleaños
Se abre tocando 14 veces seguidas el logo 🧮 y escribiendo una contraseña. El mensaje está en `tools/gift-message.json` (no se sube a GitHub). Para regenerar:
```
$env:GIFT_PASSWORD='tu-contraseña-larga'; npm run gift:encrypt
```
El texto cifrado es público: usa una contraseña **larga** (varias palabras). La página independiente queda en `gift/index.html`.

### Etapa 2: sincronizar dispositivos (opcional, gratis)
Por defecto los datos viven solo en el dispositivo. Para compartirlos entre dispositivos se usa un Cloudflare Worker + base D1 (plan gratuito). **Diferencia con el plan original:** en lugar de cuentas con correo se usa un **código de familia** (`XXXX-XXXX-XXXX-XXXX`); los datos se cifran en el dispositivo y el servidor solo guarda texto cifrado.
1. Instala `wrangler` (`npm i -g wrangler`) e inicia sesión: `wrangler login`.
2. `cd worker`, luego `wrangler d1 create calculo` y copia el `database_id` en `wrangler.toml`.
3. `wrangler d1 execute calculo --remote --file=schema.sql`.
4. En `wrangler.toml`, ajusta `ALLOWED_ORIGIN` al origen exacto de la página (sin `/` final).
5. `wrangler deploy`. Copia la URL `*.workers.dev` resultante.
6. Pégala en `config/app.json` → `syncUrl`, sube la versión de `sw.js` y publica.
7. En el panel de padres aparecerá *Sincronizar dispositivos*.

Límites gratuitos aproximados: Workers 100 000 solicitudes/día; D1 5 GB. Más que suficiente para una familia.

### Privacidad y legal
Hay un **borrador** de política de privacidad y términos dentro de la app (`i18n/*.json`, claves `privacy` y `terms`). **Debe revisarlo un abogado** antes de ofrecer la app al público, sobre todo por tratarse de menores.

### Pruebas
```
$env:GIFT_PASSWORD='...'; npm test
```

---

## English

### What it does
15 **active** minutes per session (the clock pauses on idle, tab switch or blur); streaks with grace days, coins, a growing mascot, badges, a daily chest and a weekly goal; grade/challenge/confidence/one-digit/adaptive modes; a printable 100-operation sheet (5 columns) plus an answer page; reading in Spanish and English; a PIN-protected parent panel with export/import/delete.

### Publish for free (GitHub Pages)
1. Push this folder to a GitHub repository.
2. **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. The site is at `https://YOUR-USER.github.io/REPO-NAME/`.
4. Custom domain: copy `tools/CNAME.txt` to the root as `CNAME` (it contains `calculo.gfinnovationsgroup.com`). In Squarespace DNS add a **CNAME** record, host `calculo`, value `YOUR-USER.github.io`, then enable **Enforce HTTPS**.

### Install on a phone
- **iPhone/iPad:** Safari → Share → *Add to Home Screen*.
- **Android:** Chrome → ⋮ → *Install app*.

### Customize
- Difficulty: `config/levels.json`. Timing and rewards: `config/app.json`. Texts: `i18n/*.json` (same keys in every language).
- **Add a language:** copy `i18n/en.json` to `i18n/<code>.json`, add `data/reading/<code>.json`, add one line to `i18n/languages.json`, and add the files to `sw.js`.
- After any change, **bump `CACHE` in `sw.js`** so devices update.

### Birthday easter egg
Tap the 🧮 logo 14 times quickly and enter the password. Message source: `tools/gift-message.json` (git-ignored). Rebuild with `$env:GIFT_PASSWORD='long passphrase'; npm run gift:encrypt`. The ciphertext is public, so use a long passphrase.

### Stage 2: device sync (optional, free)
Cloudflare Worker + D1 free tier. **Design change from the original plan:** a **family code** replaces email accounts; data is encrypted on the device and the server stores only ciphertext. Steps: `wrangler login`; in `worker/`: `wrangler d1 create calculo` (put the id in `wrangler.toml`), `wrangler d1 execute calculo --remote --file=schema.sql`, set `ALLOWED_ORIGIN`, `wrangler deploy`; put the workers.dev URL in `config/app.json` → `syncUrl`, bump `sw.js`, publish.

### Privacy and legal
The privacy policy and terms inside the app are **drafts and must be reviewed by a lawyer** before public release, especially because they involve minors.

