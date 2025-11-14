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
    async buildStart() {
      try {
        // Copy test assets to public/assets during build
        const publicAssetsDir = path.resolve(__dirname, 'public/assets');
        const testDataSrc = path.resolve(__dirname, 'assets/test-data');
        const testAudioSrc = path.resolve(__dirname, 'assets/test-audio');
        const testImagesSrc = path.resolve(__dirname, 'assets/test-images');

        const { mkdir, copyFile, readdir, stat, access } = fs.promises;
        const startTime = Date.now();

        // Helper to check if file needs to be copied (by mtime and size)
        async function needsCopy(src: string, dest: string): Promise<boolean> {
          try {
            const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
            return srcStat.size !== destStat.size || srcStat.mtimeMs !== destStat.mtimeMs;
          } catch (err) {
            // If dest doesn't exist, copy
            return true;
          }
        }

        // Helper to check if path exists
        async function exists(path: string): Promise<boolean> {
          try {
            await access(path);
            return true;
          } catch {
            return false;
          }
        }

        // Create directories
        await Promise.all([
          mkdir(path.join(publicAssetsDir, 'test-data'), { recursive: true }),
          mkdir(path.join(publicAssetsDir, 'test-audio'), { recursive: true }),
          mkdir(path.join(publicAssetsDir, 'test-images'), { recursive: true }),
        ]);

        let copiedCount = 0;
        let skippedCount = 0;

        // Copy test data if it exists
        const concertsJsonSrc = path.join(testDataSrc, 'concerts.json');
        const concertsJsonDest = path.join(publicAssetsDir, 'test-data/concerts.json');
        if (await exists(concertsJsonSrc)) {
          if (await needsCopy(concertsJsonSrc, concertsJsonDest)) {
            await copyFile(concertsJsonSrc, concertsJsonDest);
            copiedCount++;
          } else {
            skippedCount++;
          }
        } else {
          console.warn('⚠ concerts.json not found in test-data directory');
        }

        // Copy test audio if directory exists
        if (await exists(testAudioSrc)) {
          const audioFiles = (await readdir(testAudioSrc)).filter((f) => f.endsWith('.mp3'));
          if (audioFiles.length > 0) {
            await Promise.all(
              audioFiles.map(async (file) => {
                const src = path.join(testAudioSrc, file);
                const dest = path.join(publicAssetsDir, 'test-audio', file);
                if (await needsCopy(src, dest)) {
                  await copyFile(src, dest);
                  copiedCount++;
                } else {
                  skippedCount++;
                }
              })
            );
          } else {
            console.warn('⚠ No MP3 files found in test-audio directory');
          }
        } else {
          console.warn('⚠ Test audio directory not found, skipping');
        }

        // Copy test images if directory exists
        if (await exists(testImagesSrc)) {
          const imageFiles = (await readdir(testImagesSrc)).filter((f) => f.endsWith('.jpg'));
          if (imageFiles.length > 0) {
            await Promise.all(
              imageFiles.map(async (file) => {
                const src = path.join(testImagesSrc, file);
                const dest = path.join(publicAssetsDir, 'test-images', file);
                if (await needsCopy(src, dest)) {
                  await copyFile(src, dest);
                  copiedCount++;
                } else {
                  skippedCount++;
                }
              })
            );
          } else {
            console.warn('⚠ No JPG files found in test-images directory');
          }
        } else {
          console.warn('⚠ Test images directory not found, skipping');
        }

        const elapsed = Date.now() - startTime;
        console.log(
          `✓ Test assets processed: ${copiedCount} copied, ${skippedCount} skipped (${elapsed}ms)`
        );
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
