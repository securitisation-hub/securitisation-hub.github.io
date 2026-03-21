/**
 * Merge PCS + TSI into a unified dataset for the combined dashboard.
 * Normalised schema per deal:
 *   id, source, name, originator, asset_class, country, date,
 *   size, redeemed, status, rating_agencies, tranches[], documents[],
 *   detail_url, esma_compliance, certifications[]
 */

const fs = require('fs');

const AC_MAP = {
  // PCS raw -> normalised
  'Residential Mortgages': 'RMBS',
  'Auto Loans & Leases': 'Auto ABS',
  'Consumer Loans': 'Consumer ABS',
  'Credit Facilities to Enterprises': 'SME ABS',
  'Credit Cards': 'Credit Card ABS',
  'Trade Receivables': 'Trade Rec ABS',
  // TSI raw -> normalised
  'Auto loans': 'Auto ABS',
  'Auto leases': 'Auto ABS',
  'Consumer loans': 'Consumer ABS',
  'Commercial leasing / hire purchase': 'Leasing ABS',
  'RMBS': 'RMBS',
  'CLO': 'CLO',
  'CLO/SME': 'CLO',
  'CMBS': 'CMBS'
};

const COUNTRY_MAP = {
  'German': 'Germany',
  'Germany': 'Germany',
  'UK': 'United Kingdom',
  'United Kingdom': 'United Kingdom',
  'Dutch': 'Netherlands',
  'Netherlands': 'Netherlands',
  'Spain': 'Spain',
  'France': 'France',
  'Italy': 'Italy',
  'Finland': 'Finland',
  'Portugal': 'Portugal',
  'Ireland': 'Ireland',
  'Belgium': 'Belgium',
  'Poland': 'Poland',
  'Austria': 'Austria',
  'Luxembourg': 'Luxembourg',
  'Greece': 'Greece',
  'Czech Republic': 'Czech Republic',
  'Lithuania': 'Lithuania',
  'Latvia': 'Latvia',
  'Estonia': 'Estonia',
  'Japan': 'Japan',
  'China': 'China',
  'Australia': 'Australia',
  'Brazil': 'Brazil'
};

function normAC(ac) { return AC_MAP[ac] || ac || 'Other'; }
function normCountry(c) { return COUNTRY_MAP[c] || c || ''; }

// --- Load ---
const pcs = JSON.parse(fs.readFileSync('data/deals_clean.json', 'utf8'));
const tsi = JSON.parse(fs.readFileSync('data/tsi_transactions.json', 'utf8'));

// --- Normalise PCS ---
const pcsDealIds = new Set();
const pcsDeals = pcs.map((d, i) => {
  const id = d.pcs_id || `PCS-${i}`;
  pcsDealIds.add(id);
  return {
    id,
    source: ['PCS'],
    name: d.spv_name || d.pcs_id,
    originator: d.originator || '',
    asset_class: normAC(d.asset_class),
    country: normCountry(d.country),
    date: d.date || '',
    size: d.size || null,
    redeemed: !!d.redeemed,
    status: d.status || (d.redeemed ? 'Redeemed' : 'Active'),
    rating_agencies: d.rating_agencies || [],
    tranches: (d.tranches || []).map(t => ({
      class: t.class || '',
      currency: t.currency || '',
      size: t.size || null,
      isin: t.isin || '',
      bloomberg: t.bloomberg || ''
    })),
    documents: (d.documents || []).map(doc => ({
      name: doc.name,
      url: doc.url
    })),
    detail_url: d.pcs_id ? `https://www.pcsmarket.org/sts/${d.pcs_id}` : null,
    esma_compliance: null,
    certifications: ['PCS STS']
  };
});

// --- Normalise TSI ---
const tsiDeals = tsi.map((d, i) => ({
  id: d.tsi_slug || `TSI-${i}`,
  source: ['TSI'],
  name: d.name,
  originator: d.originator || '',
  asset_class: normAC(d.asset_class),
  country: normCountry(d.jurisdiction),
  date: d.closing_date || '',
  size: null,   // TSI doesn't publish deal sizes
  redeemed: !!d.redeemed,
  status: d.redeemed ? 'Redeemed' : 'Active',
  rating_agencies: [],
  tranches: (d.tranches || []).map(t => ({
    class: '',
    currency: '',
    size: null,
    isin: t.isin || '',
    bloomberg: '',
    name: t.name || ''
  })),
  documents: (d.documents || []).map(doc => ({
    name: doc.name,
    url: doc.url
  })),
  detail_url: d.detail_url || null,
  esma_compliance: d.esma_compliance || null,
  certifications: ['TSI Certified']
}));

// --- Deduplicate: check if any TSI deal overlaps with a PCS deal ---
// We'll keep both but tag overlaps
const unified = [...pcsDeals];

for (const td of tsiDeals) {
  // Check for overlap by originator + similar name
  const nameWords = td.name.toLowerCase().split(/\s+/);
  const existing = unified.find(u => {
    const uWords = u.name.toLowerCase().split(/\s+/);
    const overlap = nameWords.filter(w => w.length > 2 && uWords.includes(w)).length;
    return overlap >= 3 && u.originator.toLowerCase().includes(td.originator.split(' ')[0].toLowerCase());
  });
  
  if (existing) {
    // Merge: add TSI as additional source/certification
    existing.source.push('TSI');
    existing.certifications.push('TSI Certified');
    if (td.detail_url) existing.tsi_url = td.detail_url;
    // Add TSI docs that PCS doesn't have
    const existingUrls = new Set(existing.documents.map(d => d.url));
    td.documents.forEach(doc => {
      if (!existingUrls.has(doc.url)) existing.documents.push(doc);
    });
    // If PCS has no tranches but TSI does, use TSI's
    if (existing.tranches.length === 0 && td.tranches.length > 0) {
      existing.tranches = td.tranches;
    }
  } else {
    unified.push(td);
  }
}

// Sort by date descending
unified.sort((a, b) => {
  const parseD = s => {
    if (!s) return 0;
    const p = s.split('-');
    if (p.length === 3 && p[0].length <= 2) return new Date(+p[2], +p[1]-1, +p[0]).getTime();
    return new Date(s).getTime();
  };
  return parseD(b.date) - parseD(a.date);
});

fs.writeFileSync('data/unified_deals.json', JSON.stringify(unified, null, 2));

// Stats
const sources = {};
unified.forEach(d => d.source.forEach(s => sources[s] = (sources[s]||0) + 1));
const dualSource = unified.filter(d => d.source.length > 1).length;
const totalTranches = unified.reduce((s, d) => s + d.tranches.length, 0);
const totalDocs = unified.reduce((s, d) => s + d.documents.length, 0);
const countries = new Set(unified.map(d => d.country).filter(Boolean));
const originators = new Set(unified.map(d => d.originator).filter(Boolean));

console.log('=== Unified Dataset ===');
console.log(`Total deals: ${unified.length}`);
console.log(`Sources: PCS=${sources.PCS||0}, TSI=${sources.TSI||0}, dual=${dualSource}`);
console.log(`Active: ${unified.filter(d=>!d.redeemed).length} | Redeemed: ${unified.filter(d=>d.redeemed).length}`);
console.log(`Tranches: ${totalTranches} | Documents: ${totalDocs}`);
console.log(`Countries: ${countries.size} | Originators: ${originators.size}`);
console.log(`Asset classes: ${[...new Set(unified.map(d=>d.asset_class))].join(', ')}`);
