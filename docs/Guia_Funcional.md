# Guía Funcional & Operativa - Nudista Radio

Este documento provee a los editores de contenido y administradores de la plataforma un resumen de cómo interactuar dinámicamente con el software día a día, garantizando el uptime y la correctitud de los componentes.

## 1. Operaciones Comunes de Desarrollo

- `bun run dev` o `npm run dev`: Levanta servidor local en `localhost:5173`.
- `bun run build`: Construye estáticos de producción (recorre y genera de antemano el índice JSON de todas las traducciones).
- `bun run preview`: Simula servidor estático usando `/dist`.
- `bun run lint`: Aplica reglas strictas de ESLint.

---

## 2. Gestión de Contenido Multilingüe

El sitio carece de backend pesado. Todo el contenido dinámico radica en archivos **Markdown** dentro de `src/content/{lenguaje}/`. Para crear un nuevo programa bajo demanda o sección:

1. Crea un `.md` dentro de la carpeta correspondientemente traducida.
2. Competa su **Frontmatter** estricto al inicio.
3. Al compilar la app (`bun run build` automático desde Github/Vercel) su URL de navegación y menú se crearán dinámicamente.

### Formato de Frontmatter Obligatorio

> [!WARNING]
> La aplicación rechazará el proceso de Deploy si las reglas del `Frontmatter` no se cumplen a rajatabla. Puedes correr el verificador manual por CLI mediante `npm run validate:frontmatter` o intentar fixear automáticamente con `npm run fix:frontmatter`.

```yaml
---
language: es
title: Nombre del Programa
slug: slug-amigable-url
id: identificador-unico
component: ProgramPage
public: true
program_order: 1
schedule: "Lunes 20:00 AST"
talent: ['Locutor Uno', 'Locutor Dos']
social: ['@twitter', '@instagram']
logo: nombredellogo.png
audio_source: https://archive.org/URL-CORRECTA... # OJO, revisar CORS debajo.
---
Cuerpo Markdown del post.
```

---

## 3. Hosting de Audios Demandados (Reglas CORS)

La web de Radio Nudista no hospeda archivos pesados como `.mp3`. Los archivos se leen mediante red pública. 

### El Problema de Google Drive
Los links de Google Drive (`https://drive.google.com/...`) fallarán un 90% de las veces bloqueados por **CORS (Cross-Origin Resource Sharing)** ya que Google no autoriza streaming web embed.  

### Solución Aprobada

Para todos los campos dentro de un MD como `audio_source`, utilizar repositorios estáticos **CORS-Friendly**.

* ✅ **Archive.org (Recomendado):** Totalmente gratis, permanentemente, CORS abierto para stream. Utiliza el URL de la descarga directa del `.mp3` final.
* ✅ **SoundCloud:** Útil y escalable.
* ✅ **Servidor propio (CDN):** Direct link a S3.
* ❌ **Google Drive / OneDrive:** Bloquearán el Player al presionar *Play*.

---

## 4. Estándares de Player Accesible (a11y)

Cuando subas nuevo contenido, ten presente que todo programa indexado y que posea audio en el Frontmatter invocará automáticamente al `<ProgramPlayer />`. 

Este reproductor garantiza:
- **Teclado:** Manejo de Play/Pause con la tecla `Espacio / Enter`.
- **Aria:** Labels detallados que exponen el nombre del locutor hacia tecnologías de asistencia.
- **Stop Interactivo:** Pausa autónomamente la radio principal 24hs o live de Twitch en caso de superponerse.
