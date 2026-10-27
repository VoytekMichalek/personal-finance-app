# Your household, in balance

Michalek Finance is a private place to keep your shared finances clear. Look for the blue dollar sign in your browser tabs. All amounts are Australian dollars. Dates and schedules use Brisbane time.

## Getting started
Create your first administrator with your name, email and the setup token supplied by the app owner. Create a passkey when your device prompts you. Setup completes only after that passkey is verified.
Open Accounts and add your everyday, savings, cash and credit accounts. Choose **Would you like to upload a statement to start?** to begin with a PDF, or enter your opening date and balance manually. Credit owed uses a negative opening balance.
Invite your wife through Settings → Users. Share the private invitation link directly. She creates her own passkey and can manage all household finances.

## Passkeys and signing in
Use Sign in with a passkey and follow your device’s fingerprint, face or screen-lock prompt.
Open your account menu to add and remove passkeys. Give them recognisable names. Register a different device or authenticator for your backup passkey. Removing your final passkey is blocked with a reminder to add a replacement first.
Log out ends your current server session. You can sign back in with any registered passkey.
If you lose every passkey, another administrator can reset your access and give you a replacement invitation. If the only administrator loses access, contact the app owner.

## Overview
Available balance combines bank and cash balances and subtracts outstanding credit owed.
Money in is recorded income this month. Money out is recorded expenses less refunds. Transfers do not count as spending or income.
Use the ownership filter for records labelled Household or a specific person. Both people can see all records.
Click a summary to see the accounts, transactions or budgets behind it. Forecast and spending budgets cover the whole household.

## Accounts and balances

Open an account card to see its own page: Transactions, Balance & spending, Upcoming & forecast, and Statements. Edit account changes its details and archive status. Upload statement adds another PDF to that account. The account forecast includes accepted scheduled bills/income; household budget allowances remain on the household forecast.
Opening balances establish the starting point immediately before activity on the opening date; transactions on that date are included. A 31 December closing balance can be used as the 1 January opening balance, provided all activity from 1 January onwards is recorded. A later export alone cannot fill an earlier gap.

**Balance & spending** shows daily closing balances for the selected dates, the balance before that period, money in, money out, net change and closing balance. Money in/out includes transfers and refunds as cash movements. Use **View balance values** for the exact numbers. The category breakdown shows expenses less refunds, excluding income and transfers; select a category to see its spending trend and underlying transactions. Missing history affects the balance chart too.
Record a transfer when moving money between tracked accounts or paying a credit card. The app records both sides together.
Archive an unused account through its details. History and its remaining balance stay available; settle its balance before retiring it.

## Transactions
Add income, expenses or refunds. Enter a positive amount and let the selected type determine its direction.
Use the correct expense category for a refund so it reduces that category’s spending.
Choose the account, date, category and owner. Notes are optional.
Filter activity by description, date, account, category, type or owner. These filters are also available inside each account’s Transactions tab. **Select all matching transactions** selects every matching row across all pages, not just the 50 shown. Changing a filter clears selection. Individual checkboxes and **Clear selection** refine or reset it.
Use **Bulk category → Apply category** for selected income, expenses and refunds (up to 10,000 at once). Transfers stay selected but retain their linked transfer classification and are excluded from category edits. For a mixed income/expense selection, filter by type to assign a compatible category; Uncategorised can clear either kind. A concurrent edit rejects the whole bulk change so you can refresh and review.
Category, person, account and type chips use consistent colours with text labels. Category colours follow your chosen colour; categories sharing a colour get distinct automatic accents.
Open a transaction to edit it, inspect receipts or delete it. Deleting a transfer removes both linked entries. Remove receipts before deleting a transaction.

Use **Delete selected** in the selection bar to remove multiple transactions in the current filters, including across pages. Review the confirmation count: linked transfer entries outside the selection or in other accounts are included and removed together. Deletion cannot be undone. At most 10,000 entries, including transfer counterparts, can be deleted at once. If any entry has an attached receipt or has changed since the confirmation opened, nothing is deleted. Remove receipts first, or refresh and review the selection before trying again.
If someone edits the same record while you are editing, refresh and review their changes before saving again.

## Credit cards

Add each card under Accounts with type **Credit card**. It has the same transaction, statement and forecast tools as a bank account, with debt represented as a negative balance. For example, $500 owed is −500.00; an overpayment is positive. The account page also shows the amount owed in plain language. Cards are already included in net worth: do not add the same debt again under Assets & Liabilities.

Purchases, interest and fees are expenses; refunds reduce expenses. Repayments are **Transfer / card repayment** from the paying bank account to the card. Both sides are created together and neither counts as income or spending. Both accounts must have an opening date on or before the repayment. If the paying account starts too late, the review names it and offers **Fix [account] opening balance** without losing your review edits. Check the balance before the earlier history rather than merely shifting a date. A later statement for the other account flags that entry as a possible duplicate: leave it unchecked. If a repayment was previously entered as an expense, delete that incorrect entry and record a linked transfer before importing it again.

Upload a card PDF from setup or the account page. The reader converts ordinary positive amounts owed into negative ledger balances, uses running balances where available, and recognises CR credits. Review the signs against the original because banks use different conventions. Positive card transactions are suggested as repayments unless the description indicates a refund; choose the paying account or change the type to Refund as appropriate. Recurring card purchases can be accepted as bills or subscriptions. The forecast includes these accepted charges; it does not assume a bank’s minimum payment or automatically pay the card. Check due dates and payment requirements on the statement.

## Importing PDF bank statements

Start from the statement option in Add account, or open an account and choose Upload statement. PDFs can contain multiple months; six-month statements are supported. Each upload can contain up to 20 MB, 500 pages and 10,000 transaction lines. Split larger statements into smaller PDFs. Password-protected files must be unlocked before uploading.

The local reader extracts all pages and uses text recognition for scans. For unfamiliar layouts, **Use AI to understand this bank’s layout** sends extracted text to the model selected in Settings → AI. It requires configured AI access. Email addresses and long numeric references are masked, but merchant names and financial details are included. The provider is requested to use no-retention processing. Leave it unchecked to keep extraction local.

1. **Opening balance:** check the opening balance and all source pages. An extracted opening balance is tied to the source; if none is found, enter it from your statement. Opening balances can be applied only to accounts without existing transactions. The inferred opening date is the earliest extracted transaction date, immediately before that transaction. You can move the opening date earlier, but an extracted opening amount remains tied to the PDF. The opening date must include the earliest selected transaction, even when that date is before the printed statement period. Existing account history is preserved.
2. **Review transactions:** inspect the readable transaction cards and categories. Twenty rows appear per page; descriptions wrap in full and edits remain when paging. Spending initially belongs to the account owner. Select **+ Create category** from the category dropdown to create and select a category or subcategory without leaving the review. Suggestions use merchant rules, previous activity and common merchants; the optional AI reader also suggests categories. Mark refunds and transfers correctly. Possible duplicate payments are initially excluded; include a genuine repeat only after checking it. Source amounts and dates cannot be edited into different financial records during confirmation.
3. **Recurring suggestions:** choose each bill, subscription or income pattern you want to track. Nothing is accepted by default. Patterns tolerate changing payment references and occasional missing periods. Two well-spaced payments from a recognisable recurring provider can also appear as a possible pattern; check these carefully. Review the expected amount, frequency, next date and category. Variable payments use the median amount as a suggestion. Only selected patterns are saved, starting in the future.
4. **Confirm:** check the selected/excluded totals and explicitly accept the review. Opening balance, transactions and recurring items are saved together. A failed confirmation leaves them unchanged. Repeating confirmation of the same file cannot duplicate its entries.

No PDF reader can guarantee every layout or scan. Open **Source & reading notes** for the original text and reading notes. Highlighted source lines, invalid dates or a closing-balance mismatch require attention. Compare the original PDF; do not accept an incomplete extraction. Re-export a clearer PDF, try the optional AI reader, or use the bank’s CSV export. For dates without a printed year, specify the statement year only when it is unambiguous; a statement spanning New Year needs clear transaction years.

Uploaded PDFs are private to signed-in household members. Find the original download and a pending review under the account’s Statements tab. Once the PDF upload finishes, processing continues in the background even if you navigate away or close the app. The Statements tab shows Queued, Reading PDF pages, Analysing transactions, Ready to review or Needs attention. Use View progress to reopen a pending job. Failed jobs keep their PDF and offer Try again; completed PDF reviews remain saved for later. No financial records change before you accept the review. An account is created before the optional statement upload, so cancelling setup leaves an empty account you can revisit.

## Importing bank CSV files
Export your transactions as a CSV from your bank and add the account first. Open the account and choose **Upload CSV**, beside **Upload statement**. The account is already selected. You can also use **Import CSV** on Transactions and choose the account there.

1. **Upload:** choose a file up to 5 MB and 10,000 transaction rows. Comma, semicolon and tab-separated exports are supported. The app detects whether the first row contains column names. Check **First row contains column names** and change it if needed; headerless files use Column 1, Column 2 and so on, preserving the first transaction. Check the sample includes your first transaction. Files with headers need a unique, non-empty name for each column.
2. **Map columns:** date, description and amount columns are prefilled where possible without requiring AI. Check every suggestion against the sample. Choose a signed amount column, or clear it and choose separate positive debit and credit columns. Negative amounts normally mean money out. If your bank uses positive amounts for spending, select **Reverse amount signs**. Select the exact date format; ambiguous dates default to Australian day/month/year. A wrong format can change dates even when they look valid. If present, map **Running balance (optional)** to the balance after each transaction; headerless amount/balance columns can be suggested when their running totals reconcile.
3. **Review & approve:** choose **Review transactions**. Categories are filled automatically using your merchant rules, previous transactions and recognised merchants, just like PDF statements. Review or change these suggestions. Check the target account, dates, amounts and selected money-in/money-out totals. Change an amount or date through **Change mapping**, then preview again. Invalid rows are excluded; possible duplicates start excluded. Select a legitimate duplicate only after checking it. You can deselect any other row you do not want to import.

**Check your balance** shows the file’s date coverage, source/selected/excluded row counts and projected app balance at the end of the file. A verified running-balance column also supplies the bank’s opening and closing balances. A difference requires acknowledgement before approval; check missing earlier exports, excluded/duplicate rows and the account opening balance first. A bank export can contain only a recent portion of the history you requested. The app never invents missing transactions or silently changes the account’s opening balance.

Mark positive refunds with Refund and the original expense category. Mark transfers and credit-card repayments with Transfer, and select the other tracked account; both entries are created together. A later CSV from that other account flags the matching amount/date as a possible duplicate.
Edit descriptions, categories and owner labels as needed. **Approve & import** saves only the selected valid transactions. No transactions are saved during upload or mapping. **View account** returns to the updated activity. CSV reviews are temporary; if you leave before approving or the preview expires after 24 hours, upload the file again.

Approving the same file again will not duplicate its transactions. The approved mapping is remembered for the account and suggested for later compatible exports. A different layout receives fresh suggestions. CSV imports do not change your opening balance or create recurring schedules; check the account’s opening date and balance cover the imported history.

## Optional AI suggestions
Open **Settings → AI** (More → Settings → AI on mobile). An administrator pastes the **OpenRouter API key**, chooses an **AI model**, then selects **Save AI settings**. Get a key using the OpenRouter link beside the field. The saved key is encrypted and never displayed again; leave the field blank to keep it, or paste a replacement. **Check key** checks whether OpenRouter accepts the entered or saved key without sending financial data or running the selected model. Model availability and credits are checked when you request suggestions. **Remove saved key** removes the key entered here; if the app owner configured a server key, that key is used again. OpenRouter charges usage to your OpenRouter account.
AI can suggest column mappings and categories. Redacted sample descriptions and CSV samples are sent to OpenRouter when you request suggestions.
Amounts and dates always come from your CSV. AI cannot commit an import or overwrite a chosen category.
Review every suggestion. If AI is unavailable, finish the import manually.

CSV category suggestions run in batches of 25 with visible progress. A failed batch is retried once; **Retry suggestions** resumes unfinished work while retaining completed suggestions and all source rows. Uncertain, unknown or incompatible category suggestions remain uncategorised; valid suggestions in the same batch are kept. You can review them manually and approve without AI. AI suggestions never remove transactions or change their dates and amounts. A category failure cannot itself explain a balance difference. If AI requests are temporarily limited, wait a minute before retrying; you can still approve your reviewed transactions.

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

Use the separate **Assets & Liabilities** page to add dated valuations for property, investments, superannuation, vehicles or debts not already represented by an account. Reach it from the sidebar, Net Worth, or More on mobile. Open any asset or liability for its own page: current value or amount owed, change since the first entry, a value-history graph, and all dated entries. Update value adds a dated valuation; edit or delete a past entry from its history. The graph holds each recorded value until the next valuation and excludes future entries from current value.
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

## Expense reports

Open **Expenses** to review spending by category, account or person. Use This month, This year or All history, then refine the dates, account, person and category. A parent category filter includes its subcategories; the category breakdown shows each actual category separately. The summary shows Net expenses and Spending. Refunds reduce net expenses, and transfers and income are excluded. Household spending stays under Household rather than being split between people. The report includes monthly totals and the matching transactions. Archived categories and accounts remain available for historical reporting.

To review recurring items from a statement already imported, open its account → Statements → View. **Recurring items from this statement** offers patterns supported by the posted transactions, excluding providers already tracked. Select the ones you want and choose **Accept recurring items**. This adds future schedules without importing the statement's transactions again.

Click any category, account or person in the Expenses breakdown to open its detail view. It keeps your selected dates and filters, shows spending and refunds, and lists the matching transactions newest first. The trend shows daily totals for periods up to 62 days and monthly totals for longer periods, including zero-spend periods. View trend values provides the numbers behind the chart. Category rows show transactions assigned to that exact category; choose a parent category in the report filter to include its subcategories. Close the detail view to return to the same report.

In Add/Edit category, click the small colour dot to choose a colour. The dot also supports keyboard navigation.
