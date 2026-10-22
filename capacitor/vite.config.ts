import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  plugins:[react()],
  resolve:{dedupe:['react','react-dom'],alias:{
    react:fileURLToPath(new URL('./node_modules/react',import.meta.url)),
    'react-dom':fileURLToPath(new URL('./node_modules/react-dom',import.meta.url)),
  }},
  server:{port:5174,fs:{allow:['..']}},
  build:{outDir:'dist',emptyOutDir:true,sourcemap:false},
});
