# Instalar Competitor-Seeker en una Mac (servidor web)

Guía paso a paso para dejar una Mac sirviendo la plataforma en
**https://competitorseeker.luislandadentsu.workers.dev**, con corridas, chat y PDF.

Cómo funciona, en una línea: la web de Cloudflare es solo una **puerta**; la app de verdad
corre en una de las Macs del equipo. La de Luis es la principal; la de la compañera, el respaldo.
Si una está apagada o dormida, la puerta usa la otra. Si las dos lo están, la web muestra
«Panel no disponible».

> Tiempo: ~45 min la primera vez. Necesitas: la Mac enchufada, acceso al repo privado
> `luislanda-dentsu/competitor-seeker` en GitHub, tu cuenta de Claude, y que Luis te pase
> los secretos del paso 5 (por AirDrop o 1Password, **nunca por chat, correo ni git**).

---

## 1. Herramientas

Abre **Terminal** y comprueba cada una:

| Herramienta | Comprobar | Si falta |
|---|---|---|
| Node 22 o superior | `node -v` | Instálalo desde https://nodejs.org (LTS) |
| Claude Code | `claude --version` | `npm install -g @anthropic-ai/claude-code` y luego `claude` una vez para iniciar sesión |
| GitHub CLI con sesión | `gh auth status` | Instala desde https://cli.github.com y ejecuta `gh auth login` |
| Google Chrome | está en Aplicaciones | https://www.google.com/chrome |

## 2. Clonar el repo (copia de servicio)

```bash
mkdir -p ~/Claude/Projects && cd ~/Claude/Projects
gh repo clone luislanda-dentsu/competitor-seeker competitor-seeker-servidor
cd competitor-seeker-servidor
git checkout main
bash scripts/setup-maquina.sh
```

`setup-maquina.sh` instala dependencias, crea `.env.local` y pasa los tests. Esta copia
**siempre se queda en `main`**: es la que ven los usuarios. Si algún día vas a desarrollar,
hazlo en otra copia (`competitor-seeker`), nunca en esta.

## 3. Sesión de Instagram (una vez)

```bash
scripts/chrome-ig.sh login
```

Se abre un Chrome aparte. Inicia sesión con la **cuenta de Instagram de la agencia** y
**cierra esa ventana** cuando termines (si queda abierta, las corridas no pueden usarla).

## 4. Instalar `cloudflared` (el conector del túnel)

```bash
mkdir -p ~/.competitor-seeker/bin && cd /tmp
curl -fsSLO https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz
tar xzf cloudflared-darwin-arm64.tgz
codesign -dv cloudflared 2>&1 | grep 'Developer ID Application: Cloudflare Inc. (68WVV388M8)' && mv cloudflared ~/.competitor-seeker/bin/
~/.competitor-seeker/bin/cloudflared --version
cd ~/Claude/Projects/competitor-seeker-servidor
```

(En una Mac Intel usa `cloudflared-darwin-amd64.tgz`.) Si la línea de `codesign` no imprime
nada, **no lo instales**: el binario no está firmado por Cloudflare.

## 5. Secretos (te los pasa Luis)

Luis, en su Mac (la que tiene `wrangler login`), crea el túnel de esta Mac:

```bash
scripts/puerta.sh alta-mac MAC_COMPANERA ~/Desktop/cloudflared-token-companera
scripts/puerta.sh desplegar
```

y te pasa por AirDrop **dos archivos**: `cloudflared-token-companera` y el `.env.local` de **su copia de servicio** (`competitor-seeker-servidor`, no la de desarrollo) con
los mismos valores que el suyo. Guárdalos así:

```bash
mv ~/Downloads/cloudflared-token-companera data/cloudflared-token && chmod 600 data/cloudflared-token
```

y en `.env.local` (ábrelo con `open -e .env.local`) deben quedar estas líneas, **idénticas a
las de Luis** salvo `CS_MAC`:

```
AUTH_SECRET=…            # igual en las dos Macs: así la sesión sobrevive si la puerta cambia de Mac
AUTH_GOOGLE_ID=…
AUTH_GOOGLE_SECRET=…
AUTH_URL=https://competitorseeker.luislandadentsu.workers.dev
CS_ADMIN_EMAIL=…
CS_SECRETO_INTERNO=…     # igual en las dos Macs y en el Worker
CS_MAC=MAC_COMPANERA     # en la de Luis: MAC_LUIS
CLAUDE_BIN=/ruta/absoluta/a/claude   # el de `which claude` en ESTA Mac
```

**No pongas `CS_AUTH=off`** en esta copia: el servicio se niega a arrancar con eso.
Borra del Escritorio/Descargas los archivos recibidos cuando termines.

El token de Apify: cópialo de Luis a `data/secrets.json` (también por AirDrop) o, una vez
dentro de la web, Ajustes → Apify (solo admin).

## 6. Que la Mac no se duerma

Ajustes del Sistema → **Batería** → Opciones → activa **«Evitar el reposo automático
cuando el adaptador de corriente está conectado y la pantalla está apagada»**
(en una Mac de escritorio: Ajustes → **Energía** → «Evitar el reposo automático…»).
Deja la Mac **enchufada**. Con la tapa cerrada y sin monitor externo, macOS la duerme igual.
El servicio además usa `caffeinate` mientras corre.

## 7. Arrancar el servicio

```bash
scripts/servidor.sh instalar
```

Comprueba los secretos, compila, y deja dos servicios que arrancan solos al iniciar sesión y
se reinician si caen: la app (`localhost:3030`) y el túnel. Al final dice
`Listo. Abre https://competitorseeker.luislandadentsu.workers.dev`.

Verifica:

```bash
scripts/servidor.sh estado        # los dos servicios «running» y «app responde»
```

y abre la URL: entra con tu cuenta de Google (Luis tiene que haberte invitado antes en
**Ajustes → Usuarios**).

## 8. Día a día

| Qué | Comando (en la copia de servicio) |
|---|---|
| Después de que Luis mergee cambios en GitHub | `scripts/servidor.sh actualizar` |
| ¿Está todo arriba? | `scripts/servidor.sh estado` |
| Ver qué pasa | `scripts/servidor.sh logs` (Ctrl+C para salir) |
| Apagarlo | `scripts/servidor.sh detener` (vuelve a arrancar con `instalar`) |

Los datos (marcas, corridas, usuarios) viajan entre las dos Macs por git automáticamente.
Una invitación o revocación hecha en una Mac llega a la otra en la siguiente sincronización
(≈1 min si está encendida).

## Problemas frecuentes

- **La web dice «Panel no disponible»**: ninguna Mac responde. En esta Mac:
  `scripts/servidor.sh estado`; si algo no está «running», `scripts/servidor.sh instalar`.
- **«Acceso no configurado»**: falta algún secreto del paso 5 en `.env.local`.
- **«Tu cuenta no tiene acceso»**: un admin debe invitar ese correo en Ajustes → Usuarios.
- **Google dice `redirect_uri_mismatch`**: la URL del cliente OAuth no coincide con
  `AUTH_URL`; avisa a Luis.
- **Las corridas dicen «SESIÓN NO DISPONIBLE» (Instagram)**: cierra el Chrome dedicado si
  está abierto; si Instagram pide login, repite el paso 3.
- **Hay una corrida en curso en la otra Mac** (aviso en Corridas): espera a que termine
  antes de lanzar otra de la misma marca.

## Seguridad (lo que conviene saber)

- **Quién entra lo decide `usuarios.json`**, que viaja por git: cualquiera con permiso de
  escritura en el repo de GitHub podría añadirse como admin. Mantén el repo privado y con
  acceso solo para el equipo.
- Los agentes (corridas y chat) **no pueden leer secretos**: `.claude/settings.headless.json`
  les deniega `.env*`, `data/`, `~/.ssh`, `~/.config`, `~/Library`, el perfil de Chrome y las
  carpetas personales (comprobado con `claude -p`, también dentro de subagentes). Si añades
  un secreto en otra ruta, añádela también ahí.
- Además, el hook `scripts/hooks/guardia-agentes.mjs` (cargado por ese mismo archivo) limita el
  navegador de las corridas a `https://www.instagram.com/`, impide que WebFetch abra `file:`,
  `localhost` o la red local, y deja al asistente del chat leer solo `marcas/` y `soul.md`.
- La copia de desarrollo escucha solo en `127.0.0.1:3040` y, con `CS_AUTH=off`, solo responde si
  se pide como `localhost`: nunca a otra máquina de la Wi-Fi.
- Si sospechas que se filtró `AUTH_SECRET`: genera otro (`openssl rand -hex 32`), cámbialo en
  las dos Macs y `scripts/servidor.sh actualizar` en ambas. Todas las sesiones se cierran.
- La copia de **desarrollo** (`CS_AUTH=off`) rechaza todo lo que llegue por la puerta de
  Cloudflare: solo sirve en `localhost`.
