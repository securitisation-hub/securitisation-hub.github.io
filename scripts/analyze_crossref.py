import json
import csv
import os
from collections import Counter, defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

# 1. Load public STS deals and extract ISINs
with open(os.path.join(DATA_DIR, 'esma_sts_api_full.json'), 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

def g(d, key, default=''):
    """Get field value, unwrapping lists"""
    v = d.get(key, default)
    return v[0] if isinstance(v, list) else (v or default)

docs = data['response']['docs']
public = [d for d in docs if d.get('stsre_sectype_code') == 'PUBLIC']
print(f"Total STS deals: {len(docs)}")
print(f"Public STS deals: {len(public)}")
print(f"Non-ABCP public: {len([d for d in public if d.get('stsre_secclass_code') == 'NON_ABCP'])}")

# Build ISIN -> deal mapping
isin_to_deal = {}
deal_isins = {}
for d in public:
    name = g(d, 'stsre_sec_name')
    issins_str = g(d, 'concatenated_issins')
    if issins_str:
        isins = [i.strip() for i in issins_str.split(',') if i.strip()]
        deal_isins[name] = {
            'isins': isins,
            'originator': g(d, 'de_name'),
            'lei': g(d, 'de_lei_name'),
            'asset_class': g(d, 'stsre_undrlexp_desc'),
            'country': g(d, 'prospectus_country_name'),
            'date': g(d, 'stsre_notif_dt'),
            'deal_type': g(d, 'stsre_secclass_code'),
            'verifier': g(d, 'authorised_third_party_name'),
            'repository': g(d, 'stsre_sec_repository'),
            'retention_entity': g(d, 'non_abcp_Riskretention_and_RetainingRiskoption_Retainingentityname'),
        }
        for isin in isins:
            isin_to_deal[isin] = name

print(f"Public deals with ISINs: {len(deal_isins)}")
print(f"Total unique ISINs from public STS: {len(isin_to_deal)}")

# 2. Load ECB eligible assets and cross-reference
ecb_by_isin = {}
ecb_file = os.path.join(DATA_DIR, 'ecb_eligible_assets.csv')
with open(ecb_file, 'r', encoding='utf-16') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        isin = row.get('ISIN_CODE', '').strip()
        if isin:
            ecb_by_isin[isin] = {
                'haircut_category': row.get('HAIRCUT_CATEGORY', ''),
                'type': row.get('TYPE', ''),
                'denomination': row.get('DENOMINATION', ''),
                'issuance_date': row.get('ISSUANCE_DATE', ''),
                'maturity_date': row.get('MATURITY_DATE', ''),
                'coupon_rate': row.get('COUPON_RATE (%)', ''),
                'issuer_name': row.get('ISSUER_NAME', ''),
                'issuer_residence': row.get('ISSUER_RESIDENCE', ''),
                'issuer_group': row.get('ISSUER_GROUP', ''),
                'haircut': row.get('HAIRCUT', ''),
                'haircut_own_use': row.get('HAIRCUT_OWN_USE', ''),
            }

print(f"\nECB eligible assets: {len(ecb_by_isin)}")

# 3. Cross-reference: which STS ISINs are ECB eligible?
matched = 0
matched_deals = set()
deal_ecb_info = defaultdict(list)

for isin, deal_name in isin_to_deal.items():
    if isin in ecb_by_isin:
        matched += 1
        matched_deals.add(deal_name)
        ecb_info = ecb_by_isin[isin]
        deal_ecb_info[deal_name].append({
            'isin': isin,
            **ecb_info
        })

print(f"\n=== CROSS-REFERENCE RESULTS ===")
print(f"STS ISINs found in ECB eligible list: {matched} / {len(isin_to_deal)}")
print(f"STS deals with at least 1 ECB-eligible tranche: {len(matched_deals)} / {len(deal_isins)}")

# 4. Show ECB types found in matches
type_counts = Counter()
for deal, tranches in deal_ecb_info.items():
    for t in tranches:
        type_counts[t['type']] += 1
print(f"\nECB asset types in matched ISINs:")
for t, c in type_counts.most_common():
    type_labels = {'AT01':'Govt bonds','AT02':'Supranational','AT03':'Agency','AT10':'Bank bonds','AT11':'Other marketable','AT13':'Other'}
    print(f"  {t} ({type_labels.get(t, '?')}): {c}")

# 5. Build enriched dataset for dashboard
enriched_deals = []
for deal_name, info in deal_isins.items():
    ecb_tranches = deal_ecb_info.get(deal_name, [])
    tranches = []
    for isin in info['isins']:
        ecb = ecb_by_isin.get(isin, None)
        tranche = {
            'isin': isin,
            'ecb_eligible': ecb is not None,
        }
        if ecb:
            tranche.update({
                'haircut': ecb.get('haircut', ''),
                'haircut_category': ecb.get('haircut_category', ''),
                'denomination': ecb.get('denomination', ''),
                'coupon_rate': ecb.get('coupon_rate', ''),
                'issuance_date': ecb.get('issuance_date', ''),
                'maturity_date': ecb.get('maturity_date', ''),
                'issuer_name': ecb.get('issuer_name', ''),
                'issuer_residence': ecb.get('issuer_residence', ''),
                'type': ecb.get('type', ''),
            })
        tranches.append(tranche)
    
    enriched_deals.append({
        'name': deal_name,
        'originator': info['originator'],
        'lei': info['lei'],
        'asset_class': info['asset_class'],
        'country': info['country'],
        'notification_date': info['date'],
        'deal_type': info['deal_type'],
        'verifier': info['verifier'],
        'repository': info['repository'],
        'retention_entity': info['retention_entity'],
        'tranches': tranches,
        'total_tranches': len(tranches),
        'ecb_eligible_tranches': len([t for t in tranches if t['ecb_eligible']]),
    })

# Sort by notification date desc
enriched_deals.sort(key=lambda x: x.get('notification_date', ''), reverse=True)

print(f"\n=== ENRICHED DATASET ===")
print(f"Total public deals with ISINs: {len(enriched_deals)}")
print(f"Deals with ECB-eligible tranches: {len([d for d in enriched_deals if d['ecb_eligible_tranches'] > 0])}")
total_tranches = sum(d['total_tranches'] for d in enriched_deals)
total_ecb = sum(d['ecb_eligible_tranches'] for d in enriched_deals)
print(f"Total tranches: {total_tranches}")
print(f"ECB-eligible tranches: {total_ecb} ({total_ecb/total_tranches*100:.1f}%)")

# 6. Sample enriched deal
print("\n=== SAMPLE ENRICHED DEAL ===")
for d in enriched_deals[:3]:
    print(f"\n{d['name']}")
    print(f"  Originator: {d['originator']}")
    print(f"  Asset class: {d['asset_class']}")
    print(f"  Country: {d['country']}")
    print(f"  Tranches: {d['total_tranches']} (ECB eligible: {d['ecb_eligible_tranches']})")
    for t in d['tranches']:
        ecb_str = f"ECB: haircut={t.get('haircut','')}%, cat={t.get('haircut_category','')}" if t['ecb_eligible'] else "NOT ECB eligible"
        print(f"    {t['isin']} - {ecb_str}")

# Save enriched data
with open(os.path.join(DATA_DIR, 'sts_enriched.json'), 'w', encoding='utf-8') as f:
    json.dump(enriched_deals, f, indent=2, ensure_ascii=False)
print(f"\nSaved sts_enriched.json ({len(enriched_deals)} deals)")

# 7. Asset class distribution of enriched deals
print("\n=== ASSET CLASS (public deals with ISINs) ===")
ac = Counter(d['asset_class'] for d in enriched_deals)
for k, v in ac.most_common():
    print(f"  {k}: {v}")

print("\n=== COUNTRY ===")
cc = Counter(d['country'] for d in enriched_deals)
for k, v in cc.most_common():
    print(f"  {k}: {v}")

print("\n=== TOP ORIGINATORS ===")
oc = Counter(d['originator'] for d in enriched_deals)
for k, v in oc.most_common(15):
    print(f"  {k}: {v} deals")
