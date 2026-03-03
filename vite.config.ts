import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to sync runtime fixture assets into public for production builds
function syncRuntimeFixtureAssetsPlugin() {
  const plugin: Plugin = {
    name: 'sync-runtime-fixture-assets',
    apply: 'build',
    async buildStart() {
      try {
        // Sync runtime image fixtures used by integration/visual tests
        const publicAssetsDir = path.resolve(__dirname, 'public/assets');
        const testImagesSrc = path.resolve(__dirname, 'assets/test-images');

        const { mkdir, copyFile, readdir, stat, access } = fs.promises;
        const startTime = Date.now();

        // Helper to check if file needs to be copied (by mtime and size)
        async function needsCopy(src: string, dest: string): Promise<boolean> {
          try {
            const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
            return srcStat.size !== destStat.size || srcStat.mtimeMs !== destStat.mtimeMs;
          } catch {
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

        let copiedCount = 0;
        let skippedCount = 0;
        if (!(await exists(testImagesSrc))) {
          this.warn('⚠ assets/test-images is missing; image fixture paths may fail at runtime');
        } else {
          const destinationDir = path.join(publicAssetsDir, 'test-images');
          await mkdir(destinationDir, { recursive: true });

          const imageFiles = (await readdir(testImagesSrc)).filter((fileName) =>
            /\.(jpg|jpeg|png)$/i.test(fileName)
          );

          if (imageFiles.length === 0) {
            this.warn('⚠ assets/test-images exists but has no image files');
          }

          await Promise.all(
            imageFiles.map(async (fileName) => {
              const src = path.join(testImagesSrc, fileName);
              const dest = path.join(destinationDir, fileName);
              if (await needsCopy(src, dest)) {
                await copyFile(src, dest);
                copiedCount++;
              } else {
                skippedCount++;
              }
            })
          );
        }

        const elapsed = Date.now() - startTime;
        console.log(
          `✓ Runtime fixture assets processed: ${copiedCount} copied, ${skippedCount} skipped (${elapsed}ms)`
        );
      } catch (error) {
        this.error(
          `Failed to sync runtime fixture assets: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  };

  return plugin;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    plugins: [react(), syncRuntimeFixtureAssetsPlugin()],
    server: {
      host: true,
      port: 5173,
    },
  };
});
