import React from 'react';
import ContactForm from '../components/ContactForm';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import ContactInformation from '../components/ContactInformation';
import FollowUs from '../components/FollowUs';
import { useEditorialText } from '../hooks/useEditorContent';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { resolveEditorialText } from '../utils/editorialText';
import { useOptionalEditor } from '../contexts/EditorContext';
import InlineEditableText from '../components/InlineEditableText';

const ContactPage = () => {
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const lang = useRouteLanguage();

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
              value={resolveEditorialText(editorial?.contact.pageTitle, lang)}
              language={lang}
              localizedValues={editorial?.contact.pageTitle}
              onCommit={(next) => editor.commitEditorialField('contact', 'pageTitle', lang, next)}
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageTitle', values)
              }
            />
          ) : (
            <h1 className={`${PAGE_SCREEN_TITLE_CLASS} text-white mb-6`}>
              {resolveEditorialText(editorial?.contact.pageTitle, lang)}
            </h1>
          )}
          {editor?.enabled ? (
            <InlineEditableText
              as="div"
              align="center"
              textClassName="text-xl text-gray-300"
              value={resolveEditorialText(editorial?.contact.pageSubtitle, lang)}
              language={lang}
              localizedValues={editorial?.contact.pageSubtitle}
              onCommit={(next) => editor.commitEditorialField('contact', 'pageSubtitle', lang, next)}
              onCommitLocalized={(values) =>
                editor.commitEditorialFieldLocalized('contact', 'pageSubtitle', values)
              }
            />
          ) : (
            <p className="text-xl text-gray-300">
              {resolveEditorialText(editorial?.contact.pageSubtitle, lang)}
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
