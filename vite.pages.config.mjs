import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Reuse the HRIS views as a browser app; GitHub Pages has no Worker/SSR runtime.
export default defineConfig({
 root:fileURLToPath(new URL('./pages-app',import.meta.url)),
 base:'/ais-hris/',
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 plugins:[react()],
 build:{outDir:fileURLToPath(new URL('./dist-pages',import.meta.url)),emptyOutDir:true},
});
