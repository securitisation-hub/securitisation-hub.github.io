# European STS Securitisation Register Dashboard

Interactive dashboard visualizing the European Securities and Markets Authority (ESMA) Register of STS (Simple, Transparent and Standardised) Securitisation Notifications.

## Data Source

All data is sourced exclusively from the **ESMA Register of STS Notifications**:
- [ESMA STS Register](https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_stsre)
- Public regulatory data under [Regulation (EU) 2017/2402](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R2402)

## Features

- **1,000+ STS securitisations** with detailed information
- **3,800+ tranches/ISINs** with copy-to-clipboard
- Interactive filters: asset class, country, type, compliance status, STS verifier
- Charts: asset class distribution, country breakdown, top originators, quarterly timeline
- Card and table views with pagination
- Deal detail modal with full STS notification info
- CSV export
- Responsive design

## Data Update

```bash
node scripts/fetch_esma.js
node scripts/normalize.js
```

## Disclaimer

This dashboard is an independent resource for informational purposes only. It is not affiliated with, endorsed by, or maintained by ESMA or any regulatory body. Data derives exclusively from publicly available ESMA STS notifications. No investment advice is provided or implied.

## Author

Built by **David Sanchez** · Titus Project
