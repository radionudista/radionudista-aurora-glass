const SESSION_KEY = 'rn_editor_session';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256(`${salt}${password}`);
}

export async function validatePassword(
  input: string,
  expectedHash: string,
  salt: string
): Promise<boolean> {
  if (!expectedHash || !salt) return false;
  const hash = await hashPassword(input, salt);
  if (hash.length !== expectedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}

function generateSessionToken(): string {
  return crypto.randomUUID();
}

export const editorAuth = {
  hasSession: (): boolean => {
    try {
      return typeof window !== 'undefined' && !!window.localStorage.getItem(SESSION_KEY);
    } catch {
      return false;
    }
  },

  createSession: (): string => {
    const token = generateSessionToken();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  },

  clearSession: (): void => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY);
    }
  },
};
