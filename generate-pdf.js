#!/usr/bin/env node
/**
 * Career-Ops PDF Generator
 * Converts a filled HTML resume to ATS-ready PDF via Puppeteer.
 * HTML file is deleted after PDF generation — only the PDF is kept.
 *
 * Usage:
 *   node generate-pdf.js <input.html> <output.pdf>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ATS normalization: convert Unicode artifacts to ASCII-safe equivalents
function normalizeForATS(html) {
  const replacements = [
    [/—/g, '-'],   // em-dash
    [/–/g, '-'],   // en-dash
    [/“/g, '"'],   // curly double open
    [/”/g, '"'],   // curly double close
    [/‘/g, "'"],   // curly single open
    [/’/g, "'"],   // curly single close
    [/…/g, '...'], // ellipsis
    [/​/g, ''],    // zero-width space
    [/ /g, ' '],   // non-breaking space
  ];
  let count = 0;
  for (const [pattern, replacement] of replacements) {
    const before = html;
    html = html.replace(pattern, replacement);
    if (html !== before) count++;
  }
  if (count > 0) console.log(`ATS normalization: ${count} replacement type(s) applied`);
  return html;
}

async function generatePDF(htmlPath, pdfPath) {
  const scriptDir = path.dirname(path.resolve(process.argv[1]));
  const absoluteHtml = path.isAbsolute(htmlPath) ? htmlPath : path.resolve(scriptDir, htmlPath);
  const absolutePdf  = path.isAbsolute(pdfPath)  ? pdfPath  : path.resolve(scriptDir, pdfPath);

  if (!fs.existsSync(absoluteHtml)) {
    console.error(`ERROR: HTML file not found: ${absoluteHtml}`);
    process.exit(1);
  }

  const outDir = path.dirname(absolutePdf);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Generating PDF...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  try {
    const page = await browser.newPage();

    // High-DPI rendering for crisp text
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

    let htmlContent = fs.readFileSync(absoluteHtml, 'utf8');
    htmlContent = normalizeForATS(htmlContent);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Wait for fonts and layout to fully settle
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path: absolutePdf,
      format: 'A4',
      margin: { top: '13mm', right: '12mm', bottom: '13mm', left: '12mm' },
      printBackground: true,
      preferCSSPageSize: false,
      tagged: true   // embeds semantic tags — improves ATS text extraction
    });

    const sizeKB = (fs.statSync(absolutePdf).size / 1024).toFixed(1);
    console.log(`PDF ready: ${absolutePdf} (${sizeKB} KB)`);

  } finally {
    await browser.close();
    // Delete HTML — only the PDF is kept
    if (fs.existsSync(absoluteHtml)) {
      fs.unlinkSync(absoluteHtml);
    }
  }
}

const htmlPath = process.argv[2];
const pdfPath  = process.argv[3];

if (!htmlPath || !pdfPath) {
  console.error('Usage: node generate-pdf.js <input.html> <output.pdf>');
  process.exit(1);
}

generatePDF(htmlPath, pdfPath).catch((err) => {
  console.error('PDF generation failed:', err.message);
  process.exit(1);
});
