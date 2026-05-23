import React from 'react';
import ContactForm from '../components/ContactForm';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import ContactInformation from '../components/ContactInformation';
import FollowUs from '../components/FollowUs';
import { useTranslation } from '../hooks/useTranslation';
import { useEditorialText } from '../hooks/useEditorContent';
import { useOptionalEditor } from '../contexts/EditorContext';
import InlineEditableText from '../components/InlineEditableText';

const ContactPage = () => {
  const { t, i18n } = useTranslation();
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const lang = i18n.language === 'pt' ? 'pt' : i18n.language === 'en' ? 'en' : 'es';

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    // Handle form submission logic here
    console.log('Form submitted:', formData);
    // You can add API call or other submission logic here
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          {editor?.enabled ? (
            <InlineEditableText
              as="h1"
              size="lg"
              align="center"
              className="mb-6"
              textClassName={`${PAGE_SCREEN_TITLE_CLASS} text-white`}
              value={editorial?.contact.pageTitle[lang] ?? t('contact.page-title')}
              language={lang}
              localizedValues={editorial?.contact.pageTitle}
              onCommit={(next) => editor.commitEditorialField('contact', 'pageTitle', lang, next)}
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageTitle', values)
              }
            />
          ) : (
            <h1 className={`${PAGE_SCREEN_TITLE_CLASS} text-white mb-6`}>
              {editorial?.contact.pageTitle[lang] ?? t('contact.page-title')}
            </h1>
          )}
          {editor?.enabled ? (
            <InlineEditableText
              as="div"
              align="center"
              textClassName="text-xl text-gray-300"
              value={editorial?.contact.pageSubtitle[lang] ?? t('contact.page-subtitle')}
              language={lang}
              localizedValues={editorial?.contact.pageSubtitle}
              onCommit={(next) => editor.commitEditorialField('contact', 'pageSubtitle', lang, next)}
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageSubtitle', values)
              }
            />
          ) : (
            <p className="text-xl text-gray-300">
              {editorial?.contact.pageSubtitle[lang] ?? t('contact.page-subtitle')}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form Component */}
          <ContactForm onSubmit={handleFormSubmit} />

          {/* Contact Information and Follow Us Components */}
          <div className="space-y-8">
            <ContactInformation />
            <FollowUs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
