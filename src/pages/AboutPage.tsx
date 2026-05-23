import React from 'react';
import { Plus } from 'lucide-react';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { useTranslation } from 'react-i18next';
import { defaultAboutCredits, type AboutCreditsData } from '../editor/contracts';
import { useEditorialText } from '../hooks/useEditorContent';
import { useOptionalEditor } from '../contexts/EditorContext';
import EditableStringListItem from '../components/EditableStringListItem';
import InlineEditableText from '../components/InlineEditableText';

const AboutPage: React.FC = () => {
  const { i18n } = useTranslation();
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const lang = i18n.language === 'pt' ? 'pt' : i18n.language === 'en' ? 'en' : 'es';
  const credits: AboutCreditsData = editorial?.about.credits ?? defaultAboutCredits;

  React.useEffect(() => {
    const webDesignGroup = credits.groups.find((group) => group.id === 'web_design');
    // #region agent log
    fetch('http://127.0.0.1:7560/ingest/5ccebaa5-f0e4-4ced-b6b7-3a14221eeaa6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '153f83' },
      body: JSON.stringify({
        sessionId: '153f83',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'src/pages/AboutPage.tsx:20',
        message: 'About credits source and web_design values',
        data: {
          lang,
          hasEditorial: Boolean(editorial),
          hasEditorContext: Boolean(editor),
          source: editorial?.about.credits ? 'editorial' : 'defaultAboutCredits',
          webDesignCount: webDesignGroup?.people.length ?? 0,
          webDesignPeople: webDesignGroup?.people ?? [],
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [credits, editorial, editor, lang]);

  const commitCredits = (next: AboutCreditsData) => {
    if (editor?.enabled) void editor.commitAboutCredits(next);
  };

  const patchGroupPeople = (groupId: string, people: string[]) => {
    commitCredits({
      ...credits,
      groups: credits.groups.map((g) => (g.id === groupId ? { ...g, people } : g)),
    });
  };

  const patchCollaborators = (collaborators: string[]) => {
    commitCredits({ ...credits, collaborators });
  };

  return (
    <div className="relative bg-[#000000] text-[#e2e2e2] font-['Inter'] selection:bg-white selection:text-[#1a1c1c] min-h-screen pt-24 pb-12">
      <div className="fixed inset-0 bg-[#0a0a0b] z-[1] pointer-events-none" />

      <main className="relative z-10 pt-4 px-6 overflow-hidden min-h-screen max-w-[1720px] mx-auto">
        {/* Editorial Content Container */}
        <article className="max-w-[44rem] mx-auto relative z-10">
          
          {/* Hero Title */}
          <header className="mb-12">
            {editor?.enabled ? (
              <InlineEditableText
                as="h1"
                size="lg"
                className="mb-8"
                textClassName={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white`}
                value={editorial?.about.heroTitle[lang] ?? 'NOSOTRXS'}
                language={lang}
                localizedValues={editorial?.about.heroTitle}
                onCommit={(next) => editor.commitEditorialField('about', 'heroTitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('about', 'heroTitle', values)
                }
              />
            ) : (
              <h1 className={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white mb-8`}>
                {editorial?.about.heroTitle[lang] ?? 'NOSOTRXS'}
              </h1>
            )}
            <div className="h-px w-full bg-[#474747]/30"></div>
          </header>

          {/* Main Copy */}
          <section className="space-y-12">
            {editor?.enabled ? (
              <div className="text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white">
                <InlineEditableText
                  multiline
                  textClassName="text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white"
                  value={
                    editorial?.about.lead[lang] ??
                    'radionudista es un club social experimental diseñado para la transmisión de frecuencias no convencionales y el encuentro de estéticas periféricas.'
                  }
                  language={lang}
                  localizedValues={editorial?.about.lead}
                  onCommit={(next) => editor.commitEditorialField('about', 'lead', lang, next)}
                  onCommitLocalized={(values) =>
                    editor.commitEditorialFieldLocalized('about', 'lead', values)
                  }
                />
              </div>
            ) : (
              <p className="text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white">
                {editorial?.about.lead[lang] ??
                  'radionudista es un club social experimental diseñado para la transmisión de frecuencias no convencionales y el encuentro de estéticas periféricas.'}
              </p>
            )}
            <div className="text-lg space-y-8 text-[#c6c6c6] font-['Inter'] leading-relaxed">
              {editor?.enabled ? (
                <>
                  <div>
                    <InlineEditableText
                      multiline
                      textClassName="text-lg text-[#c6c6c6] font-['Inter'] leading-relaxed"
                      value={
                        editorial?.about.paragraph1[lang] ??
                        'Nacimos en la grieta entre lo digital y lo físico, operando como una plataforma de difusión para artistas, selectores y pensadores que habitan los márgenes del mainstream cultural. Nuestra señal no es solo sonido; es un manifiesto visual y táctil que se manifiesta en cada píxel y cada onda sonora.'
                      }
                      language={lang}
                      localizedValues={editorial?.about.paragraph1}
                      onCommit={(next) => editor.commitEditorialField('about', 'paragraph1', lang, next)}
                      onCommitLocalized={(values) =>
                        editor.commitEditorialFieldLocalized('about', 'paragraph1', values)
                      }
                    />
                  </div>
                  <div>
                    <InlineEditableText
                      multiline
                      textClassName="text-lg text-[#c6c6c6] font-['Inter'] leading-relaxed"
                      value={
                        editorial?.about.paragraph2[lang] ??
                        'Entendemos la radio como un espacio de resistencia y juego. No buscamos la perfección del estudio clínico, sino la verdad de la interferencia, el glitch y la conexión humana cruda. Radionudista es, ante todo, un refugio para la curiosidad sin filtros.'
                      }
                      language={lang}
                      localizedValues={editorial?.about.paragraph2}
                      onCommit={(next) => editor.commitEditorialField('about', 'paragraph2', lang, next)}
                      onCommitLocalized={(values) =>
                        editor.commitEditorialFieldLocalized('about', 'paragraph2', values)
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <p>
                    {editorial?.about.paragraph1[lang] ??
                      'Nacimos en la grieta entre lo digital y lo físico, operando como una plataforma de difusión para artistas, selectores y pensadores que habitan los márgenes del mainstream cultural. Nuestra señal no es solo sonido; es un manifiesto visual y táctil que se manifiesta en cada píxel y cada onda sonora.'}
                  </p>
                  <p>
                    {editorial?.about.paragraph2[lang] ??
                      'Entendemos la radio como un espacio de resistencia y juego. No buscamos la perfección del estudio clínico, sino la verdad de la interferencia, el glitch y la conexión humana cruda. Radionudista es, ante todo, un refugio para la curiosidad sin filtros.'}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Image Block (Asymmetric) */}
          <div className="my-24 -mx-8 md:-mx-24">
            <div className="relative aspect-video bg-[#1b1b1b] overflow-hidden">
              <img alt="Experimental Radio Setup" className="w-full h-full object-cover grayscale contrast-150 mix-blend-lighten" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEr4z-2MHqPb78Hn1HLFItyTGXm3GjnrPHbgx767_8tPNsDiDqcFh03T2mllfwl13mTJ0lNU8J60LAk6ekMrDeBsCuxr_yq0FosYpwZ7ceR6-bd9-sYbLWtRHdPOu6mq78lK_0mtIHM1XkUPa60sPES3k-NNQui5UYAd9CqrtvZcokKS6Ii_UyqMyNyfuA_XtylZqaCLwWbi2t7e7y_EMGoqH-YboXybsFk_knop1dfnrWt66Lcpx1EdlPpQjT6bwpUH0YLd-EQEQY"/>
              {/* RadioNudista-style playful player embedded on the radio display */}
              <div className="absolute left-[16.7%] top-[22.6%] w-[48.3%] h-[29.2%] border border-black/40 bg-white/30 backdrop-blur-[0.5px] overflow-hidden">
                <div className="h-5 bg-black/58 border-b border-black/35 flex items-center justify-between px-2">
                  <span className="font-['Space_Grotesk'] font-semibold text-[8.2px] tracking-widest uppercase text-white/95">Signal Explorer</span>
                  <span className="font-['Space_Grotesk'] font-semibold text-[7.5px] uppercase tracking-wide text-white/90">No Juzgamos</span>
                </div>
                <div className="h-[calc(100%-20px)] p-2 flex flex-col justify-between text-[9px] leading-tight text-black/90">
                  <div className="space-y-1">
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Modo: frecuencia carnal</p>
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Canal: perversión estéreo</p>
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Estado: saturando el sistema</p>
                  </div>
                  <div className="space-y-2 mt-1.5">
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Sintonia: Piel con piel (128kbps)</p>
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Antena: Erecta y captando.</p>
                    <p className="font-['Space_Grotesk'] font-semibold uppercase tracking-wide">Filtro: Eliminación de Inhibiciones</p>
                  </div>
                  <div className="flex items-center gap-2">
                  </div>
                </div>
                <div className="absolute inset-x-0 top-[52%] h-[1px] bg-black/30" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-[#919191]">
                SIGNAL_SOURCE // TRANSMISSION_001
              </div>
            </div>
          </div>

          {/* Credits Section with production data */}
          <footer className="mt-24 pt-12 border-t border-[#474747]/20">
            <div className="flex items-end justify-between gap-6 mb-10">
              {editor?.enabled ? (
                <>
                  <InlineEditableText
                    as="h2"
                    size="lg"
                    textClassName="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold uppercase tracking-tight text-white"
                    value={credits.heading[lang]}
                    language={lang}
                    localizedValues={credits.heading}
                    onCommit={(next) =>
                      commitCredits({ ...credits, heading: { ...credits.heading, [lang]: next } })
                    }
                    onCommitLocalized={(values) =>
                      commitCredits({ ...credits, heading: values })
                    }
                  />
                  <InlineEditableText
                    as="p"
                    size="sm"
                    className="ml-auto max-w-[min(100%,20rem)] text-right"
                    textClassName="font-['Space_Grotesk'] text-[10px] tracking-[0.18em] uppercase text-[#919191]"
                    value={credits.subheading[lang]}
                    language={lang}
                    localizedValues={credits.subheading}
                    onCommit={(next) =>
                      commitCredits({ ...credits, subheading: { ...credits.subheading, [lang]: next } })
                    }
                    onCommitLocalized={(values) =>
                      commitCredits({ ...credits, subheading: values })
                    }
                  />
                </>
              ) : (
                <>
                  <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">
                    {credits.heading[lang]}
                  </h2>
                  <p className="font-['Space_Grotesk'] text-[10px] tracking-[0.18em] uppercase text-[#919191]">
                    {credits.subheading[lang]}
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {credits.groups.map((group) => (
                <article
                  key={group.id}
                  className={`bg-[#1b1b1b]/70 border border-white/10 p-5 md:p-6 backdrop-blur-sm ${
                    group.id === 'voiceovers' ? 'md:col-span-2' : ''
                  }`}
                >
                  {editor?.enabled ? (
                    <InlineEditableText
                      as="h3"
                      size="sm"
                      className="mb-4"
                      textClassName="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191]"
                      value={group.title[lang]}
                      language={lang}
                      localizedValues={group.title}
                      onCommit={(next) =>
                        commitCredits({
                          ...credits,
                          groups: credits.groups.map((g) =>
                            g.id === group.id ? { ...g, title: { ...g.title, [lang]: next } } : g
                          ),
                        })
                      }
                      onCommitLocalized={(values) =>
                        commitCredits({
                          ...credits,
                          groups: credits.groups.map((g) =>
                            g.id === group.id ? { ...g, title: values } : g
                          ),
                        })
                      }
                    />
                  ) : (
                    <h3 className="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191] mb-4">
                      {group.title[lang]}
                    </h3>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {group.people.map((person, idx) =>
                      editor?.enabled ? (
                        <EditableStringListItem
                          key={`${group.id}-${idx}`}
                          value={person}
                          chipClassName="border-white/15 bg-black/30"
                          textClassName="text-sm md:text-[15px] text-white"
                          onCommit={(next) => {
                            const people = [...group.people];
                            people[idx] = next;
                            patchGroupPeople(group.id, people);
                            return Promise.resolve();
                          }}
                          onRemove={() => {
                            patchGroupPeople(
                              group.id,
                              group.people.filter((_, i) => i !== idx)
                            );
                            return Promise.resolve();
                          }}
                        />
                      ) : (
                        <span
                          key={`${group.id}-${idx}`}
                          className="px-2.5 py-1 text-sm md:text-[15px] text-white border border-white/15 bg-black/30"
                        >
                          {person}
                        </span>
                      )
                    )}
                    {editor?.enabled ? (
                      <button
                        type="button"
                        onClick={() =>
                          patchGroupPeople(group.id, [...group.people, 'Nuevo nombre'])
                        }
                        className="inline-flex items-center gap-1 border border-dashed border-white/25 px-2.5 py-1 text-xs uppercase tracking-wider text-[#919191] hover:border-white/40 hover:text-white"
                      >
                        <Plus size={14} strokeWidth={2} />
                        Añadir
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <section className="mt-10 border border-white/10 bg-black/30 p-6 md:p-7">
              {editor?.enabled ? (
                <InlineEditableText
                  as="h3"
                  size="sm"
                  className="mb-4"
                  textClassName="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191]"
                  value={credits.collaboratorsHeading[lang]}
                  language={lang}
                  localizedValues={credits.collaboratorsHeading}
                  onCommit={(next) =>
                    commitCredits({
                      ...credits,
                      collaboratorsHeading: { ...credits.collaboratorsHeading, [lang]: next },
                    })
                  }
                  onCommitLocalized={(values) =>
                    commitCredits({
                      ...credits,
                      collaboratorsHeading: values,
                    })
                  }
                />
              ) : (
                <h3 className="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191] mb-4">
                  {credits.collaboratorsHeading[lang]}
                </h3>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {credits.collaborators.map((name, idx) =>
                  editor?.enabled ? (
                    <EditableStringListItem
                      key={`collab-${idx}`}
                      value={name}
                      chipClassName="border-white/10 bg-[#1b1b1b]/70"
                      textClassName="text-sm md:text-[15px] text-[#e2e2e2]"
                      onCommit={(next) => {
                        const collaborators = [...credits.collaborators];
                        collaborators[idx] = next;
                        patchCollaborators(collaborators);
                        return Promise.resolve();
                      }}
                      onRemove={() => {
                        patchCollaborators(credits.collaborators.filter((_, i) => i !== idx));
                        return Promise.resolve();
                      }}
                    />
                  ) : (
                    <span
                      key={`collab-${idx}`}
                      className="px-2.5 py-1 text-sm md:text-[15px] text-[#e2e2e2] border border-white/10 bg-[#1b1b1b]/70"
                    >
                      {name}
                    </span>
                  )
                )}
                {editor?.enabled ? (
                  <button
                    type="button"
                    onClick={() => patchCollaborators([...credits.collaborators, 'Nuevo nombre'])}
                    className="inline-flex items-center gap-1 border border-dashed border-white/25 px-2.5 py-1 text-xs uppercase tracking-wider text-[#919191] hover:border-white/40 hover:text-white"
                  >
                    <Plus size={14} strokeWidth={2} />
                    Añadir
                  </button>
                ) : null}
              </div>
              {editor?.enabled ? (
                <div className="mt-5 text-base leading-relaxed text-[#c6c6c6]">
                  <InlineEditableText
                    multiline
                    textClassName="text-base leading-relaxed text-[#c6c6c6]"
                    value={credits.collaboratorsNote[lang]}
                    language={lang}
                    localizedValues={credits.collaboratorsNote}
                    onCommit={(next) =>
                      commitCredits({
                        ...credits,
                        collaboratorsNote: { ...credits.collaboratorsNote, [lang]: next },
                      })
                    }
                    onCommitLocalized={(values) =>
                      commitCredits({
                        ...credits,
                        collaboratorsNote: values,
                      })
                    }
                  />
                </div>
              ) : (
                <p className="mt-5 text-base leading-relaxed text-[#c6c6c6]">
                  {credits.collaboratorsNote[lang]}
                </p>
              )}
            </section>
          </footer>
        </article>

        {/* Decorative Floating Elements */}
        <div className="fixed right-10 top-1/2 -translate-y-1/2 hidden xl:block mix-blend-difference opacity-20 pointer-events-none z-[2]">
          <span className="font-['Space_Grotesk'] font-bold text-[20rem] leading-none select-none">RN</span>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
