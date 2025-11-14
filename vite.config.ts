import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to copy test assets to public directory for runtime access
function copyTestAssetsPlugin() {
  return {
    name: 'copy-test-assets',
    buildStart() {
      try {
        // Copy test assets to public/assets during build
        const publicAssetsDir = path.resolve(__dirname, 'public/assets');
        const testDataSrc = path.resolve(__dirname, 'assets/test-data');
        const testAudioSrc = path.resolve(__dirname, 'assets/test-audio');
        const testImagesSrc = path.resolve(__dirname, 'assets/test-images');

        // Create directories
        fs.mkdirSync(path.join(publicAssetsDir, 'test-data'), { recursive: true });
        fs.mkdirSync(path.join(publicAssetsDir, 'test-audio'), { recursive: true });
        fs.mkdirSync(path.join(publicAssetsDir, 'test-images'), { recursive: true });

        // Copy test data if it exists
        const concertsJsonPath = path.join(testDataSrc, 'concerts.json');
        if (fs.existsSync(concertsJsonPath)) {
          fs.copyFileSync(concertsJsonPath, path.join(publicAssetsDir, 'test-data/concerts.json'));
        } else {
          console.warn('⚠ concerts.json not found in test-data directory');
        }

        // Copy test audio if directory exists
        if (fs.existsSync(testAudioSrc)) {
          const audioFiles = fs.readdirSync(testAudioSrc).filter((f) => f.endsWith('.mp3'));
          if (audioFiles.length > 0) {
            audioFiles.forEach((file) => {
              fs.copyFileSync(
                path.join(testAudioSrc, file),
                path.join(publicAssetsDir, 'test-audio', file)
              );
            });
          } else {
            console.warn('⚠ No MP3 files found in test-audio directory');
          }
        } else {
          console.warn('⚠ Test audio directory not found, skipping');
        }

        // Copy test images if directory exists
        if (fs.existsSync(testImagesSrc)) {
          const imageFiles = fs.readdirSync(testImagesSrc).filter((f) => f.endsWith('.jpg'));
          if (imageFiles.length > 0) {
            imageFiles.forEach((file) => {
              fs.copyFileSync(
                path.join(testImagesSrc, file),
                path.join(publicAssetsDir, 'test-images', file)
              );
            });
          } else {
            console.warn('⚠ No JPG files found in test-images directory');
          }
        } else {
          console.warn('⚠ Test images directory not found, skipping');
        }

        console.log('✓ Test assets copied to public/assets/');
      } catch (error) {
        console.error('❌ Failed to copy test assets:', error);
        console.error(
          'Ensure assets/test-data, assets/test-audio, and assets/test-images directories exist and are accessible.'
        );
        throw error;
      }
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
