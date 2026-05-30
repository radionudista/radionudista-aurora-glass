import { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';

// For component existence validation
import { readdirSync } from 'fs';

// Note: We keep original Google Drive URLs in the index for runtime conversion
// This ensures URLs stay fresh and don't expire


interface ContentEntry {
  [lang: string]: {
    title: string;
    slug: string;
    id: string;
    component: string;
    public: string;
    date: string;
    menu?: string;
    menu_position?: number;
    markdownfile: string;
    language: string;
  };
}

type ContentJson = Record<string, ContentEntry>;

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) return getMarkdownFiles(res);
    if (entry.isFile() && res.endsWith('.md')) return [res];
    return [];
  }));
  return files.flat();
}

function getIdFromFilename(filename: string): string {
  return path.basename(filename, '.md');
}

// Removed processAudioSource function - we'll handle URL conversion at runtime
// to ensure Google Drive URLs stay fresh and don't expire

export interface GenerateContentIndexOptions {
  contentDir: string;
  outputFile: string;
  supportedLanguages: string[];
  /** false = sin resumen en consola (p. ej. API del editor) */
  verbose?: boolean;
}

/** Regenera contentIndex.json desde el markdown (misma lógica que el plugin de Vite). */
export async function generateContentIndexFile(
  options: GenerateContentIndexOptions
): Promise<{ entryCount: number }> {
  const { contentDir, outputFile, supportedLanguages, verbose = false } = options;
  const content: ContentJson = {};
  const errors: string[] = [];
  const menuMap: Record<string, Record<string, { menu: string; menu_position: number; file: string }>> = {};
  const langContentCount: Record<string, number> = {};

  let pageComponents: string[] = [];
  try {
    pageComponents = readdirSync(path.resolve(process.cwd(), 'src/pages'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => f.replace(/\.[^.]+$/, ''));
  } catch {
    errors.push('Could not read src/pages for component validation.');
  }

  for (const lang of supportedLanguages) {
    const langDir = path.join(contentDir, lang);
    try {
      const files = await getMarkdownFiles(langDir);
      for (const file of files) {
        const fileContent = await fs.readFile(file, 'utf-8');
        const { data, content: mdBody } = matter(fileContent);

        const alwaysRequired = ['title', 'slug', 'id', 'component', 'public', 'date', 'language'];
        for (const field of alwaysRequired) {
          if (typeof data[field] === 'undefined' || data[field] === '') {
            errors.push(`[${lang}] ${file}: Missing required frontmatter field: ${field}`);
          }
        }

        if (typeof data.menu !== 'undefined' && data.menu !== '') {
          if (
            typeof data.menu_position === 'undefined' ||
            data.menu_position === '' ||
            isNaN(Number(data.menu_position))
          ) {
            errors.push(`[${lang}] ${file}: menu_position is mandatory and must be a number if menu is set.`);
          }
        }

        if (data.component && !pageComponents.includes(data.component)) {
          errors.push(`[${lang}] ${file}: Component '${data.component}' does not exist in src/pages.`);
        }

        if (!menuMap[lang]) menuMap[lang] = {};
        const isPublic = data.public === true || data.public === 'true';
        if (
          isPublic &&
          typeof data.menu !== 'undefined' &&
          data.menu !== '' &&
          typeof data.menu_position !== 'undefined' &&
          data.menu_position !== '' &&
          !isNaN(Number(data.menu_position))
        ) {
          const menuKey = `${data.menu}|${data.menu_position}`;
          if (menuMap[lang][menuKey]) {
            errors.push(
              `[${lang}] ${file}: Duplicate menu/menu_position ('${data.menu}', ${data.menu_position}) also in ${menuMap[lang][menuKey].file}`
            );
          } else {
            menuMap[lang][menuKey] = { menu: data.menu, menu_position: data.menu_position, file };
          }
        }

        if (!mdBody || !mdBody.trim()) {
          errors.push(`[${lang}] ${file}: Markdown body is empty or invalid.`);
        }

        if (!(data.public === true || data.public === 'true')) continue;

        const id = data.id || getIdFromFilename(file);
        if (!content[id]) content[id] = {};

        const relPath = path.relative(process.cwd(), file).replace(/^src\//, '/').replace(/^src\//, '/');
        content[id][lang] = {
          ...data,
          title: data.title || '',
          slug: data.slug || getIdFromFilename(file),
          id,
          component: data.component || '',
          public: data.public,
          date: data.date || '',
          menu: data.menu || '',
          menu_position:
            typeof data.menu_position === 'number'
              ? data.menu_position
              : data.menu_position
                ? Number(data.menu_position)
                : undefined,
          markdownfile: relPath.replace(/^\/src\//, '/content/'),
          language: data.language || lang,
          content: mdBody.trim(),
        };
        langContentCount[lang] = (langContentCount[lang] || 0) + 1;
      }
    } catch {
      // Ignore missing language folders
    }
  }

  const allIds = Object.keys(content);
  const missingByLang: Record<string, string[]> = {};
  for (const id of allIds) {
    for (const lang of supportedLanguages) {
      if (!content[id][lang]) {
        if (!missingByLang[lang]) missingByLang[lang] = [];
        missingByLang[lang].push(id);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n\x1b[31mContent validation failed:\x1b[0m');
    for (const err of errors) {
      console.error('  -', err);
    }
    throw new Error('Content validation failed. See errors above.');
  }

  // Preserve editor-only en entries (no src/content/en markdown source).
  let existingContent: ContentJson = {};
  try {
    const raw = await fs.readFile(outputFile, 'utf-8');
    existingContent = JSON.parse(raw) as ContentJson;
  } catch {
    // First run or missing file — nothing to merge.
  }

  for (const id of Object.keys(content)) {
    const existingEn = existingContent[id]?.en;
    if (existingEn) {
      content[id].en = existingEn;
    }
  }

  await fs.writeFile(outputFile, JSON.stringify(content, null, 2), 'utf-8');

  if (verbose) {
    console.log('\n\x1b[36mContent summary by language:\x1b[0m');
    for (const lang of supportedLanguages) {
      const count = langContentCount[lang] || 0;
      console.log(`  - ${lang}: ${count} content item(s)`);
    }
    for (const lang of supportedLanguages) {
      if (missingByLang[lang] && missingByLang[lang].length > 0) {
        console.warn(`\x1b[33m[WARN]\x1b[0m Missing content for language '${lang}':`, missingByLang[lang].join(', '));
      }
    }
  }

  return { entryCount: Object.keys(content).length };
}

export function contentJsonGeneratorPlugin({
  contentDir,
  outputFile,
  supportedLanguages,
}: {
  contentDir: string;
  outputFile: string;
  supportedLanguages: string[];
}): Plugin {
  return {
    name: 'content-json-generator',
    async buildStart() {
      const { entryCount } = await generateContentIndexFile({
        contentDir,
        outputFile,
        supportedLanguages,
        verbose: true,
      });
      this.info(`Generated contentIndex.json with ${entryCount} entries.`);
    },
  };
}