import { useEffect } from 'react';
import { env } from '../config/env';

declare global {
  interface Window {
    gtranslateSettings?: {
      default_language: string;
      languages: string[];
      native_language_names: boolean;
      detect_browser_language: boolean;
      wrapper_selector?: string;
    };
  }
}

const SCRIPT_ID = 'gtranslate-widget-script';
const HIDDEN_WRAPPER_ID = 'gtranslate-hidden-wrapper';

const GTranslateWidget = () => {
  useEffect(() => {
    if (!env.GTRANSLATE_ENABLED) return;

    window.gtranslateSettings = {
      default_language: env.GTRANSLATE_DEFAULT_LANGUAGE,
      languages: env.GTRANSLATE_LANGUAGES,
      native_language_names: true,
      detect_browser_language: true,
      wrapper_selector: `#${HIDDEN_WRAPPER_ID}`,
    };

    let wrapper = document.getElementById(HIDDEN_WRAPPER_ID);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = HIDDEN_WRAPPER_ID;
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wrapper);
    }

    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // DWF script handles automatic browser-language translation without visible switcher.
    script.src = 'https://cdn.gtranslate.net/widgets/latest/dwf.js';
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return null;
};

export default GTranslateWidget;
