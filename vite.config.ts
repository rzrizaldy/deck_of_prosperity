import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: { reporter: ['text', 'html'] },
  },
});
