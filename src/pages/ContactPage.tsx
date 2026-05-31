import React from 'react';
import { useTranslation } from 'react-i18next';
import ContactForm from '../components/ContactForm';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { useEditorialText } from '../hooks/useEditorContent';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { resolveEditorialText } from '../utils/editorialText';
import { useOptionalEditor } from '../contexts/EditorContext';
import InlineEditableText from '../components/InlineEditableText';

const ContactPage = () => {
  const { t } = useTranslation();
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const lang = useRouteLanguage();

  const pageTitle =
    resolveEditorialText(editorial?.contact.pageTitle, lang) || t('contact.page-title');
  const pageSubtitle =
    resolveEditorialText(editorial?.contact.pageSubtitle, lang) || t('contact.page-subtitle');

  return (
    <section className="relative min-h-full bg-black px-3 pb-16 pt-24 text-white md:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[#0a0a0b]" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <header className="mb-10">
          {editor?.enabled ? (
            <InlineEditableText
              as="h1"
              size="lg"
              textClassName={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white break-words`}
              value={pageTitle}
              language={lang}
              localizedValues={editorial?.contact.pageTitle}
              onCommit={(next) => editor.commitEditorialField('contact', 'pageTitle', lang, next)}
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageTitle', values)
              }
            />
          ) : (
            <h1
              className={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.9] text-white break-words`}
            >
              {pageTitle}
            </h1>
          )}
          {editor?.enabled ? (
            <InlineEditableText
              as="div"
              className="mt-4"
              textClassName="font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/60"
              value={pageSubtitle}
              language={lang}
              localizedValues={editorial?.contact.pageSubtitle}
              onCommit={(next) =>
                editor.commitEditorialField('contact', 'pageSubtitle', lang, next)
              }
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageSubtitle', values)
              }
            />
          ) : (
            <p className="mt-4 font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/60">
              {pageSubtitle}
            </p>
          )}
          <div className="mt-8 h-px w-full bg-white/15" aria-hidden />
        </header>

        <ContactForm />
      </div>
    </section>
  );
};

export default ContactPage;
