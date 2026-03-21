/**
 * Enrich TSI transactions with ESMA STS data (ISINs/tranches)
 * Uses strict name matching + ESMA's concatenated_issins
 */

const fs = require('fs');
const https = require('https');

const tsi = JSON.parse(fs.readFileSync('data/tsi_transactions.json', 'utf8'));
const esma = require('../data/esma_sts_api_full.json');
const esmaDocs = esma.response.docs;

const getName = x => Array.isArray(x.stsre_sec_name) ? x.stsre_sec_name[0] : (x.stsre_sec_name || '');

// Manual mapping for known matches (TSI name -> ESMA name patterns)
const MANUAL_MAP = {
  'Driver España six': 'DRIVER MASTER',
  'Driver UK Master': 'DRIVER UK MASTER',
  'SC Germany Auto 2019-1': 'SC Germany Auto 2019-1',
  'SC Germany S.A., Comp. Consumer 2020-1': 'SC Germany Consumer 2020-1',
  'SC Germany S.A., Comp. Consumer 2021-1': 'SC Germany Consumer 2021-1',
  'SC Germany S.A., Comp. Consumer 2022-1': 'SC Germany Consumer 2022-1',
  'A-BEST 16': 'A-BEST 16',
  'A-BEST 19': 'A-BEST 19',
  'A-BEST 21': 'A-BEST 21',
  'Bavarian Sky S.A., Comp. German Auto Leases 6': 'Bavarian Sky Compartment German Auto Leases 6',
  'Bavarian Sky S.A., Comp. German Auto Leases 7': 'Bavarian Sky Compartment German Auto Leases 7',
  'Bavarian Sky S.A., Comp. German Auto Loans 9': 'Bavarian Sky Compartment German Auto Loans 9',
  'Bavarian Sky S.A., Comp. German Auto Loans 10': 'Bavarian Sky Compartment German Auto Loans 10',
  'Bavarian Sky S.A., Comp. German Auto Loans 11': 'Bavarian Sky Compartment German Auto Loans 11',
  'Bavarian Sky S.A., Comp. German Auto Loans 12': 'Bavarian Sky Compartment German Auto Loans 12',
  'Limes Funding S.A., Compartment 2019-1': 'Limes Funding 2019',
  'Limes Funding S.A., Compartment 2021-1': 'Limes Funding 2021',
  'PBD Germany Auto 2018': 'PBD Germany Auto 2018',
  'PBD Germany Auto Loan 2021': 'PBD Germany Auto Loan 2021',
  'Bavarian Sky S.A., Comp. German Auto Leases 8': 'Bavarian Sky Compartment German Auto Leases 8',
  'Bavarian Sky S.A., Comp. German Auto Loans 13': 'Bavarian Sky Compartment German Auto Loans 13',
  'Bavarian Sky S.A., Comp. German Auto Loans 14': 'Bavarian Sky Compartment German Auto Loans 14',
  'Bavarian Sky S.A., Comp. German Auto Leases 9': 'Bavarian Sky Compartment German Auto Leases 9',
  'Bavarian Sky S.A., Comp. German Auto Leases 10': 'Bavarian Sky Compartment German Auto Leases 10',
};

function findEsmaMatch(tsiDeal) {
  const searchPattern = MANUAL_MAP[tsiDeal.name];
  if (!searchPattern) return null;
  
  const pattern = searchPattern.toLowerCase();
  
  // Find ESMA record where name contains the pattern
  for (const e of esmaDocs) {
    const eName = getName(e).toLowerCase();
    if (eName.includes(pattern) || pattern.includes(eName)) {
      // Verify it has ISINs
      if (e.concatenated_issins) return e;
    }
  }
  
  return null;
}

async function main() {
  const active = tsi.filter(t => !t.redeemed);
  console.log(`Matching ${active.length} active TSI deals...\n`);
  
  let matched = 0;
  for (const t of active) {
    const match = findEsmaMatch(t);
    const idx = tsi.findIndex(x => x.name === t.name && x.closing_date === t.closing_date);
    
    if (match) {
      matched++;
      const isins = match.concatenated_issins.split(',').map(s => s.trim()).filter(Boolean);
      console.log(`✅ ${t.name} => ${getName(match)} (${isins.length} ISINs)`);
      
      if (idx !== -1) {
        tsi[idx].esma_id = match.id;
        tsi[idx].esma_name = getName(match);
        tsi[idx].tranches = isins.map(isin => ({ isin }));
        tsi[idx].isins = isins;
        tsi[idx].esma_notification_date = match.stsre_notif_dt;
        tsi[idx].esma_compliance = match.stsre_compl_stat_desc;
        tsi[idx].esma_type = match.stsre_sectype_code;
      }
    } else {
      console.log(`❌ ${t.name}`);
    }
  }
  
  console.log(`\nMatched: ${matched}/${active.length}`);
  
  fs.writeFileSync('data/tsi_transactions.json', JSON.stringify(tsi, null, 2));
  console.log('Saved tsi_transactions.json');
  
  const withTranches = tsi.filter(t => t.tranches && t.tranches.length > 0);
  console.log(`Transactions with ISINs: ${withTranches.length}`);
  console.log(`Total ISINs: ${withTranches.reduce((s, t) => s + t.tranches.length, 0)}`);
}

main().catch(console.error);
