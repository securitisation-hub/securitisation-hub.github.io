/**
 * Scrape TSI (True Sale International) certified transactions
 * Extracts: name, originator, asset_class, closing_date, portfolio, jurisdiction, status, documents
 */

const BASE = 'https://www.true-sale-international.de';

// Parse the listing page text (readability output) into transaction entries
function parseListingText(text) {
  const entries = [];
  // Each line from the listing has format:
  // TransactionNameOriginatorAsset classDD-MM-YYYYPortfolioCountry[/en/services/certified-transactions/slug]
  // Lines with * are redeemed/historical, those without detail page link have no slug
  
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    // Try to extract the slug (detail page URL)
    const slugMatch = line.match(/\/en\/services\/certified-transactions\/([\w-]+)$/);
    const slug = slugMatch ? slugMatch[1] : null;
    
    // Extract date pattern DD-MM-YYYY
    const dateMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
    if (!dateMatch) continue;
    
    const date = dateMatch[1];
    const dateIdx = line.indexOf(date);
    const beforeDate = line.substring(0, dateIdx);
    const afterDate = line.substring(dateIdx + 10);
    
    // Check if redeemed (has * in name)
    const redeemed = beforeDate.includes('*');
    
    // After date comes: Portfolio + Country[/slug]
    let afterClean = afterDate;
    if (slugMatch) {
      afterClean = afterDate.substring(0, afterDate.indexOf('/en/'));
    }
    
    // Known asset class keywords to split on
    const assetClasses = [
      'Auto loans', 'Auto leases', 'Consumer loans', 'RMBS', 
      'Commercial leasing / hire purchase', 'CLO', 'CLO/SME', 'CMBS'
    ];
    
    let assetClass = '';
    let nameAndOriginator = '';
    
    for (const ac of assetClasses) {
      const acIdx = beforeDate.indexOf(ac);
      if (acIdx !== -1) {
        assetClass = ac;
        nameAndOriginator = beforeDate.substring(0, acIdx);
        break;
      }
    }
    
    if (!assetClass) continue;
    
    // Clean name (remove *)
    const cleanNameOrig = nameAndOriginator.replace(/\*/g, '').trim();
    
    entries.push({
      raw_name_originator: cleanNameOrig,
      asset_class: assetClass,
      date: date,
      after_date: afterClean.trim(),
      redeemed: redeemed,
      slug: slug
    });
  }
  
  return entries;
}

// Main output - we'll process this into structured JSON
const rawText = `Driver España sixVolkswagen Bank GmbH, Branch SpainAuto loans28-02-2020Automobile loansSpain/en/services/certified-transactions/driver-espana-six
Driver UK MasterVolkswagen Financial Services (UK) LimitedAuto loans21-11-2012Automobile loansUK/en/services/certified-transactions/driver-uk-master
SC Germany Auto 2019-1Santander Consumer Bank AGAuto loans27-11-2019Automobile loansGerman/en/services/certified-transactions/scg-car-2019-1
SC Germany S.A., Comp. Consumer 2020-1Santander Consumer Bank AGConsumer loans19-11-2020Consumer loansGerman/en/services/certified-transactions/scg-consumer-2020-1
SC Germany S.A., Comp. Consumer 2021-1Santander Consumer Bank AGConsumer loans17-11-2021Consumer loansGerman/en/services/certified-transactions/scg-consumer-2021-1
SC Germany S.A., Comp. Consumer 2022-1Santander Consumer Bank AGConsumer loans27-10-2022Consumer loansGerman/en/services/certified-transactions/scg-consumer-2022-1
VCL Master*Volkswagen Leasing GmbHAuto leases25-09-2020Auto lease receivablesGerman
VCL Master Residual Value*Volkswagen Leasing GmbHAuto leases25-09-2020Auto lease receivablesGerman
VCL Master Netherlands*Volkswagen Pon Financial Services B.V.Auto leases31-05-2016Auto lease receivablesDutch
A-BEST 16FCA Bank Deutschland GmbHAuto loans03-12-2018Automobile loansGerman/en/services/certified-transactions/a-best-16
A-BEST 19FCA Bank Deutschland GmbHAuto loans17-11-2020Automobile loansGerman/en/services/certified-transactions/a-best-19
A-BEST 21FCA Bank Deutschland GmbHAuto loans12-08-2021Automobile loansGerman/en/services/certified-transactions/a-best-21
Bavarian Sky S.A., Comp. German Auto Leases 6BMW Bank GmbHAuto leases20-07-2021Auto lease receivablesGerman/en/services/certified-transactions/bavsky-leases-6
Bavarian Sky S.A., Comp. German Auto Leases 7BMW Bank GmbHAuto leases20-10-2022Auto lease receivablesGerman/en/services/certified-transactions/bavsky-leases-7
Bavarian Sky S.A., Comp. German Auto Loans 9BMW Bank GmbHAuto loans18-12-2019Automobile loansGerman/en/services/certified-transactions/bavsky-loans-9
Bavarian Sky S.A., Comp. German Auto Loans 10BMW Bank GmbHAuto loans27-05-2020Automobile loansGerman/en/services/certified-transactions/bavsky-loans-10
Bavarian Sky S.A., Comp. German Auto Loans 11BMW Bank GmbHAuto loans19-05-2022Automobile loansGerman/en/services/certified-transactions/bavsky-loans-11
Bavarian Sky S.A., Comp. German Auto Loans 12BMW Bank GmbHAuto loans20-03-2023Automobile loansGerman/en/services/certified-transactions/bavsky-loans-12
Limes Funding S.A., Compartment 2019-1Deutsche Sparkassen Leasing AG & Co. KGCommercial leasing / hire purchase17-07-2019Commercial leasing receivablesGerman/en/services/certified-transactions/limes-2019-1
Limes Funding S.A., Compartment 2021-1Deutsche Sparkassen Leasing AG & Co. KGCommercial leasing / hire purchase30-06-2021Commercial leasing receivablesGerman/en/services/certified-transactions/limes-2021-1
PBD Germany Auto 2018PSA Bank Deutschland GmbHAuto loans25-10-2018Automobile loansGerman/en/services/certified-transactions/pbd-germany-auto-2018
PBD Germany Auto Loan 2021PSA Bank Deutschland GmbHAuto loans29-01-2021Automobile loansGerman/en/services/certified-transactions/pbd-germany-auto-loan-2021
Bavarian Sky S.A., Comp. German Auto Leases 8BMW Bank GmbHAuto leases20-11-2023Auto lease receivablesGerman/en/services/certified-transactions/bavsky-leases-8
Bavarian Sky S.A., Comp. German Auto Loans 13BMW Bank GmbHAuto loans20-03-2024Automobile loansGerman/en/services/certified-transactions/bavsky-loans-13
Bavarian Sky S.A., Comp. German Auto Loans 14BMW Bank GmbHAuto loans20-02-2025Automobile loansGerman/en/services/certified-transactions/bavsky-loans-14
Bavarian Sky S.A., Comp. German Auto Leases 9BMW Bank GmbHAuto leases20-05-2025Auto lease receivablesGerman/en/services/certified-transactions/bavsky-leases-9
Bavarian Sky S.A., Comp. German Auto Leases 10BMW Bank GmbHAuto leases23-02-2026Auto lease receivablesGerman/en/services/certified-transactions/bavsky-leases-10`;

// Also include the historical/redeemed ones
const historicalText = `Driver one*Volkswagen Bank GmbHAuto loans30-11-2004Automobile loansGerman
Driver two*Volkswagen Bank GmbHAuto loans14-09-2005Automobile loansGerman
Driver three*Volkswagen Bank GmbHAuto loans27-10-2006Automobile loansGerman
Driver four*Volkswagen Bank GmbHAuto loans22-07-2007Automobile loansGerman
Driver five*Volkswagen Bank GmbHAuto loans27-02-2008Automobile loansGerman
Driver six*Volkswagen Bank GmbHAuto loans30-09-2008Automobile loansGerman
Driver seven*Volkswagen Bank GmbHAuto loans22-04-2010Automobile loansGerman
Driver eight*Volkswagen Bank GmbHAuto loans24-02-2011Automobile loansGerman
Driver nine*Volkswagen Bank GmbHAuto loans23-06-2011Automobile loansGerman
Driver ten*Volkswagen Bank GmbHAuto loans25-02-2013Automobile loansGerman
Driver eleven*Volkswagen Bank GmbHAuto loans25-07-2013Automobile loansGerman
Driver twelve*Volkswagen Bank GmbHAuto loans28-05-2014Automobile loansGerman
Driver thirteen*Volkswagen Bank GmbHAuto loans25-02-2015Automobile loansGerman
Driver fourteen*Volkswagen Bank GmbHAuto loans26-03-2018Automobile loansGerman
Driver fifteen*Volkswagen Bank GmbHAuto loans25-09-2018Automobile loansGerman
Driver Master*Volkswagen Bank GmbHAuto loans27-07-2015Automobile loansGerman
Private Driver 2010-1 fixed*Volkswagen Bank GmbHAuto loans28-10-2010Automobile loansGerman
Private Driver 2011-1*Volkswagen Bank GmbHAuto loans28-07-2011Automobile loansGerman
Private Driver 2014-4*Volkswagen Bank GmbHAuto loans28-11-2014Automobile loansGerman
Private Driver UK 2018-1*Volkswagen Financial Services (UK) Ltd.Auto loans26-03-2018Automobile loansUK
Driver Australia one*Volkswagen Financial Services Australia Pty LimitedAuto loans12-12-2013Automobile loansAustralia
Driver Australia two*Volkswagen Financial Services Australia Pty LimitedAuto loans26-03-2015Automobile loansAustralia
Driver Australia three*Volkswagen Financial Services Australia Pty LimitedAuto loans28-04-2016Automobile loansAustralia
Driver Australia four*Volkswagen Financial Services Australia Pty LimitedAuto loans25-05-2017Automobile loansAustralia
Driver Australia five*Volkswagen Financial Services Australia Pty LimitedAuto loans25-05-2017Automobile loansAustralia
Driver Brasil three*Banco VolkswagenAuto loans15-12-2015Automobile loansBrasil
Driver China one*Volkswagen Finance (China) Co., Ltd.Auto loans01-08-2014Automobile loansChina
Driver China two*Volkswagen Finance (China) Co., Ltd.Auto loans22-07-2015Automobile loansChina
Driver China three*Volkswagen Finance (China) Co., Ltd.Auto loans27-01-2016Automobile loansChina
Driver China four*Volkswagen Finance (China) Co., Ltd.Auto loans22-07-2016Automobile loansChina
Driver China five*Volkswagen Finance (China) Co., Ltd.Auto loans07-12-2016Automobile loansChina
Driver China six*Volkswagen Finance (China) Co., Ltd.Auto loans24-05-2017Automobile loansChina
Driver China seven*Volkswagen Finance (China) Co., Ltd.Auto loans21-09-2017Automobile loansChina
Driver China eight*Volkswagen Finance (China) Co., Ltd.Auto loans07-12-2017Automobile loansChina
Driver España two*Volkswagen Finance S.A.Auto loans14-10-2015Automobile loansSpain
Driver España three*Volkswagen Finance S.A.Auto loans26-02-2016Automobile loansSpain
Driver España four*Volkswagen Finance S.A.Auto loans28-06-2017Automobile loansSpain
Driver España five*Volkswagen Finance S.A.Auto loans28-02-2018Automobile loansSpain
Driver France one*Volkswagen Bank GmbH (French Branch)Auto loans07-10-2013Automobile loansFrance
Driver France two*Volkswagen Bank GmbH (French Branch)Auto loans30-06-2015Automobile loansFrance
Driver France three*Volkswagen Bank GmbH (French Branch)Auto loans27-04-2017Automobile loansFrance
Driver Italia one*Volkswagen Bank GmbH - Italian BranchAuto loans29-05-2018Automobile loansItaly
Driver Japan one*Volkswagen Financial Services Japan Ltd.Auto loans26-01-2012Automobile loansJapan
Driver Japan two*Volkswagen Financial Services Japan Ltd.Auto loans27-02-2013Automobile loansJapan
Driver Japan three*Volkswagen Financial Services Japan Ltd.Auto loans27-02-2014Automobile loansJapan
Driver Japan four*Volkswagen Financial Services Japan Ltd.Auto loans27-02-2015Automobile loansJapan
Driver Japan five*Volkswagen Financial Services Japan Ltd.Auto loans26-02-2016Automobile loansJapan
Driver Japan six*Volkswagen Financial Services Japan Ltd.Auto loans27-02-2017Automobile loansJapan
Driver Japan seven*Volkswagen Financial Services Japan Ltd.Auto loans27-02-2018Automobile loansJapan
Driver UK two*Volkswagen Financial Services (UK) Ltd.Auto loans25-09-2014Automobile loansUK
Driver UK three*Volkswagen Financial Services (UK) Ltd.Auto loans25-09-2015Automobile loansUK
Driver UK four*Volkswagen Financial Services (UK) Ltd.Auto loans25-11-2016Automobile loansUK
Driver UK five*Volkswagen Financial Services (UK) Ltd.Auto loans27-03-2017Automobile loansUK
Driver UK six*Volkswagen Financial Services (UK) Ltd.Auto loans25-09-2017Automobile loansUK
VCL Multi-Compartment S.A., Compartment VCL 12*Volkswagen Leasing GmbHAuto leases27-09-2010Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 13*Volkswagen Leasing GmbHAuto leases26-04-2011Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 14*Volkswagen Leasing GmbHAuto leases25-10-2011Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 15*Volkswagen Leasing GmbHAuto leases26-03-2012Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 16*Volkswagen Leasing GmbHAuto leases25-10-2012Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 17*Volkswagen Leasing GmbHAuto leases25-03-2013Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 18*Volkswagen Leasing GmbHAuto leases25-10-2013Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 19*Volkswagen Leasing GmbHAuto leases25-02-2014Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 20*Volkswagen Leasing GmbHAuto leases27-10-2014Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 21*Volkswagen Leasing GmbHAuto leases26-05-2015Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 22*Volkswagen Leasing GmbHAuto leases25-11-2015Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 23*Volkswagen Leasing GmbHAuto leases25-04-2016Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 24*Volkswagen Leasing GmbHAuto leases25-11-2016Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 25*Volkswagen Leasing GmbHAuto leases27-11-2017Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 26*Volkswagen Leasing GmbHAuto leases25-04-2018Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 27*Volkswagen Leasing GmbHAuto leases26-11-2018Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 28*Volkswagen Leasing GmbHAuto leases25-04-2019Auto lease receivablesGerman
VCL Multi-Compartment S.A., Compartment VCL 29*Volkswagen Leasing GmbHAuto leases25-11-2019Auto lease receivablesGerman
Bavarian Sky S.A., Compartment 3*BMW Bank GmbHAuto leases18-07-2012Auto lease receivablesGerman
Bavarian Sky S.A., Compartment German Auto Loans 1*BMW Bank GmbHAuto loans27-06-2013Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 2*BMW Bank GmbHAuto loans20-08-2014Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 3*BMW Bank GmbHAuto loans20-08-2015Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 4*BMW Bank GmbHAuto loans20-05-2016Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 5*BMW Bank GmbHAuto loans20-10-2016Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 6*BMW Bank GmbHAuto loans23-05-2017Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 7*BMW Bank GmbHAuto loans18-10-2017Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Loans 8*BMW Bank GmbHAuto loans16-05-2018Automobile loansGerman
Bavarian Sky S.A., Compartment German Auto Leases 4*BMW Bank GmbHAuto leases16-12-2015Auto lease receivablesGerman
Bavarian Sky S.A., Compartment German Auto Leases 5*BMW Bank GmbHAuto leases23-09-2019Auto lease receivablesGerman
SC Germany Auto 2010-1*Santander Consumer Bank AGAuto loans29-07-2010Automobile loansGerman
SC Germany Auto 2011-1*Santander Consumer Bank AGAuto loans23-09-2011Automobile loansGerman
SC Germany Auto 2011-2*Santander Consumer Bank AGAuto loans29-11-2011Automobile loansGerman
SC Germany Auto 2013-1*Santander Consumer Bank AGAuto loans27-03-2013Automobile loansGerman
SC Germany Auto 2013-2*Santander Consumer Bank AGAuto loans18-07-2013Automobile loansGerman
SC Germany Auto 2014-1*Santander Consumer Bank AGAuto loans20-03-2014Automobile loansGerman
SC Germany Auto 2016-1*Santander Consumer Bank AGAuto loans19-05-2016Automobile loansGerman
SC Germany Auto 2017-1*Santander Consumer Bank AGAuto loans21-06-2017Automobile loansGerman
SC Germany Auto 2018-1*Santander Consumer Bank AGAuto loans21-06-2018Automobile loansGerman
PB Consumer 2008-1*PostbankConsumer loans28-01-2008Consumer loansGerman
PB Consumer 2009-1*PostbankConsumer loans28-04-2009Consumer loansGerman
Pure German Lion RMBS 2008*ING-DiBa AGRMBS03-12-2008Residential MortagesGerman
Asset-Backed European Securitisation Transaction Eleven*FCA Bank Germany GmbHAuto loans30-03-2015Automobile loansGerman
RCL Securitisation*Dresdner BankCLO01-08-2006SME loansGerman
TS Co.mit One*COMMERZBANKCLO28-07-2006SME loansGerman
PROMISE Neo 2012*HSH Nordbank AGCLO/SME25-10-2012SME loansGerman
Opera Germany (No. 1)*EurohypoCMBS01-11-2006Commercial mortagesGerman
WILCO 2007-1*Westdeutsche ImmobilienBankCMBS06-02-2007Commercial mortagesGerman
German Mittelstand Equipment Finance No. 2*IKB Leasing GmbHCommercial leasing / hire purchase31-07-2014Commercial leasing receivablesGerman`;

// Known originator names to help split transaction name from originator
const KNOWN_ORIGINATORS = [
  'Volkswagen Bank GmbH, Branch Spain',
  'Volkswagen Financial Services (UK) Limited',
  'Volkswagen Financial Services (UK) Ltd.',
  'Santander Consumer Bank AG',
  'Volkswagen Leasing GmbH',
  'Volkswagen Pon Financial Services B.V.',
  'FCA Bank Deutschland GmbH',
  'FCA Bank Germany GmbH',
  'BMW Bank GmbH',
  'Deutsche Sparkassen Leasing AG & Co. KG',
  'PSA Bank Deutschland GmbH',
  'Volkswagen Bank GmbH',
  'Volkswagen Bank GmbH (French Branch)',
  'Volkswagen Bank GmbH - Italian Branch',
  'Volkswagen Financial Services Australia Pty Limited',
  'Volkswagen Financial Services Japan Ltd.',
  'Volkswagen Finance (China) Co., Ltd.',
  'Volkswagen Finance S.A.',
  'Banco Volkswagen',
  'Postbank',
  'ING-DiBa AG',
  'Dresdner Bank',
  'COMMERZBANK',
  'HSH Nordbank AG',
  'Eurohypo',
  'Westdeutsche ImmobilienBank',
  'IKB Leasing GmbH'
];

const JURISDICTION_MAP = {
  'German': 'Germany',
  'Dutch': 'Netherlands',
  'UK': 'United Kingdom',
  'Spain': 'Spain',
  'France': 'France',
  'Italy': 'Italy',
  'Japan': 'Japan',
  'China': 'China',
  'Australia': 'Australia',
  'Brasil': 'Brazil'
};

function splitNameOriginator(raw) {
  // Try each known originator, longest first
  const sorted = [...KNOWN_ORIGINATORS].sort((a, b) => b.length - a.length);
  for (const orig of sorted) {
    const idx = raw.indexOf(orig);
    if (idx !== -1) {
      return {
        name: raw.substring(0, idx).trim(),
        originator: orig
      };
    }
  }
  return { name: raw, originator: '' };
}

function parseAll() {
  const allText = rawText + '\n' + historicalText;
  const entries = parseListingText(allText);
  
  const results = entries.map(e => {
    const { name, originator } = splitNameOriginator(e.raw_name_originator);
    const jurisdiction = e.after_date.replace(/Automobile loans|Consumer loans|Auto lease receivables|Commercial leasing receivables|Residential Mortages|Commercial mortages|SME loans/g, '').trim();
    
    return {
      source: 'TSI',
      tsi_slug: e.slug,
      name: name,
      originator: originator,
      asset_class: e.asset_class,
      closing_date: e.date,
      jurisdiction: JURISDICTION_MAP[jurisdiction] || jurisdiction,
      redeemed: e.redeemed,
      detail_url: e.slug ? `${BASE}/en/services/certified-transactions/${e.slug}` : null
    };
  });
  
  return results;
}

const data = parseAll();
const fs = require('fs');
fs.writeFileSync('data/tsi_transactions.json', JSON.stringify(data, null, 2));
console.log(`Parsed ${data.length} TSI transactions`);
console.log(`Active: ${data.filter(d => !d.redeemed).length}`);
console.log(`Redeemed: ${data.filter(d => d.redeemed).length}`);
console.log(`With detail page: ${data.filter(d => d.tsi_slug).length}`);

// Show sample
console.log('\nSample (first 3):');
data.slice(0, 3).forEach(d => console.log(JSON.stringify(d)));
