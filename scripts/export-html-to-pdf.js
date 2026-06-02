const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const inputHtml = process.argv[2];
  const outputPdf = process.argv[3];

  if (!inputHtml || !outputPdf) {
    console.error('Usage: node scripts/export-html-to-pdf.js <inputHtmlPath> <outputPdfPath>');
    process.exit(1);
  }

  const inPath = path.resolve(inputHtml);
  const outPath = path.resolve(outputPdf);
  const fileUrl = `file:///${inPath.replace(/\\/g, '/')}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.35in', right: '0.35in', bottom: '0.35in', left: '0.35in' }
  });

  await browser.close();
  console.log(`PDF generated: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
