import { z } from 'zod';

export const languageSchema = z.enum(['es', 'pt', 'en']);
export type EditorLanguage = z.infer<typeof languageSchema>;

export const contentKindSchema = z.enum(['program', 'event']);
export type ContentKind = z.infer<typeof contentKindSchema>;

const localizedTextSchema = z
  .object({
    es: z.string(),
    pt: z.string().optional(),
    en: z.string().optional(),
  })
  .transform((value) => ({
    es: value.es,
    pt: value.pt ?? '',
    en: value.en ?? '',
  }));

export const contentEntrySchema = z.object({
  language: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  id: z.string().min(1),
  component: z.string().min(1),
  /** `program` = archivo público; `event` = solo editores en archivos, metadata para el calendario. */
  content_kind: contentKindSchema.optional(),
  public: z.boolean().optional(),
  program_order: z.number().optional(),
  date: z.string().optional(),
  schedule: z.string().optional(),
  schedule_meta: z
    .object({
      weekday: z.number().int().min(1).max(7),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().min(1),
      durationMin: z.number().int().positive().optional(),
    })
    .optional(),
  talent: z.array(z.string()).optional(),
  social: z.array(z.string()).optional(),
  logo: z.string().optional(),
  audio_source: z.string().optional(),
  menu: z.string().optional(),
  menu_position: z.number().optional(),
  markdownfile: z.string().optional(),
  content: z.string().optional(),
});

export const contentIndexSchema = z.record(
  z.string(),
  z.object({
    es: contentEntrySchema.optional(),
    pt: contentEntrySchema.optional(),
    en: contentEntrySchema.optional(),
  })
);

export const episodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.string().min(1),
  description: z.string().optional(),
  audioUrl: z.string().min(1),
  archiveIdentifier: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  tracklist: z.array(z.string()).optional(),
  coverImage: z.string().optional(),
});

export const programEpisodesSchema = z.object({
  programId: z.string().min(1),
  episodes: z.array(episodeSchema),
});

export const programEpisodesTrashSchema = programEpisodesSchema;

const trilingualSchema = localizedTextSchema;

export const aboutCreditGroupSchema = z.object({
  id: z.string().min(1),
  title: trilingualSchema,
  people: z.array(z.string()),
});

export const aboutCreditsSchema = z.object({
  heading: trilingualSchema,
  subheading: trilingualSchema,
  collaboratorsHeading: trilingualSchema.default({
    es: 'Red de colaboradores',
    pt: 'Rede de colaboradores',
    en: 'Collaborator network',
  }),
  groups: z.array(aboutCreditGroupSchema),
  collaborators: z.array(z.string()),
  collaboratorsNote: trilingualSchema,
});

export type AboutCreditsData = z.infer<typeof aboutCreditsSchema>;

export const defaultAboutCredits: AboutCreditsData = {
  heading: { es: 'Créditos', pt: 'Créditos', en: 'Credits' },
  subheading: {
    es: 'Producción real / radionudista',
    pt: 'Produção real / radionudista',
    en: 'Real production / radionudista',
  },
  collaboratorsHeading: {
    es: 'Red de colaboradores',
    pt: 'Rede de colaboradores',
    en: 'Collaborator network',
  },
  groups: [
    {
      id: 'musical_curation',
      title: { es: 'Curaduría musical', pt: 'Curadoria musical', en: 'Music curation' },
      people: ['Gustavo Perez (@gustavodesnudo)', 'Lucho Milazzo (@luchomy)'],
    },
    {
      id: 'web_design',
      title: { es: 'Diseño web', pt: 'Design web', en: 'Web design' },
      people: [
        'Felipe Laboren (@felipelabo)',
        'Lemys Lopez (@lemysKaman)',
        'Benjamin Ochoa (@benjaminochoag)',
        'Nicolas Fuentes (@ArcAegis)',
      ],
    },
    {
      id: 'audio_design',
      title: { es: 'Diseño de audio', pt: 'Design de áudio', en: 'Audio design' },
      people: ['Manuel Aular (@hardlinemanu)'],
    },
    {
      id: 'visuals',
      title: { es: 'Visuales', pt: 'Visuais', en: 'Visuals' },
      people: ['Andres Ramírez (@Gachapon3000)'],
    },
    {
      id: 'voiceovers',
      title: { es: 'Voiceovers', pt: 'Voiceovers', en: 'Voiceovers' },
      people: [
        'Diana Hung',
        'Gustavo Perez',
        'Lucho Milazzo',
        'Samira Moura',
        'Gabriel Rodrigues',
        'Laura Sepulveda',
        'Adrian Sanchez',
        'Melanie Chab',
        'Eloisa Colina',
        'Julio Quintana',
        'Paola Agrafojo',
        'Ismelda Armada',
        'Alberto Flores Solano',
        'Karlis Chirino',
      ],
    },
  ],
  collaborators: [
    'Wendys Rodriguez',
    'Daniel Salas',
    'Leonardo Dávila',
    'Carlos Eduardo Parra',
    'Nelson Parra',
    'David Jimenez',
    'Daniel Villamizar',
    'Edgar Cabrera',
    'Clared Navarro',
    'Felipe Laboren',
    'lemysKaman',
    'Carlos Pinto',
    'Isaac Varzim',
    'Elio Araujo',
    'Carlos Ignacio Hernández',
  ],
  collaboratorsNote: {
    es: 'Esta radio suena gracias a esta red viva de colaboradores alrededor del mundo.',
    pt: 'Este rádio soa graças a esta rede viva de colaboradores ao redor do mundo.',
    en: 'This radio sounds thanks to this living network of collaborators around the world.',
  },
};

export const editorialSchema = z.object({
  home: z.object({
    manifestKicker: localizedTextSchema.optional(),
    manifestTitle: localizedTextSchema,
    manifestSubtitle: localizedTextSchema,
    joinPanelCopy: localizedTextSchema,
    /** Imagen de fondo del hero cuando no hay programa en vivo (ruta /public o URL de Storage). */
    defaultHeroImageUrl: z.string().optional(),
  }).transform((home) => ({
    ...home,
    manifestKicker: home.manifestKicker ?? { es: '', pt: '', en: '' },
    defaultHeroImageUrl: home.defaultHeroImageUrl ?? '',
  })),
  about: z
    .object({
      heroTitle: localizedTextSchema,
      lead: localizedTextSchema,
      paragraph1: localizedTextSchema,
      paragraph2: localizedTextSchema,
      credits: aboutCreditsSchema.optional(),
    })
    .transform((about) => ({
      ...about,
      credits: about.credits ?? defaultAboutCredits,
    })),
  contact: z.object({
    pageTitle: localizedTextSchema,
    pageSubtitle: localizedTextSchema,
  }),
});

export type ContentIndexData = z.infer<typeof contentIndexSchema>;
export type ProgramEpisodesData = z.infer<typeof programEpisodesSchema>;
export type ProgramEpisodesTrashData = z.infer<typeof programEpisodesTrashSchema>;
export type EditorialData = z.infer<typeof editorialSchema>;
