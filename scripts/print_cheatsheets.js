'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const AUTHOR = 'Rohit Ghumare';
const SITE = 'aiengineeringfromscratch.com/cheatsheets';

function footerTemplate(copy) {
  const cell = 'font-family: monospace; font-size: 6.5px; letter-spacing: 0.12em; text-transform: uppercase;';
  return `<div style="width: 100%; margin: 0 0.42in; display: flex; justify-content: space-between; align-items: baseline; ${cell} color: #666;">`
    + `<span style="color: #2f49e0;">${SITE}</span><span>${copy}</span><span style="font-size: 8px; color: #111;" class="pageNumber"></span></div>`;
}

async function printPdf(input, output, chrome) {
  const puppeteer = require('puppeteer-core');
  const { PDFDocument } = require('pdf-lib');
  const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(input)).href, { waitUntil: 'networkidle0', timeout: 300000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-math') === 'ready', { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    const meta = await page.evaluate(() => ({
      title: document.title,
      subject: (document.querySelector('meta[name="subject"]') || {}).content || '',
      keywords: (document.querySelector('meta[name="keywords"]') || {}).content || '',
      copy: (document.querySelector('.cs-cover-copy') || {}).textContent || '',
    }));
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(meta.copy),
    });
    const doc = await PDFDocument.load(pdf);
    doc.setTitle(meta.title);
    doc.setAuthor(AUTHOR);
    doc.setSubject(meta.subject);
    doc.setKeywords(meta.keywords.split(',').map(item => item.trim()).filter(Boolean));
    doc.setCreator('site/build-cheatsheets.js');
    fs.writeFileSync(output, await doc.save());
    return doc.getPageCount();
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  const chrome = process.env.CHROME_PATH;
  if (!input || !output || !chrome) {
    console.error('usage: CHROME_PATH=<chrome> node scripts/print_cheatsheets.js <print.html> <output.pdf>');
    process.exitCode = 2;
  } else {
    printPdf(input, output, chrome).then(pages => console.log(`Wrote ${output} (${pages} pages)`), error => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}

module.exports = { printPdf, footerTemplate };
