const readUsage = async (options: {
  supabaseUrl: string;
  serviceKey: string;
  month: string;
}): Promise<number> => {
  const { supabaseUrl, serviceKey, month } = options;
  const url = `${supabaseUrl}/rest/v1/editor_translate_usage?month=eq.${encodeURIComponent(month)}&select=used_chars`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) return 0;
  const rows = (await response.json()) as Array<{ used_chars?: number }>;
  return Number(rows[0]?.used_chars || 0);
};

const writeUsage = async (options: {
  supabaseUrl: string;
  serviceKey: string;
  month: string;
  usedChars: number;
  monthlyLimit: number;
}): Promise<void> => {
  const { supabaseUrl, serviceKey, month, usedChars, monthlyLimit } = options;
  const response = await fetch(`${supabaseUrl}/rest/v1/editor_translate_usage`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ month, used_chars: usedChars, monthly_limit: monthlyLimit }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo guardar uso de traducción: ${text.slice(0, 200)}`);
  }
};

export const createTranslateUsageStore = (env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}) => {
  const supabaseUrl = (env.SUPABASE_URL || '').trim();
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  return {
    async readTranslateUsage(month: string): Promise<number> {
      if (!supabaseUrl || !serviceKey) return 0;
      return readUsage({ supabaseUrl, serviceKey, month });
    },
    async writeTranslateUsage(month: string, usedChars: number, monthlyLimit: number): Promise<void> {
      if (!supabaseUrl || !serviceKey) return;
      await writeUsage({ supabaseUrl, serviceKey, month, usedChars, monthlyLimit });
    },
  };
};
