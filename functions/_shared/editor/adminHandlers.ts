import type { EditorAuthProfile, SupabaseAuthEnv } from '../editorAuth';
import type { EditorHandlerResult } from './handlers';

const fail = (message: string, status = 400): EditorHandlerResult => ({
  status,
  body: { ok: false, message },
});

const ok = (body: Record<string, unknown>): EditorHandlerResult => ({
  status: 200,
  body: { ok: true, ...body },
});

const adminHeaders = (serviceKey: string) => ({
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  'Content-Type': 'application/json',
});

const listAuthUsers = async (url: string, serviceKey: string): Promise<Map<string, string>> => {
  const emailById = new Map<string, string>();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const response = await fetch(
      `${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: adminHeaders(serviceKey) }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'No se pudo listar usuarios Auth.');
    }
    const payload = (await response.json()) as {
      users?: Array<{ id?: string; email?: string }>;
    };
    const users = payload.users ?? [];
    for (const user of users) {
      if (user.id) emailById.set(user.id, user.email ?? '');
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return emailById;
};

export const handleAdminRoute = async (options: {
  subpath: string;
  body: Record<string, unknown>;
  profile: EditorAuthProfile;
  env: SupabaseAuthEnv;
}): Promise<EditorHandlerResult> => {
  const url = (options.env.SUPABASE_URL || '').trim();
  const serviceKey = (options.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) {
    return fail('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.', 503);
  }

  if (options.profile.role !== 'admin') {
    return fail('Solo administradores pueden realizar esta acción.', 403);
  }

  const { subpath, body } = options;

  if (subpath === 'admin/list-users') {
    try {
      const [profilesRes, emailById] = await Promise.all([
        fetch(`${url}/rest/v1/editor_profiles?select=user_id,role,program_id,disabled_at,created_at,updated_at&order=created_at.asc`, {
          headers: adminHeaders(serviceKey),
        }),
        listAuthUsers(url, serviceKey),
      ]);

      if (!profilesRes.ok) {
        const text = await profilesRes.text();
        return fail(text || 'No se pudo leer editor_profiles.', 502);
      }

      const profiles = (await profilesRes.json()) as Array<Record<string, unknown>>;
      const users = (Array.isArray(profiles) ? profiles : []).map((row) => ({
        userId: String(row.user_id || ''),
        email: emailById.get(String(row.user_id || '')) ?? '',
        role: String(row.role || ''),
        programId: row.program_id == null ? null : String(row.program_id),
        disabledAt: row.disabled_at == null ? null : String(row.disabled_at),
        createdAt: row.created_at == null ? null : String(row.created_at),
        updatedAt: row.updated_at == null ? null : String(row.updated_at),
      }));

      return ok({ message: 'Usuarios cargados.', users });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al listar usuarios.', 502);
    }
  }

  if (subpath === 'admin/create-user') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '').trim() as 'admin' | 'editor';
    const programId = body.programId == null ? null : String(body.programId).trim();

    if (!email || !password) return fail('Email y contraseña son obligatorios.');
    if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.');
    if (role !== 'admin' && role !== 'editor') return fail('Rol inválido.');
    if (role === 'editor' && !programId) return fail('Asigná un programa al editor.');
    if (role === 'admin' && programId) return fail('Los administradores no llevan programa asignado.');

    try {
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders(serviceKey),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        return fail(text || 'No se pudo crear el usuario.', 502);
      }

      const created = (await createRes.json()) as { id?: string };
      const userId = created.id ? String(created.id) : '';
      if (!userId) return fail('Respuesta inválida al crear usuario.', 502);

      const profileRes = await fetch(`${url}/rest/v1/editor_profiles`, {
        method: 'POST',
        headers: { ...adminHeaders(serviceKey), Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          role,
          program_id: role === 'editor' ? programId : null,
        }),
      });

      if (!profileRes.ok) {
        await fetch(`${url}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: adminHeaders(serviceKey),
        });
        const text = await profileRes.text();
        return fail(text || 'Usuario creado pero falló el perfil.', 502);
      }

      return ok({
        message: 'Usuario creado.',
        user: { userId, email, role, programId: role === 'editor' ? programId : null },
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al crear usuario.', 502);
    }
  }

  if (subpath === 'admin/update-user') {
    const userId = String(body.userId || '').trim();
    const role = body.role == null ? undefined : (String(body.role).trim() as 'admin' | 'editor');
    const programId =
      body.programId === undefined
        ? undefined
        : body.programId == null
          ? null
          : String(body.programId).trim();
    const disabled = body.disabled;

    if (!userId) return fail('userId es obligatorio.');
    if (role !== undefined && role !== 'admin' && role !== 'editor') return fail('Rol inválido.');
    if (role === 'editor' && programId === '') return fail('Asigná un programa al editor.');
    if (role === 'admin' && programId) return fail('Los administradores no llevan programa asignado.');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role !== undefined) patch.role = role;
    if (programId !== undefined) patch.program_id = programId;
    if (disabled === true) patch.disabled_at = new Date().toISOString();
    if (disabled === false) patch.disabled_at = null;

    if (role === 'admin') patch.program_id = null;
    if (role === 'editor' && programId) patch.program_id = programId;

    try {
      const updateRes = await fetch(
        `${url}/rest/v1/editor_profiles?user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: { ...adminHeaders(serviceKey), Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        }
      );

      if (!updateRes.ok) {
        const text = await updateRes.text();
        return fail(text || 'No se pudo actualizar el usuario.', 502);
      }

      if (typeof body.password === 'string' && body.password.trim().length >= 8) {
        const pwdRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: adminHeaders(serviceKey),
          body: JSON.stringify({ password: String(body.password) }),
        });
        if (!pwdRes.ok) {
          const text = await pwdRes.text();
          return fail(text || 'Perfil actualizado pero falló cambiar contraseña.', 502);
        }
      }

      return ok({ message: 'Usuario actualizado.' });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al actualizar usuario.', 502);
    }
  }

  return fail('Endpoint admin no encontrado.', 404);
};
