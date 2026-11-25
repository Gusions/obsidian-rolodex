import esbuild from 'esbuild';
const mode = process.argv[2] || 'dev';
const prod = mode === 'production';
await esbuild.build({
  bundle: true, target: 'es2020', logLevel: 'info', treeShaking: true,
  entryPoints: ['src/main.ts'], external: ['obsidian', 'electron'], format: 'cjs', platform: 'browser',
  sourcemap: prod ? false : 'inline', minify: prod, outfile: 'main.js'
});
