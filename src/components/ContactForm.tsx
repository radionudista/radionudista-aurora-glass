import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { JOIN_PROGRAM_EMAIL } from '../constants/contactInfo';

export type SubmissionType =
  | 'one-off-live'
  | 'monthly-residency'
  | 'outsiders-prerecorded';

export interface ShowProposalFormData {
  submissionType: SubmissionType | '';
  dateRange: string;
  fullName: string;
  artistName: string;
  email: string;
  presentation: string;
  musicGenre: string;
  links: string;
}

interface ContactFormProps {
  onSubmit?: (data: ShowProposalFormData) => void | Promise<void>;
  className?: string;
}

const INITIAL_FORM: ShowProposalFormData = {
  submissionType: '',
  dateRange: '',
  fullName: '',
  artistName: '',
  email: '',
  presentation: '',
  musicGenre: '',
  links: '',
};

const SUBMISSION_OPTIONS: SubmissionType[] = [
  'one-off-live',
  'monthly-residency',
  'outsiders-prerecorded',
];

const MAX_PRESENTATION_WORDS = 300;

const countWords = (text: string): number =>
  text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

const LABEL_CLASS =
  "block font-['Space_Grotesk'] text-sm font-bold uppercase tracking-[0.12em] text-white";
const HINT_CLASS = "mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.1em] text-white/50";
const INPUT_CLASS =
  "mt-4 w-full border border-white/20 bg-white/10 px-4 py-3 font-['Space_Grotesk'] text-sm text-white placeholder:text-white/40 focus:bg-black/55 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/15";
const ERROR_CLASS = "mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.1em] text-rose-300";
const REQUIRED_MARK = <span className="text-rose-300" aria-hidden> *</span>;

const FormCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border border-white/15 bg-black/40 px-5 py-5 backdrop-blur-sm md:px-6 md:py-6">
    {children}
  </div>
);

const ContactForm: React.FC<ContactFormProps> = ({ onSubmit, className = '' }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ShowProposalFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ShowProposalFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presentationWordCount = countWords(formData.presentation);

  const setField = <K extends keyof ShowProposalFormData>(
    key: K,
    value: ShowProposalFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof ShowProposalFormData, string>> = {};
    if (!formData.submissionType) {
      next.submissionType = t('contact.form-error-required');
    }
    if (!formData.fullName.trim()) {
      next.fullName = t('contact.form-error-required');
    }
    if (!formData.artistName.trim()) {
      next.artistName = t('contact.form-error-required');
    }
    if (!formData.email.trim()) {
      next.email = t('contact.form-error-required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      next.email = t('contact.form-error-email');
    }
    if (!formData.presentation.trim()) {
      next.presentation = t('contact.form-error-required');
    } else if (presentationWordCount > MAX_PRESENTATION_WORDS) {
      next.presentation = t('contact.form-error-max-words', { count: MAX_PRESENTATION_WORDS });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildMailBody = (data: ShowProposalFormData): string => {
    const typeLabel = data.submissionType
      ? t(`contact.form-submission-${data.submissionType}`)
      : '—';
    return [
      t('contact.form-mail-intro'),
      '',
      `${t('contact.form-submission-label')}: ${typeLabel}`,
      `${t('contact.form-date-label')}: ${data.dateRange.trim() || '—'}`,
      `${t('contact.form-full-name-label')}: ${data.fullName.trim()}`,
      `${t('contact.form-artist-name-label')}: ${data.artistName.trim()}`,
      `${t('contact.form-email-label')}: ${data.email.trim()}`,
      '',
      `${t('contact.form-presentation-label')}:`,
      data.presentation.trim(),
      '',
      `${t('contact.form-genre-label')}: ${data.musicGenre.trim() || '—'}`,
      `${t('contact.form-links-label')}: ${data.links.trim() || '—'}`,
    ].join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      const subject = encodeURIComponent(t('contact.form-mail-subject'));
      const body = encodeURIComponent(buildMailBody(formData));
      window.location.href = `mailto:${JOIN_PROGRAM_EMAIL}?subject=${subject}&body=${body}`;
      setFormData(INITIAL_FORM);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={`space-y-4 ${className}`}>
      <FormCard>
        <p className="font-['Space_Grotesk'] text-xs uppercase tracking-[0.12em] text-rose-300/90">
          {t('contact.form-required-hint')}
        </p>
      </FormCard>

      <FormCard>
        <fieldset>
          <legend className={LABEL_CLASS}>
            {t('contact.form-submission-label')}
            {REQUIRED_MARK}
          </legend>
          <div className="mt-4 space-y-3">
            {SUBMISSION_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 font-['Space_Grotesk'] text-sm text-white/85 transition hover:text-white"
              >
                <input
                  type="radio"
                  name="submissionType"
                  value={option}
                  checked={formData.submissionType === option}
                  onChange={() => setField('submissionType', option)}
                  className="mt-0.5 h-4 w-4 border-white/30 bg-black accent-white"
                />
                <span>{t(`contact.form-submission-${option}`)}</span>
              </label>
            ))}
          </div>
          {errors.submissionType && (
            <p className={ERROR_CLASS} role="alert">
              {errors.submissionType}
            </p>
          )}
        </fieldset>
      </FormCard>

      <FormCard>
        <label htmlFor="dateRange" className={LABEL_CLASS}>
          {t('contact.form-date-label')}
        </label>
        <p className={HINT_CLASS}>{t('contact.form-date-hint')}</p>
        <input
          id="dateRange"
          type="text"
          name="dateRange"
          value={formData.dateRange}
          onChange={(e) => setField('dateRange', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          className={INPUT_CLASS}
        />
      </FormCard>

      <FormCard>
        <label htmlFor="fullName" className={LABEL_CLASS}>
          {t('contact.form-full-name-label')}
          {REQUIRED_MARK}
        </label>
        <input
          id="fullName"
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={(e) => setField('fullName', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          required
          className={INPUT_CLASS}
        />
        {errors.fullName && (
          <p className={ERROR_CLASS} role="alert">
            {errors.fullName}
          </p>
        )}
      </FormCard>

      <FormCard>
        <label htmlFor="artistName" className={LABEL_CLASS}>
          {t('contact.form-artist-name-label')}
          {REQUIRED_MARK}
        </label>
        <p className={HINT_CLASS}>{t('contact.form-artist-name-hint')}</p>
        <input
          id="artistName"
          type="text"
          name="artistName"
          value={formData.artistName}
          onChange={(e) => setField('artistName', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          required
          className={INPUT_CLASS}
        />
        {errors.artistName && (
          <p className={ERROR_CLASS} role="alert">
            {errors.artistName}
          </p>
        )}
      </FormCard>

      <FormCard>
        <label htmlFor="email" className={LABEL_CLASS}>
          {t('contact.form-email-label')}
          {REQUIRED_MARK}
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={(e) => setField('email', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          required
          className={INPUT_CLASS}
        />
        {errors.email && (
          <p className={ERROR_CLASS} role="alert">
            {errors.email}
          </p>
        )}
      </FormCard>

      <FormCard>
        <label htmlFor="presentation" className={LABEL_CLASS}>
          {t('contact.form-presentation-label')}
          {REQUIRED_MARK}
        </label>
        <p className={HINT_CLASS}>{t('contact.form-presentation-hint')}</p>
        <textarea
          id="presentation"
          name="presentation"
          value={formData.presentation}
          onChange={(e) => setField('presentation', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          rows={5}
          required
          className={`${INPUT_CLASS} resize-y`}
        />
        <p
          className={`mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.1em] ${
            presentationWordCount > MAX_PRESENTATION_WORDS ? 'text-rose-300' : 'text-white/45'
          }`}
        >
          {t('contact.form-word-count', {
            current: presentationWordCount,
            max: MAX_PRESENTATION_WORDS,
          })}
        </p>
        {errors.presentation && (
          <p className={ERROR_CLASS} role="alert">
            {errors.presentation}
          </p>
        )}
      </FormCard>

      <FormCard>
        <label htmlFor="musicGenre" className={LABEL_CLASS}>
          {t('contact.form-genre-label')}
        </label>
        <p className={HINT_CLASS}>{t('contact.form-genre-hint')}</p>
        <input
          id="musicGenre"
          type="text"
          name="musicGenre"
          value={formData.musicGenre}
          onChange={(e) => setField('musicGenre', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          className={INPUT_CLASS}
        />
      </FormCard>

      <FormCard>
        <label htmlFor="links" className={LABEL_CLASS}>
          {t('contact.form-links-label')}
        </label>
        <p className={HINT_CLASS}>{t('contact.form-links-hint')}</p>
        <input
          id="links"
          type="text"
          name="links"
          value={formData.links}
          onChange={(e) => setField('links', e.target.value)}
          placeholder={t('contact.form-answer-placeholder')}
          className={INPUT_CLASS}
        />
      </FormCard>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="border border-white bg-white px-5 py-3 font-['Space_Grotesk'] text-xs font-black uppercase tracking-[0.16em] text-black transition enabled:hover:bg-transparent enabled:hover:text-white disabled:opacity-50"
        >
          {isSubmitting ? t('contact.form-submitting') : t('common.submit')}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="font-['Space_Grotesk'] text-xs uppercase tracking-[0.14em] text-white/55 transition hover:text-white"
        >
          {t('contact.form-clear')}
        </button>
      </div>

      <p className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.12em] text-white/45">
        {t('contact.form-disclaimer')}
      </p>
    </form>
  );
};

export default ContactForm;
