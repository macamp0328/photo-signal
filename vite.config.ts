import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin to copy test assets to public directory for runtime access
function copyTestAssetsPlugin() {
  return {
    name: 'copy-test-assets',
    buildStart() {
      // Copy test assets to public/assets during build
      const publicAssetsDir = path.resolve(__dirname, 'public/assets');
      const testDataSrc = path.resolve(__dirname, 'assets/test-data');
      const testAudioSrc = path.resolve(__dirname, 'assets/test-audio');
      const testImagesSrc = path.resolve(__dirname, 'assets/test-images');

      // Create directories
      fs.mkdirSync(path.join(publicAssetsDir, 'test-data'), { recursive: true });
      fs.mkdirSync(path.join(publicAssetsDir, 'test-audio'), { recursive: true });
      fs.mkdirSync(path.join(publicAssetsDir, 'test-images'), { recursive: true });

      // Copy test data
      fs.copyFileSync(
        path.join(testDataSrc, 'concerts.json'),
        path.join(publicAssetsDir, 'test-data/concerts.json')
      );

      // Copy test audio
      const audioFiles = fs.readdirSync(testAudioSrc).filter((f) => f.endsWith('.mp3'));
      audioFiles.forEach((file) => {
        fs.copyFileSync(
          path.join(testAudioSrc, file),
          path.join(publicAssetsDir, 'test-audio', file)
        );
      });

      // Copy test images
      const imageFiles = fs.readdirSync(testImagesSrc).filter((f) => f.endsWith('.jpg'));
      imageFiles.forEach((file) => {
        fs.copyFileSync(
          path.join(testImagesSrc, file),
          path.join(publicAssetsDir, 'test-images', file)
        );
      });

      console.log('✓ Test assets copied to public/assets/');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyTestAssetsPlugin()],
  server: {
    host: true,
    port: 3000,
  },
});
