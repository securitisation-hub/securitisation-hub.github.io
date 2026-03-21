/**
 * Fetch detail pages for active TSI transactions to get documents
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

const BASE = 'https://www.true-sale-international.de';
const data = JSON.parse(fs.readFileSync('data/tsi_transactions.json', 'utf8'));
const active = data.filter(d => d.detail_url);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function parseDetailPage(html) {
  const docs = [];
  
  // Find PDF links
  const pdfRegex = /href="(\/fileadmin\/[^"]+\.pdf)"/g;
  let m;
  while ((m = pdfRegex.exec(html)) !== null) {
    const url = BASE + m[1];
    // Extract a readable name from the path
    const parts = m[1].split('/');
    let name = decodeURIComponent(parts[parts.length - 1]).replace(/\.pdf$/i, '').replace(/_/g, ' ');
    docs.push({ name, url });
  }
  
  // Extract status
  let status = 'Active';
  const statusMatch = html.match(/Status:\s*<\/[^>]+>\s*<[^>]+>([^<]+)/i);
  if (statusMatch) status = statusMatch[1].trim();
  
  return { documents: docs, status };
}

async function main() {
  console.log(`Fetching details for ${active.length} transactions...`);
  
  for (let i = 0; i < active.length; i++) {
    const tx = active[i];
    try {
      console.log(`[${i+1}/${active.length}] ${tx.name}`);
      const html = await fetchUrl(tx.detail_url);
      const { documents, status } = parseDetailPage(html);
      
      // Find and update in main data array
      const idx = data.findIndex(d => d.tsi_slug === tx.tsi_slug);
      if (idx !== -1) {
        data[idx].documents = documents;
        data[idx].status = status;
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }
  
  fs.writeFileSync('data/tsi_transactions.json', JSON.stringify(data, null, 2));
  console.log(`\nDone. Saved with documents.`);
  
  // Summary
  const withDocs = data.filter(d => d.documents && d.documents.length > 0);
  console.log(`Transactions with documents: ${withDocs.length}`);
  if (withDocs.length > 0) {
    console.log('Sample docs:', JSON.stringify(withDocs[0].documents.slice(0, 2)));
  }
}

main().catch(console.error);
