# Orange Catalogue Pre-Publication Security Audit

**Audit date:** 16 August 2026  
**Repository reviewed:** `KangKimpor/orange-catalogue`  
**Current visibility:** Private  
**Decision:** **Do not make the repository public yet.** Complete the Priority 0 and Priority 1 work below first, then re-audit and change visibility only with explicit owner confirmation.

## Executive conclusion

The review found **no committed high-confidence API keys, access tokens, private keys, or literal Cloudinary/Supabase/JWT secrets** in the reachable repository history. Environment files and logs are ignored and are not tracked. The live Supabase project also has RLS enabled on every application table, with no policies; that is a deliberate deny-by-default posture for direct browser access with a publishable key. Supabase documents that an RLS-enabled table exposes no API data to a publishable key until a policy is created.[1]

However, the initial temporary admin password is still present in current documentation, tests, the historical checklist, and prior commits. If it has not already been changed through the admin Security workspace, it remains a credential that an attacker could use after the repository becomes public. The login endpoint also has no visible throttling or lockout control. In addition, the current **production** dependency tree reports **1 critical, 23 high, 49 moderate, and 10 low** advisories. Those must be reduced and regression-tested before treating the public source release as ready.

| Publication status | Meaning |
|---|---|
| **Blocked** | Rotate the live admin password; remove its literal from source and decide whether to rewrite private history before first public release. |
| **Blocked** | Remediate the critical and high production dependency findings, starting with unused direct dependencies and packages on the active server/import paths. |
| **Required hardening** | Add login rate limiting or an equivalent edge/WAF control before public source disclosure increases scrutiny of the admin endpoint. |
| **Not a blocker** | Supabase tables have RLS enabled and no policies; this denies direct publishable-key access and matches the current server-mediated data design. |

## Scope and methods

The audit covered the reachable `main`, `github/main`, and `origin/main` references; the current working tree; the committed serverless bundle; ignore rules; public-routing configuration; database migration and live RLS state; GitHub automation files; and the production dependency tree. The exact Cloudinary-variable matches in commits `9b13d02`, `1c392af`, and `ccbaf3c` were inspected in context without displaying any potential values.

The review used targeted history searches for common GitHub, AWS, Stripe, Slack, JWT, and PEM/private-key signatures. It also inspected the live Supabase project’s `pg_policies` and RLS flags. This is a focused engineering audit rather than a guarantee that no future or unknown credential pattern exists.

## Findings

### 1. Secret scanning and Git history — **pass, with one credential disclosure exception**

No `.env` file, log, archive, private key, GitHub token, AWS access key, Stripe live key, Slack token, or JWT literal was found in the reachable references. The committed server bundle reads the service-role key, Cloudinary secret, JWT signing key, and admin bootstrap password only through server-side environment variables. The Cloudinary hits in the three reviewed historical commits were `process.env.CLOUDINARY_API_SECRET` references used for upload signing; they did **not** contain a literal secret value.

The exception is the former temporary password. It appears in current `OPERATIONS.md`, `RELEASE_NOTES.md`, two test files, `todo.md`, and several historical commits. This is not an API key, but it is an actual initial credential and becomes sensitive if it is still active.

| Evidence | Result | Assessment |
|---|---|---|
| Reachable history / common credential signatures | No matches for the examined high-confidence secret patterns | Positive result, but not a substitute for continuous secret scanning. |
| `.env*` and logs | Correctly ignored; none tracked | Positive result. |
| Cloudinary history hits | Environment-variable references only | No Cloudinary secret was observed in the reviewed diff context. |
| Former temporary-password references | Present in current files and historical commits | **Priority 0 remediation required.** |

### 2. Admin authentication — **needs hardening before public release**

The admin session implementation has several sound controls: passwords are stored with a random salt and `scrypt`, comparisons are timing-safe, sessions are signed with `JWT_SECRET`, sessions expire after 12 hours, and the cookie is `HttpOnly`, `SameSite=Lax`, path-scoped, and marked `Secure` when `NODE_ENV=production`. Admin-only routes verify the signed session before returning stock, import, or media-signing data.

The public `admin.login` procedure accepts password attempts without a rate limit, failure counter, progressive delay, or temporary lockout. With a known weak bootstrap password, that is unacceptable. Even after rotation, rate limiting should be added because public source makes the endpoint and exact authentication flow easier to target.

| Finding | Risk | Required action |
|---|---|---|
| Initial password is publicly documented and historically committed | An unauthorised party could access `/admin` if it remains the active password | Change the password through the Security workspace **before** publication. Use a unique, randomly generated password of at least 16 characters. |
| No login-attempt throttle or lockout | Enables repeated online password guessing against `/api/trpc/admin.login` | Add a durable IP- and account-scope rate limit at the edge or through a shared store; return a generic failure message and add tests. |
| Historical initial-password text | Any future public clone can retain the old literal permanently | Remove current references. Before the first public release, optionally rewrite history to remove the literal; see the history decision below. |

### 3. Supabase and direct database access — **secure by default for the current architecture**

All nine catalogue/admin tables were verified live with RLS enabled: `admin_profiles`, `categories`, `colors`, `import_changes`, `imports`, `product_media`, `products`, `store_settings`, and `variants`. The live policy query returned no `public`-schema policies. The Supabase security advisor reports this as informational “RLS enabled, no policy” findings, but in this project it means the publishable key cannot directly read or write the tables. The public catalogue is served through the server, which uses the service-role key only on the server side.

> **Important:** Do not add broad `anon` SELECT policies merely to silence the advisor. That would change the design from server-mediated access to direct browser access. Service-role credentials bypass RLS and must never be browser-exposed.[1]

No database schema change is required solely for the public GitHub decision. Treat the no-policy state as intentional and document it for future maintainers.

### 4. Production dependencies — **Priority 1 remediation required**

`pnpm audit --prod` reported **83 vulnerabilities**: 1 critical, 23 high, 49 moderate, and 10 low. An advisory signals a vulnerable package path, not automatic exploitability in this particular application, but the report is from the production dependency tree and should not be ignored. Package audits calculate known vulnerable and meta-vulnerable dependency paths from the installed dependency graph.[2]

| Area | Current audit result | Code-use observation | Remediation direction |
|---|---|---|---|
| `fast-xml-parser` via `@aws-sdk/client-s3` | **1 critical** plus high findings | The direct S3 packages are not imported by Orange application source | Remove the unused S3 client and presigner packages, then re-run the audit. If retained for a future feature, upgrade them to a patched compatible release and test. |
| `xlsx` | High prototype-pollution and ReDoS advisories | Actively used for the authenticated POS import parser | Upgrade to a safe maintained version if available; otherwise replace or isolate the parser, cap upload size and processing time, and add adversarial import tests. |
| `@trpc/server`, `axios`, `express`, `nanoid`, `drizzle-orm` | High advisories | tRPC and Express are active; Axios is in framework SDK code; Drizzle appears to be legacy template code | Update compatible direct dependencies, remove unused template/database modules where possible, and test the production build plus admin/import flows. Express and Nanoid latest versions are major upgrades, so handle them deliberately. |
| `lodash`, `lodash-es`, `recharts`, `streamdown` dependency paths | High advisories | UI template components reference some of these, but they are not part of the customer storefront workflow | Remove unused template components/dependencies or upgrade their parents after confirming no active import path. |

At audit time, newer versions were available for direct packages including `@aws-sdk/client-s3`/presigner, `@trpc/server`, `axios`, `drizzle-orm`, `express`, and `nanoid`. Do not run a forced blanket upgrade. Update in a controlled change set, run `pnpm test`, `pnpm check`, `pnpm build`, then re-run `pnpm audit --prod`. The project’s POS parser is a high-value review target because it processes staff-supplied XLSX bytes.

### 5. Public-repository and deployment metadata — **mostly acceptable; one cleanup item**

There are no tracked GitHub Actions workflows, so no workflow log or artifact exposure was identified. The available GitHub credential could not enumerate Actions secret names (GitHub returned HTTP 403); this does not reveal a secret but means the audit cannot independently confirm the repository-level Actions-secret inventory. No tracked workflow exists that could print such a secret.

The Vercel project ID in `RELEASE_NOTES.md` is not a credential and is low risk, but it is unnecessary operational metadata. Remove it before publication to reduce avoidable reconnaissance detail. The current `vercel.json` contains only build and rewrite rules, with no token or secret.

Changing visibility makes all code and reachable history visible and permits anyone to fork it. GitHub also notes that existing Actions history and logs become public when a repository is made public.[3] Verify that no relevant Actions runs or artifacts exist in the GitHub interface before the visibility change.

## Remediation plan

### Priority 0 — complete before making the repository public

1. **Rotate the admin password now.** Sign in to `/admin`, open the Security workspace, and replace the initial password with a long unique password. Verify a fresh sign-in succeeds with the new password and fails with the old one. This stores a new derived hash in Supabase.
2. **Remove the former temporary password from the current repository.** Replace documentation with a neutral statement such as “configure an initial password through the environment; change it immediately after first access.” Change tests to use a test-only environment variable or an unguessable fixture constant. Redact the retained historical checklist line without deleting the history entry.
3. **Decide on history rewriting before the first public release.** Once the live password is rotated, rewriting is not essential to revoke the credential. However, because the repository is still private, this is the cleanest time to remove the weak password from all 23 private commits with `git filter-repo` or BFG, force-push the cleaned `main`, and verify there are no collaborators who need to re-clone. Do **not** make it public first—public copies and forks cannot be recalled.
4. **Remove unused direct S3 dependencies and address the high/critical production audit paths.** Re-run the audit after each controlled update/removal; do not change repository visibility while the critical result remains.

### Priority 1 — complete in the same remediation release

1. Implement a durable rate limit for admin login attempts and add tests for throttling and recovery.
2. Cap the POS import body size and parser workload; add malicious-workbook regression cases that confirm the endpoint rejects oversized or malformed data safely.
3. Remove the Vercel project ID from release notes and keep only the public production URL.
4. Enable or verify GitHub secret scanning, push protection, dependency alerts, and Dependabot for the repository after it is public.

### Priority 2 — ongoing controls

1. Keep `.env*`, generated logs, credentials, and deployment exports ignored. Review staged files with `git diff --cached` before every push.
2. Add a CI workflow that runs type checking, tests, a production build, and `pnpm audit --prod --audit-level high`. Ensure the workflow never prints environment variables.
3. Re-run the Supabase security advisor after schema changes. Preserve RLS on all exposed tables; add narrowly scoped policies only if the application intentionally moves a query to the browser.

## Recommended release order

| Step | Owner action | Acceptance condition |
|---|---|---|
| 1 | Rotate `/admin` password | Old password fails; new password succeeds in a fresh session. |
| 2 | Remove the former password and Vercel ID from current files | `git grep` finds neither the former credential nor unnecessary project ID. |
| 3 | Clean unused dependencies and update/replace vulnerable active paths | `pnpm audit --prod` has no critical findings and the remaining advisories are reviewed and accepted in writing. |
| 4 | Add login throttling and parser limits | Automated tests cover rejection and recovery paths. |
| 5 | Optionally rewrite private history | Full-history scan finds no former temporary credential; collaborators have re-cloned. |
| 6 | Re-run this audit | Tests, type check, production build, dependency audit, secret scan, and Supabase RLS checks pass. |
| 7 | Change GitHub visibility | Owner explicitly confirms the repository-public action after reviewing GitHub’s visibility consequences.[3] |

## Final recommendation

The repository is **not ready to be public today** because the known weak admin credential is disclosed and the production dependency audit has unresolved critical/high findings. The good news is that the core secret boundary is sound: no actual service secrets were found in the reachable history, the Supabase browser path is deny-by-default, and server-only values are read from environment variables.

After the Priority 0 and Priority 1 remediation release and a clean re-audit, making the GitHub repository public can be a reasonable choice. The visibility change itself should remain an explicit owner-confirmed action.

## Remediation update — 16 August 2026

The current working tree has now been remediated without changing the owner’s active admin password. Documentation, tests, and retained checklist wording no longer reproduce the former setup credential, and the unnecessary Vercel project identifier has been removed. The repository’s reachable **history** still contains the former credential, so the repository must remain private until the owner explicitly approves a history rewrite and the public-visibility change.

The server now applies a durable Supabase-backed login limit per HMAC-protected client identifier: five failed attempts within 15 minutes trigger a 15-minute block. It returns generic failed-sign-in messaging, does not store raw client addresses, and clears the limit on a successful sign-in. The POS import boundary now limits JSON request bodies to 8 MB, accepts a maximum 5 MB decoded workbook, verifies base64 input before parsing, and rejects workbooks with more than three worksheets or 5,000 rows.

All inactive S3, charting, and AI-template dependency paths were removed. Active tRPC, Axios, Express, Nanoid, and Drizzle versions were upgraded; Express wildcard routes were updated for the new routing syntax. The obsolete npm `xlsx` package was replaced with SheetJS’s current official CDN distribution (`xlsx` 0.20.3), whose distribution guidance states that Node releases from 0.18.6 onward are served from the official CDN.[4] The final production dependency audit reported **0 critical, 0 high, 0 moderate, and 0 low** findings. The full test suite passed with 29 tests, TypeScript and production build passed, and the current-tree disclosure rescan found no former credential or Vercel project identifier.

The active password remains unchanged at the owner’s explicit direction. That is the only material public-release blocker that cannot be completed automatically, alongside the still-required historical cleanup and the owner-confirmed GitHub visibility action.

## Publication completion update — 16 August 2026

The owner subsequently changed the active shared admin password through the Security workflow. The minimum-length rule was lowered to four characters at the owner’s explicit request, while the previously added sign-in rate limit remains active. The new credential was verified in a clean session, and the former credential was rejected. A retained-file scan covering the project, generated deployment artifact, local logs, and local browser-upload captures found no occurrence of the new credential.

The private Git history was then rewritten with `git filter-repo`; all 26 reachable commits were scanned clean for the former setup credential before the rewritten `main` branch was force-pushed to GitHub. GitHub now confirms that `KangKimpor/orange-catalogue` is **public**. The production dependency audit remains clean with no critical, high, moderate, or low findings, and the final validation suite reports 30 passing tests.

## References

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"
[2]: https://docs.npmjs.com/cli/v10/commands/npm-audit "npm audit documentation"
[3]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility "GitHub: Setting repository visibility"
[4]: https://cdn.sheetjs.com/xlsx/ "SheetJS XLSX migration guidance"
