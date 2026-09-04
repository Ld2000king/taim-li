/*
 * Wraps the app files in src/ into standalone HTML documents at the repo root,
 * so they work as plain pages on GitHub Pages.
 *
 * The files in src/ are authored as Claude Artifacts: they start with <title>,
 * meta and font <link>s, then one <style> block, then markup and scripts — with
 * no <html>/<head>/<body> of their own (the Artifact host supplies those).
 * This script supplies them instead.
 *
 *   node build.mjs
 */
import fs from 'node:fs';

const PAGES = [
    { src: 'src/bis-live-customer.html', out: 'customer.html' },
    { src: 'src/bis-business-app.html',  out: 'business.html' },
    { src: 'src/bis-concept.html',       out: 'concept.html'  }
];

const RESET = `<style>
  html, body { margin: 0; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>`;

function standalone(srcPath) {
    const raw = fs.readFileSync(srcPath, 'utf8');
    const mark = '</style>';
    const i = raw.indexOf(mark);
    if (i < 0) throw new Error(`${srcPath}: no </style> found`);

    const head = raw.slice(0, i + mark.length).trim();   // title + meta + font links + stylesheet
    const body = raw.slice(i + mark.length).trim();      // markup + scripts

    // The reset goes BEFORE the app's own stylesheet so the app always wins.
    return `<!doctype html>
<html lang="he">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#FCFBF9" />
${RESET}
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

for (const p of PAGES) {
    fs.writeFileSync(p.out, standalone(p.src));
    console.log(`built ${p.out}  <-  ${p.src}`);
}
