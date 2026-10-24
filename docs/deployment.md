# Your household, in balance

A private place to keep your shared finances clear. All amounts are Australian dollars. Dates and schedules use Brisbane time.

## Getting started
Create your first administrator with your name, email and the setup token supplied by the app owner. Create a passkey when your device prompts you. Setup completes only after that passkey is verified.
Open Accounts and add your everyday, savings, cash and credit accounts. Choose **Would you like to upload a statement to start?** to begin with a PDF, or enter your opening date and balance manually. Credit owed uses a negative opening balance.
Invite your wife through Settings → Users. Share the private invitation link directly. She creates her own passkey and can manage all household finances.

## Passkeys and signing in
Use Sign in with a passkey and follow your device’s fingerprint, face or screen-lock prompt.
Open your account menu to add and remove passkeys. Give them recognisable names. Add a replacement before removing your last passkey.
Log out ends your current server session. You can sign back in with any registered passkey.
If you lose every passkey, another administrator can reset your access and give you a replacement invitation. If the only administrator loses access, contact the app owner.

## Overview
Available balance combines bank and cash balances and subtracts outstanding credit owed.
Money in is recorded income this month. Money out is recorded expenses less refunds. Transfers do not count as spending or income.
Use the ownership filter for records labelled Household or a specific person. Both people can see all records.
Click a summary to see the accounts, transactions or budgets behind it. Forecast and spending budgets cover the whole household.

## Accounts and balances

Open an account card to see its own page: Transactions, Upcoming & forecast, and Statements. Edit account changes its details and archive status. Upload statement adds another PDF to that account. The account forecast includes accepted scheduled bills/income; household budget allowances remain on the household forecast.
Opening balances establish the starting point; later transactions update them.
Record a transfer when moving money between tracked accounts or paying a credit card. The app records both sides together.
Archive an unused account through its details. History and its remaining balance stay available; settle its balance before retiring it.

## Transactions
Add income, expenses or refunds. Enter a positive amount and let the selected type determine its direction.
Use the correct expense category for a refund so it reduces that category’s spending.
Choose the account, date, category and owner. Notes are optional.
Filter activity by description, date, account, category, type or owner. Select several non-transfer records to change their category together.
Open a transaction to edit it, inspect receipts or delete it. Deleting a transfer removes both linked entries. Remove receipts before deleting a transaction.
If someone edits the same record while you are editing, refresh and review their changes before saving again.

## Credit cards

Add each card under Accounts with type **Credit card**. It has the same transaction, statement and forecast tools as a bank account, with debt represented as a negative balance. For example, $500 owed is −500.00; an overpayment is positive. The account page also shows the amount owed in plain language. Cards are already included in net worth: do not add the same debt again under Assets & Liabilities.

Purchases, interest and fees are expenses; refunds reduce expenses. Repayments are **Transfer / card repayment** from the paying bank account to the card. Both sides are created together and neither counts as income or spending. A later statement for the other account flags that entry as a possible duplicate: leave it unchecked. If a repayment was previously entered as an expense, delete that incorrect entry and record a linked transfer before importing it again.

Upload a card PDF from setup or the account page. The reader converts ordinary positive amounts owed into negative ledger balances, uses running balances where available, and recognises CR credits. Review the signs against the original because banks use different conventions. Positive card transactions are suggested as repayments unless the description indicates a refund; choose the paying account or change the type to Refund as appropriate. Recurring card purchases can be accepted as bills or subscriptions. The forecast includes these accepted charges; it does not assume a bank’s minimum payment or automatically pay the card. Check due dates and payment requirements on the statement.

## Importing PDF bank statements

Start from the statement option in Add account, or open an account and choose Upload statement. PDFs can contain multiple months; six-month statements are supported. Each upload can contain up to 20 MB, 500 pages and 10,000 transaction lines. Split larger statements into smaller PDFs. Password-protected files must be unlocked before uploading.

The local reader extracts all pages and uses text recognition for scans. For unfamiliar layouts, **Use AI to understand this bank’s layout** sends extracted text to the model selected in Settings → AI. It requires configured AI access. Email addresses and long numeric references are masked, but merchant names and financial details are included. The provider is requested to use no-retention processing. Leave it unchecked to keep extraction local.

1. **Opening balance:** check the opening balance and all source pages. An extracted opening balance is tied to the source; if none is found, enter it from your statement. Opening balances can be applied only to accounts without existing transactions. The inferred opening date is the earliest extracted transaction date, immediately before that transaction. Existing account history is preserved.
2. **Review transactions:** inspect every row and category. Suggestions use merchant rules, previous activity and common merchants; the optional AI reader also suggests categories. Mark refunds and transfers correctly. Possible duplicate payments are initially excluded; include a genuine repeat only after checking it. Source amounts and dates cannot be edited into different financial records during confirmation.
3. **Recurring suggestions:** choose each bill, subscription or income pattern you want to track. Nothing is accepted by default. The detector tolerates changing references and missing cycles. Two payments from a recognisable recurring provider can appear as a possible pattern; check them before accepting. Review the expected amount, frequency, next date and category. Variable payments use the median amount as a suggestion. Only selected patterns are saved, starting in the future.
4. **Confirm:** check the selected/excluded totals and explicitly accept the review. Opening balance, transactions and recurring items are saved together. A failed confirmation leaves them unchanged. Repeating confirmation of the same file cannot duplicate its entries.

No PDF reader can guarantee every layout or scan. Highlighted source lines, invalid dates or a closing-balance mismatch require attention. Compare the original PDF; do not accept an incomplete extraction. Re-export a clearer PDF, try the optional AI reader, or use the bank’s CSV export. For dates without a printed year, specify the statement year only when it is unambiguous; a statement spanning New Year needs clear transaction years.

Uploaded PDFs are private to signed-in household members. Find the original download and a pending review under the account’s Statements tab. Once the PDF upload finishes, processing continues in the background even if you navigate away or close the app. The Statements tab shows Queued, Reading PDF pages, Analysing transactions, Ready to review or Needs attention. Use View progress to reopen a pending job. Failed jobs keep their PDF and offer Try again; completed PDF reviews remain saved for later. No financial records change before you accept the review. An account is created before the optional statement upload, so cancelling setup leaves an empty account you can revisit.

## Importing bank CSV files
Export a CSV statement from your bank. Add its account before importing.
Choose Import CSV, select the account and upload a file up to 5 MB and 10,000 rows.
Match the date and description columns. Choose a signed amount column, or separate positive debit and credit columns.
Select the exact date format. Day/month/year is the Australian default. A wrong format can change dates even when they look valid.
Review the preview. Correct an amount or date by changing the mapping and creating a new preview.
Invalid rows are excluded. Possible duplicates start excluded; retain a legitimate duplicate explicitly.
Mark positive refunds with Refund and the original expense category. Mark transfers and credit-card repayments with Transfer, and select the other tracked account; both entries are created together. A later CSV from that other account flags the matching amount/date as a possible duplicate.
Edit descriptions, categories and owner labels as needed. Confirm import saves only selected valid rows.
Confirming the same file again will not duplicate its transactions. Saved mappings are reused for that account.

## Optional AI suggestions
Open **Settings → AI** (More → Settings → AI on mobile). An administrator pastes the **OpenRouter API key**, chooses an **AI model**, then selects **Save AI settings**. Get a key using the OpenRouter link beside the field. The saved key is encrypted and never displayed again; leave the field blank to keep it, or paste a replacement. **Check key** checks whether OpenRouter accepts the entered or saved key without sending financial data or running the selected model. Model availability and credits are checked when you request suggestions. **Remove saved key** removes the key entered here; if the app owner configured a server key, that key is used again. OpenRouter charges usage to your OpenRouter account.
AI can suggest column mappings and categories. Redacted sample descriptions and CSV samples are sent to OpenRouter when you request suggestions.
Amounts and dates always come from your CSV. AI cannot commit an import or overwrite a chosen category.
Review every suggestion. If AI is unavailable, finish the import manually.

## Categories and merchant rules
Open Categories in the sidebar, or More → Categories on mobile. Categories are separate from Settings. Default income and expense categories are included. Add category creates a new one; choose Parent category to make a subcategory. Parents and children must share the same income/expense type, with one subcategory level.

Click a category to rename it, change its colour, move it under a parent, or archive it. Remove category deletes only an unused category without children. Used categories must be archived to preserve history. Archiving a parent also archives its children; restore each category you want to use again. Budgets and transaction filters currently use the exact selected category, so a parent and its subcategories have separate allowances.
Add a description-matching rule such as Woolworths → Groceries. Matching ignores case. Lower priorities run first.
Your explicit category takes priority. Rules suggest categories during imports and apply to API-created transactions without an explicit category, without changing past records automatically.

## Monthly budgets
Plan → Budgets sets an allowance for each expense category. Spending includes all owners and subtracts refunds.
Choose a month to review or set its amount. Budgets repeat until replaced by a new monthly amount. Set zero to stop a category allowance.
Unspent amounts do not roll over. Over-budget categories stay visible so you can adjust your plan.

## Bills, income and subscriptions
Plan → Bills & income keeps your regular paydays and bills. Subscriptions use the same schedule system.
Set an amount, account, category, starting date and weekly, fortnightly, monthly, quarterly or annual frequency.
Monthly dates stay anchored to the original day. A schedule starting on the 31st uses the last available day in shorter months and returns to the 31st afterward.
Planned occurrences do not create transactions automatically.
Use Record on or after the occurrence date, or Match an existing transaction with the same account, type and amount. Each occurrence can be matched once.
Cancelled schedules stop future projections; existing recorded transactions remain.
Subscription monthly and annual totals are normalised estimates.

## Cash-flow forecast
Plan → Forecast offers 30-, 90-, 180- and 365-day views.
It starts with available funds, adds scheduled income, subtracts scheduled bills and allows for remaining budgets.
Budget allowances subtract already recorded and scheduled category spending before being spread across the remaining days. This prevents counting bills twice.
Transfers and credit-card repayments do not change total available funds. Unscheduled, unbudgeted future spending is not included.
Unrecorded occurrences due today are carried into the next day of the forecast. Older unrecorded occurrences need your review and are not projected automatically.
Use it as a planning estimate and review the assumptions shown beneath the chart.

## Net worth
Tracked accounts are counted automatically.
Net Worth has its own history chart and a breakdown of every included account and asset. Positive account balances contribute to assets; negative bank or credit balances contribute to liabilities.

Use the separate **Assets & Liabilities** page to add dated valuations for property, investments, superannuation, vehicles or debts not already represented by an account. Reach it from the sidebar, Net Worth, or More on mobile.
Update values as they change. Historical totals use the latest recorded valuation on or before each date; history before your first record is not invented.
Edit or delete an incorrect valuation from the asset’s details.

## Private receipts
Open a transaction and choose Attach receipt. JPEG, PNG, WebP and PDF files up to 20 MB are supported.
Receipts are stored privately in Cloudflare R2. Both signed-in household members can view and download them.
If storage has not been configured, the upload explains what is needed. Failed uploads do not leave a usable attachment record.
Confirm deletion to remove a receipt permanently.

## Administrator guidance
Settings → Users provides Add user, role changes, new invitations, access resets and deletion.
Members manage financial records. Administrators additionally manage users and AI settings.
Invitations last seven days and are consumed only after successful passkey registration. A new invitation invalidates previous links and unfinished enrolments.
Reset access revokes the person’s passkeys and sessions, then creates a replacement invitation for the same identity.
User deletion removes access and keeps attributed financial history. Names and account identities are retained for that history.
The last active administrator cannot be deleted, demoted or reset through user administration.

## Troubleshooting and support
If totals look wrong, check the account’s opening date and balance, CSV amount signs, duplicate imports and transfer labels.
A receipt error may mean storage is unavailable. Retry after configuration is restored.
An invitation error means it is expired, revoked or already used. Ask an administrator for a new invitation.
Settings → System shows Version, Release Tag, Build Commit and Build Time. Include these details when asking the app owner for help.

## Navigation and dropdowns

Desktop navigation uses compact rows and section spacing to fit laptop screens. The title and Collapse sidebar button share one row. Use that button to collapse navigation to an icon rail with centred, equally sized controls. Expansion and collapse keep icons steady while labels fade, and respect reduced-motion preferences. Expand sidebar restores labels; your choice is remembered on this browser. The Codename attribution changes to its compact icon. The user account menu remains available.

Dropdowns use the same visual style throughout the app. Use Tab to focus, Enter or arrow keys to open, type to find an option, and Escape to dismiss.
