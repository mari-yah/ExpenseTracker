// Bundles src/js/app.js (and everything it imports) plus src/styles.css
// into a single dist/index.html. Netlify runs this automatically on every
// deploy (see netlify.toml's build command) — dist/ is never committed to
// git, it's regenerated fresh each time.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/js/app.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    write: false
  });
  const appJs = result.outputFiles[0].text;

  const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8').trim();

  if (/<\/script/i.test(appJs)) {
    throw new Error('Bundled JS contains a literal </script> sequence — needs escaping before embedding.');
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600;700&display=swap">
<title>Household Ledger</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<div id="toast-root"></div>
<div id="modal-root"></div>
<script>
${appJs}
</script>
</body>
</html>
`;

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  console.log('dist/index.html written:', html.length, 'bytes (app JS:', appJs.length, 'bytes, CSS:', css.length, 'bytes)');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
