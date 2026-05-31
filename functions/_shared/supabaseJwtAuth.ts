export const readBearerToken = (request: Request): string => {
  const header = request.headers.get('authorization');
  if (!header) return '';
  return header.replace(/^Bearer\s+/i, '').trim();
};

export const jsonResponse = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const assertSupabaseJwtAuthorized = async (
  request: Request,
  env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }
): Promise<Response | null> => {
  const url = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  const token = readBearerToken(request);

  if (!url || !anonKey) {
    return jsonResponse(503, {
      ok: false,
      message: 'Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el servidor.',
    });
  }

  if (!token) {
    return jsonResponse(401, {
      ok: false,
      message: 'Sesión del editor inválida. Volvé a /editor-login.',
    });
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!response.ok) {
    return jsonResponse(401, {
      ok: false,
      message: 'Sesión del editor inválida. Volvé a /editor-login.',
    });
  }

  return null;
};
