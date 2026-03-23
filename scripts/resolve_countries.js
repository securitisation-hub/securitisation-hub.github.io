/**
 * Resolve originator country from LEI using GLEIF API
 * https://api.gleif.org/api/v1/lei-records/{LEI}
 */
const fs = require('fs');
const deals = JSON.parse(fs.readFileSync('data/esma_sts_deals.json', 'utf8'));

const COUNTRY_CODES = {
  'DE':'Germany','ES':'Spain','GB':'United Kingdom','FR':'France','IT':'Italy',
  'NL':'Netherlands','IE':'Ireland','LU':'Luxembourg','BE':'Belgium','PT':'Portugal',
  'FI':'Finland','AT':'Austria','GR':'Greece','PL':'Poland','CZ':'Czechia',
  'SE':'Sweden','DK':'Denmark','NO':'Norway','LT':'Lithuania','LV':'Latvia',
  'EE':'Estonia','HU':'Hungary','RO':'Romania','SK':'Slovakia','SI':'Slovenia',
  'HR':'Croatia','BG':'Bulgaria','CY':'Cyprus','MT':'Malta','IS':'Iceland',
  'LI':'Liechtenstein','JP':'Japan','CN':'China','AU':'Australia','BR':'Brazil',
  'US':'United States','CA':'Canada','AR':'Argentina','KR':'South Korea',
  'CH':'Switzerland','SG':'Singapore','HK':'Hong Kong'
};

async function lookupLEI(lei) {
  try {
    const res = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}`, { 
      signal: AbortSignal.timeout(8000) 
    });
    if (!res.ok) return null;
    const data = await res.json();
    const country = data?.data?.attributes?.entity?.legalAddress?.country;
    return COUNTRY_CODES[country] || country || null;
  } catch {
    return null;
  }
}

// Also infer country from originator name for well-known entities
const NAME_HINTS = [
  [/santander consumer bank ag/i, 'Germany'],
  [/santander consumer finance oy/i, 'Finland'],
  [/volkswagen|vcl/i, 'Germany'],
  [/bmw bank/i, 'Germany'],
  [/bnp paribas/i, 'France'],
  [/bpce|credit agricole|societe generale|natixis/i, 'France'],
  [/intesa|compass banca|mediobanca|iccrea|banca/i, 'Italy'],
  [/barclays/i, 'United Kingdom'],
  [/lloyds|nationwide|virgin money|yorkshire/i, 'United Kingdom'],
  [/rabobank|obvion|ing bank|de volksbank|achmea|aegon/i, 'Netherlands'],
  [/bankinter|caixabank|sabadell|abanca|unicaja|bbva|kutxabank|santander.*españa/i, 'Spain'],
  [/banco bilbao vizcaya/i, 'Spain'],
  [/banco santander/i, 'Spain'],
  [/novo banco|caixa geral/i, 'Portugal'],
  [/kbc bank|belfius/i, 'Belgium'],
  [/erste bank|raiffeisen/i, 'Austria'],
  [/eurobank|piraeus|alpha bank|national bank of greece/i, 'Greece'],
  [/mbank|pkobp|pko bp/i, 'Poland'],
  [/mercedes.?benz bank/i, 'Germany'],
  [/diac|rci banque/i, 'France'],
  [/fca bank/i, 'Italy'],
  [/agos ducato/i, 'Italy'],
  [/ibl istituto/i, 'Italy'],
  [/finance ireland/i, 'Ireland'],
  [/permanent tsb|aib|bank of ireland|dilosk/i, 'Ireland'],
  [/nordea|op |aktia|s-pankki/i, 'Finland'],
  [/danske bank/i, 'Denmark'],
  [/skandinaviska|handelsbanken|nordea.*sweden/i, 'Sweden'],
  [/caixabank consumer/i, 'Spain'],
  [/crédit mutuel|caisse.*epargne/i, 'France'],
  [/hsbc/i, 'United Kingdom'],
  [/commerzbank|deutsche bank/i, 'Germany'],
  [/banco de sabadell/i, 'Spain'],
  [/psa bank deutschland/i, 'Germany'],
  [/deutsche sparkassen/i, 'Germany'],
  [/hypo.*bank/i, 'Austria'],
  [/obvion/i, 'Netherlands'],
];

function inferCountry(name) {
  for (const [re, country] of NAME_HINTS) {
    if (re.test(name)) return country;
  }
  return null;
}

async function main() {
  // Build unique LEI list
  const leis = [...new Set(deals.map(d => d.originator_lei).filter(Boolean))];
  console.log(`Resolving ${leis.length} unique LEIs via GLEIF API...\n`);
  
  const leiCountry = {};
  let resolved = 0;
  
  for (let i = 0; i < leis.length; i++) {
    const lei = leis[i];
    const country = await lookupLEI(lei);
    if (country) {
      leiCountry[lei] = country;
      resolved++;
    }
    if ((i + 1) % 20 === 0) process.stdout.write(`\r  ${i + 1}/${leis.length} (${resolved} resolved)`);
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }
  console.log(`\n  Resolved ${resolved}/${leis.length} LEIs\n`);
  
  // Save LEI->country cache
  fs.writeFileSync('data/lei_countries.json', JSON.stringify(leiCountry, null, 2));
  
  // Apply to deals: priority = LEI lookup > name inference > prospectus country
  let updated = 0;
  deals.forEach(d => {
    const fromLEI = d.originator_lei ? leiCountry[d.originator_lei] : null;
    const fromName = inferCountry(d.originator);
    const origCountry = fromLEI || fromName || null;
    
    if (origCountry) {
      d.originator_country = origCountry;
      d.country = origCountry; // Override the SPV country
      updated++;
    } else {
      d.originator_country = '';
      // Keep prospectus country as fallback if it exists and isn't just SPV domicile
    }
  });
  
  // Also filter out empty tranches
  let tranchesRemoved = 0;
  deals.forEach(d => {
    const before = d.tranches.length;
    d.tranches = d.tranches.filter(t => t.isin && t.isin.trim() !== '');
    tranchesRemoved += before - d.tranches.length;
  });
  
  fs.writeFileSync('data/esma_sts_deals.json', JSON.stringify(deals, null, 2));
  
  // Stats
  const countries = {};
  deals.forEach(d => { const c = d.country || 'Unknown'; countries[c] = (countries[c] || 0) + 1; });
  console.log('Updated countries for', updated, 'deals');
  console.log('Removed', tranchesRemoved, 'empty tranches');
  console.log('\nCountry distribution:');
  Object.entries(countries).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main().catch(console.error);
