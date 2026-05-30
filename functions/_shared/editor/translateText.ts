export const translateTextWithProviders = async (options: {
  text: string;
  source: string;
  targets: Array<'en' | 'pt'>;
  apiKey: string;
  endpointCandidates: string[];
}): Promise<Record<'en' | 'pt', string>> => {
  const { text, source, targets, apiKey, endpointCandidates } = options;
  const translated: Record<'en' | 'pt', string> = { en: text, pt: text };

  const translateWithFallback = async (target: 'en' | 'pt'): Promise<string> => {
    const errors: string[] = [];

    for (const endpointUrl of endpointCandidates) {
      const isGoogleEndpoint = /translation\.googleapis\.com/i.test(endpointUrl);
      if (isGoogleEndpoint && !apiKey) {
        errors.push(`${endpointUrl}: missing API key`);
        continue;
      }

      try {
        const requestUrl = isGoogleEndpoint
          ? `${endpointUrl}?key=${encodeURIComponent(apiKey)}`
          : endpointUrl;
        const requestBody = isGoogleEndpoint
          ? { q: text, source, target, format: 'text' }
          : { q: text, source, target, format: 'text', api_key: apiKey || undefined };

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`${endpointUrl} -> (${response.status}) ${errText.slice(0, 160)}`);
          continue;
        }

        const payload = (await response.json()) as {
          data?: { translations?: Array<{ translatedText?: string }> };
          translatedText?: string;
        };
        const translatedText = isGoogleEndpoint
          ? payload.data?.translations?.[0]?.translatedText
          : payload.translatedText;

        if (!translatedText || typeof translatedText !== 'string') {
          errors.push(`${endpointUrl} -> invalid response payload`);
          continue;
        }

        return translatedText;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown fetch error';
        errors.push(`${endpointUrl} -> ${message}`);
      }
    }

    try {
      const googlePublicUrl =
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}` +
        `&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
      const googleResponse = await fetch(googlePublicUrl);
      if (!googleResponse.ok) {
        const errText = await googleResponse.text();
        errors.push(`googleapis public -> (${googleResponse.status}) ${errText.slice(0, 160)}`);
      } else {
        const payload = (await googleResponse.json()) as unknown;
        if (Array.isArray(payload) && Array.isArray(payload[0])) {
          const chunks = payload[0] as unknown[];
          const translatedText = chunks
            .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] ?? '') : ''))
            .join('')
            .trim();
          if (translatedText) return translatedText;
          errors.push('googleapis public -> empty translated text');
        } else {
          errors.push('googleapis public -> invalid response payload');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown fetch error';
      errors.push(`googleapis public -> ${message}`);
    }

    throw new Error(errors.join(' | '));
  };

  for (const target of targets) {
    translated[target] = await translateWithFallback(target);
  }

  return translated;
};
