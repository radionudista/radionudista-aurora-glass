import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { multiLanguageBuild } from "./src/plugins/multiLanguageBuild";
import { contentJsonGeneratorPlugin } from './src/plugins/contentJsonGenerator';
import { editorDevServerPlugin } from './scripts/editorDevServerPlugin';
// Removed unused import of env

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const envVars = loadEnv(mode, process.cwd(), '');
  // Ensure supportedLanguages is always an array
  const supportedLanguages = (envVars.VITE_SUPPORTED_LANGUAGES || 'es,pt')
    .split(',')
    .map(l => l.trim())
    .filter(Boolean);

  const editorEnabled = envVars.VITE_EDITOR_ENABLED === 'true';
  const devServerHost = editorEnabled ? '127.0.0.1' : (envVars.VITE_DEV_SERVER_HOST || '127.0.0.1');

  return {
    server: {
      host: devServerHost,
      port: 8080,
    },
    plugins: [
      react(),
      multiLanguageBuild({
        langDir: path.resolve(__dirname, 'src/lang'),
        defaultLang: 'en',
      }),
      contentJsonGeneratorPlugin({
        contentDir: path.resolve(__dirname, 'src/content'),
        outputFile: path.resolve(__dirname, 'src/contentIndex.json'),
        supportedLanguages: Array.isArray(supportedLanguages) ? supportedLanguages : [supportedLanguages],
      }),
      // Plugin to copy contentIndex.json to public/ after build
      {
        name: 'copy-contentIndex-to-public',
        closeBundle: async () => {
          const fs = await import('fs/promises');
          const src = path.resolve(__dirname, 'src/contentIndex.json');
          const dest = path.resolve(__dirname, 'public/contentIndex.json');
          try {
            await fs.copyFile(src, dest);
            console.log('Copied contentIndex.json to public/');
          } catch (err) {
            console.error('Failed to copy contentIndex.json to public/', err);
          }
        }
      },
      editorDevServerPlugin({
        rootDir: __dirname,
        enabled: mode === 'development' && editorEnabled,
        editorToken: envVars.EDITOR_DEV_TOKEN,
        supportedLanguages: Array.isArray(supportedLanguages) ? supportedLanguages : ['es', 'pt'],
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
    // Expose environment variables to the client
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  };
});
