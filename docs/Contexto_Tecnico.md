# Contexto Técnico - Nudista Radio Aura Glass 

Este documento es la única fuente de verdad funcional para arquitectos y desarrolladores. Describe la estructura interna, el stack y los flujos de la plataforma.

## 1. Arquitectura de Software

El proyecto es una aplicación React estática empaquetada con Vite, diseñada para alto rendimiento, ruteos multilingües estáticos, y consumo de múltiples formatos multimedia.

### Mapa del Repositorio (`/src`)

- **`/components/`**: Interfaz pura.
- **`/components/ui/`**: Implementaciones base de Shadcn UI y primitivas visuales.
- **`/content/`**: Sistema de archivos markdown de contenido multilingüe (`/es`, `/en`, `/pt`).
- **`/contexts/`**: Estado global de la app (por ej. context de audio y debugging).
- **`/pages/`**: Páginas principales servidas por `React Router` (`HomePage`, `AboutPage`, `ContactPage`, `ProgramPage` y `TwitchOnlyPlayerPage`).
- **`/plugins/`**: Scripts críticos de Vite que interceptan el build. Indexan archivos MD y transforman en JSON de navegación estática.
- **`/plan/`**: Roadmap y planes de evolución modular de la plataforma. Actualmente migrando de arquitectura base estática hacia un sistema de `Schedule Data` y `Archive Data`.

> [!WARNING]
> Exite **Deuda Técnica** en el código fuente. Hay archivos duplicados a lo largo de los directorios como `Layout_backup.tsx`, `Layout_desktop_only.tsx`, `RadioPlayer_before_alignment.tsx` y `SimplePagebk.tsx`. Éstos no deben entrar al flujo principal de producción.

---

## 2. Ecosistema de Reproductores Multimedia

Radio Nudista incluye un ecosistema complejo para gestionar streaming de video y audios bajo demanda o en vivo.

### `RadioPlayer` vs `ProgramPlayer` vs `TwitchPlayer`

* **`RadioPlayer` (Vivo)**: El componente principal nativo de la radio 24/7.
* **`ProgramPlayer` (On-Demand)**: Reproductor de episodios en las páginas dinámicas de los programas (generadas desde Markdown). Incluye controles de accesibilidad superiores, soporte interactivo de pausa/play/stop para interactuar limpiamente con `RadioPlayer`.
* **`MiniPlayer`**: Aparece contextualmente cuando otro componente se desenvuelve ocupando la visual.
* **`TwitchPlayer`**: Embed directo del livestream de Twitch de la radio. Resuelto tanto dentro del index para features ocasionales, como en pantalla completa a través de `TwitchOnlyPlayerPage`. Posee fallback para sobrepasar los bloqueos en configuraciones CORS o navegadores tipo Brave.
 
---

## 3. Variables de Entorno y Configuración

Los archivos `.env` (desarrollo, preview o producción) moldean el entorno de compilación, de aquí nace qué lenguajes entran al build.

### Variables Críticas

| Variable | Uso |
| --- | --- |
| `VITE_STREAM_URL` | URL directa del streaming de radio en vivo (Icecast/Shoutcast, etc). |
| `VITE_TWITCH_CHANNEL` | El ID/Nombre del canal de Twitch para el embed. |
| `VITE_TWITCH_STATIC_PARENTS` | Dominios padre para que Twitch no rechace el iframe. (_ej. localhost, nudistaradio.com_) |
| `VITE_SUPPORTED_LANGUAGES` | Coma-separada de lenguajes permitidos. (ej. `es,en,pt`). |
| `VITE_DEFAULT_LANGUAGE` | Idioma de las rutas root. |

> [!IMPORTANT]
> Un error en el `VITE_TWITCH_STATIC_PARENTS` derivará ineludiblemente en que el componente `TwitchPlayer` parpadee y muestre error de CORS.

---

## 4. Pipeline de Vite Plugins 

Radio Nudista no consume base de datos externa para el contenido estático de los programas y menús (hasta que finalicen las etapas planificadas en `/plan`), sino que muta archivos MarkDown instalados en `src/content/`:

1.  **Vite Hook `buildStart`:** Busca en `src/content/{lang}/`.
2.  Levanta slugs, order, frontmatters de cada *.md
3.  Imprime `public/content.json`, generando la capa de base de datos *read-only* de todos los menús y rutas disponibles a nivel SEO para `React Router`.

## 5. Despliegue (Deployment)

El alojamiento base se puede realizar en Netlify, Cloudflare Pages, S3 u otros proveedores de SPA.

1.  El comando `bun run build` inyecta todas las variables locales.
2.  Compila y ofusca en `./dist`.
3.  Los assets multilingües, `content.json` y los html puros quedan disponibles estáticamente sin depender de SSR, por lo tanto el backend es transparente.
