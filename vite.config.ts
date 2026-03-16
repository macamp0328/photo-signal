import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    plugins: [react()],
    server: {
      host: true,
      port: parseInt(process.env.PORT ?? '', 10) || 5173,
    },
  };
});
