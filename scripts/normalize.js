const fs = require('fs');
const deals = JSON.parse(fs.readFileSync('data/esma_sts_deals.json', 'utf8'));

// Normalize verifier names
function normVerifier(v) {
  if (!v) return '';
  const l = v.toLowerCase().replace(/[",]/g, '').trim();
  if (l.includes('sts verif') || l.includes('sts verf') || l === 'svi') return 'SVI (STS Verification International)';
  if (l.includes('prime collateralised') || l.includes('pcs')) return 'PCS (Prime Collateralised Securities)';
  if (l === 'y') return ''; // data error
  return v.trim();
}

deals.forEach(d => {
  d.verifier_normalized = normVerifier(d.verifier);
});

fs.writeFileSync('data/esma_sts_deals.json', JSON.stringify(deals, null, 2));

// Verify
const v = {};
deals.forEach(d => { const k = d.verifier_normalized || '(none)'; v[k] = (v[k] || 0) + 1; });
console.log('Normalized verifiers:');
Object.entries(v).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => console.log(`  ${k}: ${c}`));
