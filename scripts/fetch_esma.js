/**
 * Fetch all ESMA STS data (parents + children) from Solr API
 * and build a unified dataset.
 */
const fs = require('fs');
const https = require('https');

const SOLR = 'https://registers.esma.europa.eu/solr/esma_registers_stsre/select';
const PARENT_FIELDS = [
  'id','stsre_sec_id','stsre_sec_name','stsre_secclass_code','stsre_secclass_desc',
  'stsre_sectype_code','stsre_sectype_desc','stsre_undrlexp_desc','stsre_undrlexp_id',
  'stsre_notif_dt','stsre_init_notif_dt','stsre_notif_id',
  'stsre_compl_stat_desc','stsre_sanc_status',
  'de_name','de_lei_priv','de_lei_name',
  'prospectus_country_name','prospectus_identifier','prospectus_issue_date',
  'stsre_sec_repository','concatenated_issins',
  'authorised_third_party_name','authorised_third_party_country','authorised_third_party_statement',
  'multiple_notif_flag',
  'non_abcp_credit_institution_originator',
  'non_abcp_Riskretention_and_RetainingRiskoption_Retainingentityname',
  'non_abcp_Riskretention_and_RetainingRiskoption_RetainingentityLEI',
  'non_abcp_Riskretention_and_RetainingRiskoption_Verticalslice',
  'non_abcp_Riskretention_and_RetainingRiskoption_Randomlyselected',
  'non_abcp_Riskretention_and_RetainingRiskoption_Firstlosstranche',
  'non_abcp_Riskretention_and_RetainingRiskoption_Firstlossexposure',
  'non_abcp_Riskretention_and_RetainingRiskoption_Sellersshare'
].join(',');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Parse error: ' + body.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function fetchAllParents() {
  const PAGE = 200;
  let all = [], start = 0, total = 0;
  do {
    const url = `${SOLR}?q=type_s:parent&fl=${PARENT_FIELDS}&rows=${PAGE}&start=${start}&wt=json&sort=stsre_notif_dt+desc`;
    const data = await fetchJson(url);
    total = data.response.numFound;
    all.push(...data.response.docs);
    start += PAGE;
    process.stdout.write(`\rParents: ${all.length}/${total}`);
    await new Promise(r => setTimeout(r, 300));
  } while (start < total);
  console.log();
  return all;
}

async function fetchAllChildren() {
  const PAGE = 500;
  let all = [], start = 0, total = 0;
  do {
    const url = `${SOLR}?q=type_s:child&fl=stsre_isin_instrument,stsre_isin_name,_root_&rows=${PAGE}&start=${start}&wt=json`;
    const data = await fetchJson(url);
    total = data.response.numFound;
    all.push(...data.response.docs);
    start += PAGE;
    process.stdout.write(`\rChildren (ISINs): ${all.length}/${total}`);
    await new Promise(r => setTimeout(r, 300));
  } while (start < total);
  console.log();
  return all;
}

const AC_MAP = {
  'auto loans/leases': 'Auto ABS',
  'residential mortgages': 'RMBS',
  'credit facilities provided to individuals for personal, family or household consumption purposes': 'Consumer ABS',
  'credit facilities, including loans and leases, provided to any type of enterprise or corporation': 'SME/Corporate ABS',
  'credit card receivables': 'Credit Card ABS',
  'trade receivables': 'Trade Receivables',
  'commercial mortgages': 'CMBS',
  'others': 'Other'
};

const COUNTRY_NORM = {
  'LUXEMBOURG': 'Luxembourg', 'IRELAND': 'Ireland', 'ITALY': 'Italy',
  'FRANCE': 'France', 'NETHERLANDS': 'Netherlands', 'SPAIN': 'Spain',
  'GERMANY': 'Germany', 'UNITED KINGDOM': 'United Kingdom', 'BELGIUM': 'Belgium',
  'FINLAND': 'Finland', 'PORTUGAL': 'Portugal', 'AUSTRIA': 'Austria',
  'GREECE': 'Greece', 'POLAND': 'Poland', 'CZECH REPUBLIC': 'Czechia',
  'CZECHIA': 'Czechia', 'LITHUANIA': 'Lithuania', 'LATVIA': 'Latvia',
  'ESTONIA': 'Estonia', 'SWEDEN': 'Sweden', 'DENMARK': 'Denmark',
  'NORWAY': 'Norway', 'HUNGARY': 'Hungary', 'ROMANIA': 'Romania',
  'SLOVAKIA': 'Slovakia', 'SLOVENIA': 'Slovenia', 'CROATIA': 'Croatia',
  'BULGARIA': 'Bulgaria', 'CYPRUS': 'Cyprus', 'MALTA': 'Malta',
  'ICELAND': 'Iceland', 'LIECHTENSTEIN': 'Liechtenstein'
};

function getName(v) { return Array.isArray(v) ? v[0] : (v || ''); }
function getRepo(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); }

function riskRetentionMethod(p) {
  if (p.non_abcp_Riskretention_and_RetainingRiskoption_Verticalslice === 'Y') return 'Vertical slice';
  if (p.non_abcp_Riskretention_and_RetainingRiskoption_Randomlyselected === 'Y') return 'Random selection';
  if (p.non_abcp_Riskretention_and_RetainingRiskoption_Firstlosstranche === 'Y') return 'First loss tranche';
  if (p.non_abcp_Riskretention_and_RetainingRiskoption_Firstlossexposure === 'Y') return 'First loss exposure';
  if (p.non_abcp_Riskretention_and_RetainingRiskoption_Sellersshare === 'Y') return "Seller's share";
  return '';
}

async function main() {
  console.log('Fetching ESMA STS Register data...\n');
  
  const parents = await fetchAllParents();
  const children = await fetchAllChildren();
  
  // Group children by parent
  const childMap = {};
  children.forEach(c => {
    const pid = c._root_;
    if (!childMap[pid]) childMap[pid] = [];
    childMap[pid].push({
      isin: c.stsre_isin_instrument,
      name: c.stsre_isin_name || ''
    });
  });
  
  // Build unified dataset
  const deals = parents.map(p => {
    const name = getName(p.stsre_sec_name);
    const isPublic = (p.stsre_sectype_code || '').toUpperCase() === 'PUBLIC';
    const country = COUNTRY_NORM[(p.prospectus_country_name || '').toUpperCase()] || p.prospectus_country_name || '';
    
    return {
      id: p.id,
      sec_id: p.stsre_sec_id || '',
      name: isPublic ? name : '[Private]',
      originator: p.de_name || p.de_lei_name || '',
      originator_lei: p.de_lei_priv || '',
      country,
      asset_class: AC_MAP[p.stsre_undrlexp_desc] || p.stsre_undrlexp_desc || 'Other',
      asset_class_raw: p.stsre_undrlexp_desc || '',
      type: isPublic ? 'Public' : 'Private',
      classification: p.stsre_secclass_desc || p.stsre_secclass_code || '',
      compliance: p.stsre_compl_stat_desc || '',
      sanctioned: p.stsre_sanc_status === 'Sanctioned',
      notification_date: (p.stsre_notif_dt || '').slice(0, 10),
      initial_date: (p.stsre_init_notif_dt || '').slice(0, 10),
      notification_id: p.stsre_notif_id || '',
      verifier: p.authorised_third_party_name || '',
      verifier_country: p.authorised_third_party_country || '',
      verifier_statement: p.authorised_third_party_statement || '',
      repository: getRepo(p.stsre_sec_repository),
      prospectus_id: p.prospectus_identifier || '',
      prospectus_country: country,
      prospectus_date: p.prospectus_issue_date ? p.prospectus_issue_date.slice(0, 10) : '',
      multiple_notifications: p.multiple_notif_flag === 'Y',
      credit_institution: p.non_abcp_credit_institution_originator === 'Yes',
      risk_retention: {
        entity: p.non_abcp_Riskretention_and_RetainingRiskoption_Retainingentityname || '',
        entity_lei: p.non_abcp_Riskretention_and_RetainingRiskoption_RetainingentityLEI || '',
        method: riskRetentionMethod(p)
      },
      tranches: childMap[p.id] || [],
      esma_url: `https://registers.esma.europa.eu/publication/details?core=esma_registers_stsre&docId=${p.id}`
    };
  });
  
  // Sort by notification date desc
  deals.sort((a, b) => (b.notification_date || '').localeCompare(a.notification_date || ''));
  
  // Save
  fs.writeFileSync('data/esma_sts_deals.json', JSON.stringify(deals, null, 2));
  
  // Stats
  const pub = deals.filter(d => d.type === 'Public');
  const priv = deals.filter(d => d.type === 'Private');
  const compliant = deals.filter(d => d.compliance === 'Compliant');
  const countries = new Set(deals.map(d => d.country).filter(Boolean));
  const originators = new Set(deals.map(d => d.originator).filter(Boolean));
  const acs = new Set(deals.map(d => d.asset_class));
  const totalTranches = deals.reduce((s, d) => s + d.tranches.length, 0);
  const verifiers = {};
  deals.forEach(d => { if (d.verifier) verifiers[d.verifier] = (verifiers[d.verifier] || 0) + 1; });
  
  console.log('\n=== ESMA STS Dataset ===');
  console.log(`Total deals: ${deals.length}`);
  console.log(`Public: ${pub.length} | Private: ${priv.length}`);
  console.log(`Compliant: ${compliant.length} | Non-compliant: ${deals.length - compliant.length}`);
  console.log(`Total tranches/ISINs: ${totalTranches}`);
  console.log(`Countries: ${countries.size}`);
  console.log(`Originators: ${originators.size}`);
  console.log(`Asset classes: ${[...acs].join(', ')}`);
  console.log(`\nVerifiers:`);
  Object.entries(verifiers).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nSaved to data/esma_sts_deals.json (${(fs.statSync('data/esma_sts_deals.json').size / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
