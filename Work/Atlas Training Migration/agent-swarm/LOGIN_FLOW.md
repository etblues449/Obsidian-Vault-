# Atlas Login Flow (Azure AD B2C)

Captured live via Playwright on 2026-06-10. The portal redirects unauthenticated
users to a Microsoft **Azure AD B2C** sign-in. Screenshot:
`portal-captures/atlas-login.png`.

> Needed by the swarm to reach an authenticated state. **Credentials are never
> stored here or given to agents** — a human establishes the session; agents
> inherit it.

## Entry point
- App URL (deep link): `https://hrhs.atlas-hub.co.uk/o/9892b03b-455e-4b80-8490-a76073576d96/employee/manage`
- Redirects to auth host: `https://auth.atlas-hub.co.uk/atlashub.onmicrosoft.com/b2c_1a_rest_signup_signin_auth/oauth2/v2.0/authorize?...`
- Auth type: Azure AD B2C (OAuth2 PKCE, `response_type=code`, MSAL.js 3.21.0)
- `client_id=86bf93bb-2d13-4286-a9a7-606c2a0e95b8`, `redirect_uri=https://hrhs.atlas-hub.co.uk`

## Step 1 — Username (CONFIRMED selectors)
- Form: `#localAccountForm`
- Username/email input: **`#signInName`** (placeholder "Enter username", aria-label "Username/Email")
- Submit: **`#next`** (text "Continue")
- Playwright:
  ```js
  await page.fill('#signInName', USERNAME);
  await page.click('#next');
  ```

## Step 2 — Password (EXPECTED — confirm on real login)
Standard B2C self-asserted layout after Continue:
- Password input: likely **`#password`**
- Submit: likely **`#next`** (or `#continue`)
- "Any difficulties logging in?" / forgot-password link present on step 1.
  ```js
  await page.fill('#password', PASSWORD);   // CONFIRM id
  await page.click('#next');                // CONFIRM id
  ```

## Step 3 — MFA (EXPECTED — confirm on real login)
Tenant almost certainly enforces MFA (email/SMS/authenticator code). Selectors
unknown until observed. **This is the hard blocker for headless automation** —
MFA needs a human. Practical options:
- Human logs in once; agents reuse the authenticated browser context
  (`storageState`) until it expires.
- Or run agents as "assisted" — human present to clear MFA when prompted.

## Post-auth
- On success, B2C returns a code to `redirect_uri` (`response_mode=fragment`),
  MSAL exchanges it for tokens, app lands back on
  `…/employee/manage`. Capture that page's DOM next (needs auth).

## Security notes
- No credentials in repo / agent prompts / logs.
- Reuse a human-established session (`storageState`) rather than scripting the
  password+MFA. Treat the session token as a secret; never commit it.
- Reaching this site at all required trusting the environment's egress
  TLS-inspection CA in Chrome — that's a container detail, not part of the real
  runbook.
