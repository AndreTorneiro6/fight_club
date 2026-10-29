# Fight Club security remediation — 29 October 2026

Source: the confidential Fight Club slice of the 27 October Strix report (nine findings). Original report remains separate; this document contains no credentials or live exploit data.

| Finding | Root fix | Verification |
|---|---|---|
| 1 — chat email/WhatsApp phishing | All challenge-chat branches use push-only metadata, including ordinary messages and administrator notices. Existing account-only email setting remains off for league mail. | Engine regression covers both authors and no mentions; existing mention/outbox tests retained. |
| 2 — photo authorization/adoption | Unpublished uploads require uploader or administrator access. Other league accounts can read only active approved published avatars. New self-service photo references must belong to the caller; unchanged administrator-assigned references remain usable. Check runs in the mutation transaction; reads use no-store. | Mongo integration and browser PoCs deny unpublished read/adoption, permit own upload and approved publication. |
| 3 — division capacity exhaustion | Pending registrations no longer consume approved capacity. Queue bounded to 100 per division, existing source/email limits retained. Approval and direct/invited entry enforce approved capacity. Verification delivery failure does not turn a committed registration into HTTP 500. | Mongo regression creates pending accounts in a full division, rejects approval, allows exactly one when capacity increases, rejects the next. |
| 4 — victim login lockout | Removed submitted-email login bucket; source-address and global endpoint limits remain. | Browser submits eleven wrong passwords then successfully signs in the victim from another source. |
| 5 — spreadsheet formula injection | Shared cell helper neutralizes dangerous prefixes and leading whitespace/control characters for CSV/XLSX exports. | Actual ExcelJS CSV serialization tested. Roster contacts remain available only through the existing administrator-authorized export, required for club administration. |
| 6 — abandoned challenge blocks round | Expired challenges owe no result. Pending/accepted/played games still block until resolved. A published round containing only expired challenges can close with zero invented results; a genuinely empty round cannot. | Existing transition suite plus mixed/only-expired regressions. |
| 7 — vacation after played match | All result freeze checks use the scheduled match date and all participating members, including leapfrog protection. | Regression records either winner during a later vacation; existing vacation/ranking tests retained. |
| 8 — registration enumeration | Production duplicate and fresh submissions return the same HTTP 200 acknowledgement; demo-mode conflict UX retained only for disposable demonstrations. | Browser uses production auth mode on disposable seeded database and compares complete status/body. |
| 9 — sibling reset tokens survive | Password change atomically removes all older reset/invite/verification tokens for the address and revokes sessions, retaining single-use check. | Browser redeems one link, rejects the sibling link and verifies the previous session is revoked. |

Verification uses disposable Mongo replica sets and browser accounts. No production messages, results, passwords or rankings were changed for these PoCs. No paid Strix rerun was launched; these are direct regression/PoC checks, not a new full Strix assessment.

Infrastructure: both applications use separate scoped users/databases on one private Mongo replica set; application containers do not inherit backup/root credentials. Full shared-database backups retain the administrative URI only in the backup service. Daily host updates/reboot run at 03:00 Europe/Lisbon with a fresh backup and post-boot container health verification.

Release1.11.9 is live at `c303f534df07c56fc98a7d765404fdde380d39bd`. GitHub run40848541115 passed all checks and Pi deployment:477 tests, typecheck, build and browser regressions. Both applications and the private shared Mongo remained healthy after deployment.
