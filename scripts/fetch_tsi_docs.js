const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/tsi_transactions.json', 'utf8'));
const active = data.filter(d => d.detail_url);
const BASE = 'https://www.true-sale-international.de';

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function parseDocs(html) {
  const docs = [];
  const re = /href="(\/fileadmin\/[^"]+\.pdf)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = BASE + m[1];
    let name = decodeURIComponent(m[1].split('/').pop()).replace(/\.pdf$/i, '').replace(/_/g, ' ');
    docs.push({ name, url });
  }
  return docs;
}

(async () => {
  let saved = 0;
  for (let i = 0; i < active.length; i++) {
    const tx = active[i];
    const idx = data.findIndex(d => d.tsi_slug === tx.tsi_slug);
    try {
      process.stdout.write(`[${i+1}/${active.length}] ${tx.name}... `);
      const html = await fetchWithTimeout(tx.detail_url);
      const docs = parseDocs(html);
      if (idx !== -1) { data[idx].documents = docs; saved++; }
      console.log(`${docs.length} docs`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      if (idx !== -1) data[idx].documents = [];
    }
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync('data/tsi_transactions.json', JSON.stringify(data, null, 2));
  console.log(`Done. ${saved}/${active.length} fetched.`);
})();
