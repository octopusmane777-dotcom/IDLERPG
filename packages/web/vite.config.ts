import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@idlerpg\/core\/(.*)/, replacement: path.resolve(__dirname, '../../packages/core/$1') },
      { find: /^@idlerpg\/ui\/(.*)/, replacement: path.resolve(__dirname, '../../packages/ui/$1') },
      { find: '@idlerpg/core', replacement: path.resolve(__dirname, '../../packages/core') },
      { find: '@idlerpg/ui', replacement: path.resolve(__dirname, '../../packages/ui') },
      { find: 'react-native', replacement: 'react-native-web' },
    ],
  },
  server: {
    port: 3000,
    open: true,
  },
});