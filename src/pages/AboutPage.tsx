import React from 'react';
import { Plus } from 'lucide-react';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { defaultAboutCredits, type AboutCreditsData } from '../editor/contracts';
import { useEditorialText } from '../hooks/useEditorContent';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { resolveEditorialText } from '../utils/editorialText';
import { useOptionalEditor } from '../contexts/EditorContext';
import EditableStringListItem from '../components/EditableStringListItem';
import InlineEditableText from '../components/InlineEditableText';

const AboutPage: React.FC = () => {
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const lang = useRouteLanguage();
  const credits: AboutCreditsData = editorial?.about.credits ?? defaultAboutCredits;
  const canEditSite = Boolean(editor?.enabled && editor.canEditEditorial());

  const commitCredits = (next: AboutCreditsData) => {
    if (canEditSite) void editor.commitAboutCredits(next);
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
    <div className="relative bg-[#000000] text-[#e2e2e2] font-['Inter'] selection:bg-white selection:text-[#1a1c1c] min-h-full pt-24 pb-12">
      <div className="absolute inset-0 bg-[#0a0a0b] z-0 pointer-events-none" />

      <main className="relative z-10 pt-4 px-6 max-w-[1720px] mx-auto">
        {/* Editorial Content Container */}
        <article className="max-w-[44rem] mx-auto relative z-10">
          
          {/* Hero Title */}
          <header className="mb-12">
            {canEditSite ? (
              <InlineEditableText
                as="h1"
                size="lg"
                className="mb-8"
                textClassName={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white`}
                value={resolveEditorialText(editorial?.about.heroTitle, lang)}
                language={lang}
                localizedValues={editorial?.about.heroTitle}
                onCommit={(next) => editor.commitEditorialField('about', 'heroTitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('about', 'heroTitle', values)
                }
              />
            ) : (
              <h1 className={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white mb-8`}>
                {resolveEditorialText(editorial?.about.heroTitle, lang)}
              </h1>
            )}
            <div className="h-px w-full bg-[#474747]/30"></div>
          </header>

          {/* Main Copy */}
          <section className="space-y-12">
            {canEditSite ? (
              <div className="text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white">
                <InlineEditableText
                  multiline
                  textClassName="text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white"
                  value={resolveEditorialText(editorial?.about.lead, lang)}
                  language={lang}
                  localizedValues={editorial?.about.lead}
                  onCommit={(next) => editor.commitEditorialField('about', 'lead', lang, next)}
                  onCommitLocalized={(values) =>
                    editor.commitEditorialFieldLocalized('about', 'lead', values)
                  }
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-2xl md:text-3xl font-['Space_Grotesk'] font-light leading-snug tracking-tight text-white">
                {resolveEditorialText(editorial?.about.lead, lang)}
              </p>
            )}
            <div className="text-lg space-y-8 text-[#c6c6c6] font-['Inter'] leading-relaxed">
              {canEditSite ? (
                <>
                  <div>
                    <InlineEditableText
                      multiline
                      textClassName="text-lg text-[#c6c6c6] font-['Inter'] leading-relaxed"
                      value={resolveEditorialText(editorial?.about.paragraph1, lang)}
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
                      value={resolveEditorialText(editorial?.about.paragraph2, lang)}
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
                  <p className="whitespace-pre-wrap">
                    {resolveEditorialText(editorial?.about.paragraph1, lang)}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {resolveEditorialText(editorial?.about.paragraph2, lang)}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Credits Section with production data */}
          <footer className="mt-24 pt-12 border-t border-[#474747]/20">
            <div className="flex items-end justify-between gap-6 mb-10">
              {canEditSite ? (
                <>
                  <InlineEditableText
                    as="h2"
                    size="lg"
                    textClassName="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold uppercase tracking-tight text-white"
                    value={resolveEditorialText(credits.heading, lang)}
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
                    value={resolveEditorialText(credits.subheading, lang)}
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
                    {resolveEditorialText(credits.heading, lang)}
                  </h2>
                  <p className="font-['Space_Grotesk'] text-[10px] tracking-[0.18em] uppercase text-[#919191]">
                    {resolveEditorialText(credits.subheading, lang)}
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
                  {canEditSite ? (
                    <InlineEditableText
                      as="h3"
                      size="sm"
                      className="mb-4"
                      textClassName="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191]"
                      value={resolveEditorialText(group.title, lang)}
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
                      {resolveEditorialText(group.title, lang)}
                    </h3>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {group.people.map((person, idx) =>
                      canEditSite ? (
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
                    {canEditSite ? (
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
              {canEditSite ? (
                <InlineEditableText
                  as="h3"
                  size="sm"
                  className="mb-4"
                  textClassName="font-['Space_Grotesk'] text-[11px] tracking-[0.16em] uppercase text-[#919191]"
                  value={resolveEditorialText(credits.collaboratorsHeading, lang)}
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
                  {resolveEditorialText(credits.collaboratorsHeading, lang)}
                </h3>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {credits.collaborators.map((name, idx) =>
                  canEditSite ? (
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
                {canEditSite ? (
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
              {canEditSite ? (
                <div className="mt-5 text-base leading-relaxed text-[#c6c6c6]">
                  <InlineEditableText
                    multiline
                    textClassName="text-base leading-relaxed text-[#c6c6c6]"
                    value={resolveEditorialText(credits.collaboratorsNote, lang)}
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
                <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-[#c6c6c6]">
                  {resolveEditorialText(credits.collaboratorsNote, lang)}
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
