const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineFormat(text) {
  // Render inline code spans from Markdown backticks.
  return text.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      parts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      parts.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      closeLists();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeLists();
      parts.push('<hr/>');
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^(\d+)\.\s+(.*)$/);

    if (h3 || h2 || h1) {
      closeLists();
      const content = escapeHtml((h3 || h2 || h1)[1]);
      if (h1) parts.push(`<h1>${inlineFormat(content)}</h1>`);
      if (h2) parts.push(`<h2>${inlineFormat(content)}</h2>`);
      if (h3) parts.push(`<h3>${inlineFormat(content)}</h3>`);
      continue;
    }

    if (ul) {
      if (!inUl) {
        if (inOl) {
          parts.push('</ol>');
          inOl = false;
        }
        parts.push('<ul>');
        inUl = true;
      }
      parts.push(`<li>${inlineFormat(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    if (ol) {
      if (!inOl) {
        if (inUl) {
          parts.push('</ul>');
          inUl = false;
        }
        parts.push('<ol>');
        inOl = true;
      }
      parts.push(`<li>${inlineFormat(escapeHtml(ol[2]))}</li>`);
      continue;
    }

    closeLists();
    parts.push(`<p>${inlineFormat(escapeHtml(line))}</p>`);
  }

  closeLists();
  return parts.join('\n');
}

async function main() {
  const inputPath = process.argv[2] || 'c:/Users/Owner/Desktop/FixTray-Shop-Participation-Agreement.md';
  const outputPath = process.argv[3] || 'c:/Users/Owner/Desktop/FixTray-Shop-Participation-Agreement-Updated.pdf';

  const markdown = fs.readFileSync(inputPath, 'utf8');
  const htmlBody = markdownToHtml(markdown);

  const title = path.basename(inputPath, path.extname(inputPath));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: Letter; margin: 0.65in; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #111827;
      line-height: 1.42;
      font-size: 11pt;
    }
    h1, h2, h3 {
      font-family: "Palatino Linotype", Palatino, Garamond, serif;
      color: #0f172a;
      margin-top: 1.1em;
      margin-bottom: 0.4em;
      page-break-after: avoid;
    }
    h1 { font-size: 20pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; }
    h2 { font-size: 14pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    h3 { font-size: 12pt; }
    p { margin: 0.28em 0; }
    ul, ol { margin: 0.3em 0 0.5em 1.2em; }
    li { margin: 0.15em 0; }
    code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 0.92em;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 0 4px;
      border-radius: 3px;
    }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 18px 0;
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.65in', right: '0.65in', bottom: '0.65in', left: '0.65in' }
  });
  await browser.close();

  console.log(`PDF generated: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
