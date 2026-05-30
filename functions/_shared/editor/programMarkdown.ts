import type { ContentIndexData } from '../../../src/editor/contracts';

const yamlQuote = (value: string): string => {
  if (
    /^[\w\s.,\-¡!¿?áéíóúñÁÉÍÓÚÑüÜ]+$/u.test(value) &&
    !value.includes(':') &&
    !value.includes('#')
  ) {
    return value;
  }
  return JSON.stringify(value);
};

export const programMarkdownFile = (options: {
  lang: 'es' | 'pt';
  id: string;
  title: string;
  program_order: number;
  schedule: string;
  body: string;
}): string => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { lang, id, title, program_order, schedule, body } = options;
  return `---
language: ${lang}
title: ${yamlQuote(title)}
slug: ${id}
id: ${id}
component: ProgramPage
public: true
program_order: ${program_order}
date: ${dateStr}
schedule: ${yamlQuote(schedule)}
talent: []
social: []
logo: 1.png
audio_source: ${id}.mp3
---

${body}
`;
};

export const readNextProgramOrder = (contentIndex: ContentIndexData): number => {
  let max = 0;
  for (const entry of Object.values(contentIndex)) {
    if (!entry) continue;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const order = entry[lang]?.program_order;
      if (typeof order === 'number' && !Number.isNaN(order)) max = Math.max(max, order);
    }
  }
  return max + 1;
};

export const buildNewProgramIndexEntry = (options: {
  lang: 'es' | 'pt';
  id: string;
  title: string;
  program_order: number;
  schedule: string;
  body: string;
}) => {
  const { lang, id, title, program_order, schedule, body } = options;
  const dateStr = new Date().toISOString().slice(0, 10);
  return {
    language: lang,
    title,
    slug: id,
    id,
    component: 'ProgramPage',
    public: true,
    program_order,
    date: `${dateStr}T00:00:00.000Z`,
    schedule,
    talent: [] as string[],
    social: [] as string[],
    logo: '1.png',
    audio_source: `${id}.mp3`,
    menu: '',
    markdownfile: `src/content/${lang}/${id}.md`,
    content: body,
  };
};
