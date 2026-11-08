# Institution branding

The account editor offers a curated institution list and reusable custom branding.
Presets and exact-name aliases live in `packages/shared/src/institutions.ts`.
Existing free-text institution names resolve at display time; no ledger record or
stored name needs a migration. Matching is case/whitespace insensitive, never a
substring guess. Colours are UI accent presets; card text keeps its normal contrast.

Built-in logos ship under `apps/web/public/institutions/`. The app makes no remote
logo requests. Logos identify the selected institution and do not imply endorsement.
The following official assets were retrieved on 8 November 2026, using references
from the [Australian Consumer Data Standards catalogue](https://github.com/ConsumerDataStandardsAustralia/product-comparator-demo/blob/master/public/datasources.json):

| Institution | Source |
| --- | --- |
| ANZ | [ANZ logo](https://www.anz.com.au/content/dam/anzcomau/logos/anz/ANZ-MB-Logo-3rd-Party-RGB.png) |
| BOQ | [BOQ logo](https://www.boq.com.au/content/dam/boq/images/miscellaneous-images/boq-logo2.png) |
| CommBank | [Commonwealth Bank logo](https://www.commbank.com.au/content/dam/commbank/commBank-logo.svg) |
| HSBC | [HSBC logo](https://www.hsbc.com.au/content/dam/hsbc/au/images/01_HSBC_MASTERBRAND_LOGO_RGB.svg) |
| ING | [ING logo](https://www.ing.com.au/img/logos/ING_Primary_Logo_RGB.png) |
| Macquarie | [Macquarie logo](https://www.macquarie.com.au/assets/bfs/global/macquarie-logo_black.svg) |
| NAB | [NAB logo](https://www.nab.com.au/etc/designs/nabrwd/clientlibs/images/logo.png) |
| Up | [Up logo](https://up.com.au/assets/images/logo_1000x1000.png) |
| Westpac | [Westpac logo](https://banking.westpac.com.au/wbc/banking/Themes/Default/Desktop/WBC/Core/Images/logo_white_bg.png.ce5c4c19ec61b56796f0e218fc8329c558421fd8.png) |

Custom uploads accept PNG/JPEG/WebP up to 2 MB and 4096 pixels on either side.
The browser decodes and re-encodes a maximum 128-pixel PNG, removing original
metadata. Shared validation caps the resulting data URL at 100,000 characters;
the API checks actual PNG type and bounded dimensions before persistence. No URL
or SVG upload is accepted. Data is returned only through the authenticated finance
snapshot, using the existing no-store policy and data-image CSP. Image failures
fall back to the chosen icon. Existing form values survive errors and retries.

`Institution` holds reusable custom branding; Account stores a nullable relation,
optional built-in preset and validated appearance overrides. A database check
prevents linking both institution kinds. Saving a reusable institution and its
account is atomic; normalized names are unique. Overriding an account does not
change the reusable institution. No delete/edit-all-institution operation is added.
Logo/icon precedence is uploaded account logo, explicit account icon, then the
institution logo/icon and finally an account-type fallback. Resetting defaults
clears only appearance overrides. Account balances and signed ledger values are
unchanged; only the credit-card amount-owed presentation uses an absolute amount.
