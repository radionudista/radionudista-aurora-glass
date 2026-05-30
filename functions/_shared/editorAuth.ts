const readEditorToken = (request: Request): string => {
  const header = request.headers.get('x-editor-token') ?? request.headers.get('authorization');
  if (!header) return '';
  return header.replace(/^Bearer\s+/i, '').trim();
};

const safeCompare = (actual: string, expected: string): boolean => {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < actual.length; i += 1) {
    result |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
};

export const assertEditorAuthorized = (request: Request, expectedHash: string): Response | null => {
  if (!expectedHash) {
    return jsonResponse(503, { ok: false, message: 'EDITOR_PASSWORD_HASH no configurado en el servidor.' });
  }
  if (!safeCompare(readEditorToken(request), expectedHash)) {
    return jsonResponse(401, {
      ok: false,
      message: 'Sesión del editor inválida. Volvé a /editor-login.',
    });
  }
  return null;
};

export const jsonResponse = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
