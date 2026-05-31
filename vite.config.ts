import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { multiLanguageBuild } from "./src/plugins/multiLanguageBuild";
import { editorDevServerPlugin } from './scripts/editorDevServerPlugin';

const hasSupabaseEnv = (envVars: Record<string, string>) =>
  Boolean(envVars.VITE_SUPABASE_URL?.trim() && envVars.VITE_SUPABASE_ANON_KEY?.trim());

export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, process.cwd(), '');
  const supabaseReady = hasSupabaseEnv(envVars);

  const radioStatusUrl = (envVars.VITE_RADIO_STATUS_URL || '').trim().replace(/^["']|["']$/g, '');
  const server: import('vite').UserConfig['server'] = {
    host: envVars.VITE_DEV_SERVER_HOST || '127.0.0.1',
    port: 8080,
    // ngrok: subdominio UUID nuevo en cada sesión → permitir todos los hosts en dev.
    ...(mode === 'development' ? { allowedHosts: true } : {}),
  };

  if (mode === 'development' && radioStatusUrl) {
    try {
      const parsed = new URL(radioStatusUrl);
      server.proxy = {
        '/api/radio/status': {
          target: `${parsed.protocol}//${parsed.host}`,
          changeOrigin: true,
          secure: true,
          rewrite: () => `${parsed.pathname}${parsed.search}`,
        },
      };
    } catch {
      // Mantener URL directa si VITE_RADIO_STATUS_URL no es válida
    }
  }

  return {
    server,
    plugins: [
      react(),
      multiLanguageBuild({
        langDir: path.resolve(__dirname, 'src/lang'),
        defaultLang: 'en',
      }),
      editorDevServerPlugin({
        enabled: mode === 'development' && supabaseReady,
        supabase: {
          url: envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL,
          anonKey: envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY,
          serviceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
        },
        archive: {
          accessKey: envVars.IA_ACCESS_KEY,
          secretKey: envVars.IA_SECRET_KEY,
          collection: envVars.IA_COLLECTION,
        },
        translation: {
          apiKey: envVars.TRANSLATE_API_KEY || envVars.GOOGLE_TRANSLATE_API_KEY,
          endpointUrl: envVars.TRANSLATE_API_URL || envVars.GOOGLE_TRANSLATE_API_URL,
          monthlyCharLimit: Number(envVars.EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT || 500000),
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  };
});
