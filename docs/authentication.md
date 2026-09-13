# Authentication

## Local Solution
Loom relies on a local Postgresql DB with an accounts table for initially managing accounts

You can
- Sign up for an account via the /signup route
- Sign in to existing accounts via the /signin route

In general though this flow will be deprecated in favor of assuming a prior existing SSO/Auth provider that can be integrated with via OIDC.

It will assume the existance of at least one user with the role of `founder` to assign the initial admin role to.

## SSO & OIDC

Loom also supports signing in via [Keycloak](https://github.com/keycloak/keycloak), side-by-side with the local username/password flow above (for now).

Ideally it will be compatible with any OAuth2/OIDC provider, but we're starting with a Keycloak integration since that's what we use.

The Keycloak flow is a server-side OIDC Authorization Code + PKCE exchange, handled entirely in `src/hooks.server.ts` and `src/routes/auth/`:

- `/auth/keycloak/login` starts the flow
- `/auth/keycloak/callback` exchanges the authorization code for tokens, then sets a `kc_session` cookie 
- `/auth/logout` clears both the local `session_id` cookie and the `kc_session` cookie; 
- `hooks.server.ts` authenticates a request if *either* a valid local `session_id` cookie *or* a valid, non-expired `kc_session` cookie is present.

### Configuration

The Keycloak integration is configured via env vars (see `.env.example`):

- `OIDC_URL` — the realm's issuer URL, e.g. `https://localhost:8080/realms/loom`
- `OIDC_CLIENTID` / `OIDC_SECRET` — the confidential client's ID and secret
- `OIDC_SCOPES` — space-separated OIDC scopes to request (defaults to `openid`)
- `COOKIE_KEYS` — three `__`-delimited, random secrets in order of newest to oldest) used to derive the encryption key for the `kc_session` and `kc_oauth_state` cookies.

`OIDC_DISABLE_PASSWORD` is declared but not yet wired up — the local password flow always stays on regardless of its value.

### Current scope

Loom would eventually like Keycloak to cover involves:

- Managing user account creation (i.e. invites) & upkeep
- Managing user roles