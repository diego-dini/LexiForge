import * as esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { Glob } from "bun";

const SRC_FRONTEND = "./src/frontend";
const DIST_DIR = "./public";
const TSCONFIG_FRONTEND = path.join(SRC_FRONTEND, "tsconfig.json");

const isWatch = process.argv.includes("--watch");
const isProd = process.argv.includes("--prod");

const IGNORE_FILES = ["tsconfig.json", "package.json", "**/*.ts", "**/*.tsx", "**/*.d.ts"];

const deleteIgnoredFiles = async (targetDir) => {
  if (!existsSync(targetDir)) return;

  for (const pattern of IGNORE_FILES) {
    const glob = new Glob(pattern);

    for await (const file of glob.scan(targetDir)) {
      const fullPath = path.join(targetDir, file);
      try {
        rmSync(fullPath, { force: true });
      } catch (err) {
        console.error(`\x1b[31m[error]\x1b[0m Failed to purge ${file}:`, err);
      }
    }
  }
};

const postBuildCleanup = {
  name: "post-build-cleanup",
  setup(build) {
    build.onEnd(async () => {
      setTimeout(async () => {
        await deleteIgnoredFiles(DIST_DIR);
      }, 150);
    });
  },
};

const config = {
  entryPoints: [path.join(SRC_FRONTEND, "app.ts")],
  bundle: true,
  outdir: DIST_DIR,
  tsconfig: TSCONFIG_FRONTEND,
  platform: "browser",
  format: "esm",
  target: "esnext",
  minify: isProd,
  sourcemap: !isProd,
  legalComments: isProd ? "none" : "inline",
  treeShaking: true,
  define: {
    "process.env.NODE_ENV": isProd ? '"production"' : '"development"',
  },
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: {
        from: [`${SRC_FRONTEND}/**/*`],
        to: [DIST_DIR],
      },
    }),
    postBuildCleanup,
  ],
};

try {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("[esbuild] Watch mode active...");
  } else {
    console.log(isProd ? "[esbuild] Running production build..." : "[esbuild] Running standard build...");
    await esbuild.build(config);

    setTimeout(async () => {
      await deleteIgnoredFiles(DIST_DIR);
      console.log("[esbuild] Build finished!");
    }, 300);
  }
} catch (error) {
  console.error("[esbuild] Critical error:", error);
  process.exit(1);
}
