import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';



const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';



export const isSupabaseConfigured = () => Boolean(url && anonKey);

/** Editor disponible cuando Supabase está configurado (mismo criterio en local y prod). */
export const isEditorAvailable = () => isSupabaseConfigured();



let client: SupabaseClient | null = null;



export const getSupabaseClient = (): SupabaseClient | null => {

  if (!isSupabaseConfigured()) return null;

  if (!client) {

    client = createClient(url, anonKey, {

      auth: { persistSession: true, autoRefreshToken: true },

    });

  }

  return client;

};



export const getSupabaseSession = async (): Promise<Session | null> => {

  const supabase = getSupabaseClient();

  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();

  return data.session;

};



export const subscribeAuth = (callback: (session: Session | null) => void): (() => void) => {

  const supabase = getSupabaseClient();

  if (!supabase) return () => undefined;



  const {

    data: { subscription },

  } = supabase.auth.onAuthStateChange((_event, session) => {

    callback(session);

  });



  return () => subscription.unsubscribe();

};



export const getSupabaseAccessToken = async (): Promise<string | null> => {

  const session = await getSupabaseSession();

  return session?.access_token ?? null;

};

