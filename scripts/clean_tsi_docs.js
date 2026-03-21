const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/tsi_transactions.json', 'utf8'));

// Remove generic TSI docs that appear on every page, and deduplicate
const SKIP_PATTERNS = ['TSI_AGBs', 'TSI AGBs', 'datenschutzhinweis', 'privacy'];

data.forEach(tx => {
  if (!tx.documents) return;
  const seen = new Set();
  tx.documents = tx.documents.filter(doc => {
    if (SKIP_PATTERNS.some(p => doc.url.toLowerCase().includes(p.toLowerCase()))) return false;
    if (seen.has(doc.url)) return false;
    // Only keep docs from /Transaktionen/ folder (deal-specific)
    if (!doc.url.includes('/Transaktionen/')) return false;
    seen.add(doc.url);
    return true;
  });
});

fs.writeFileSync('data/tsi_transactions.json', JSON.stringify(data, null, 2));
const withDocs = data.filter(d => d.documents && d.documents.length > 0);
console.log(`Cleaned. ${withDocs.length} transactions with docs.`);
withDocs.forEach(d => console.log(`  ${d.name}: ${d.documents.length} docs`));
