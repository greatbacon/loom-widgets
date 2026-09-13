# getloom/keycloak-dev

A single-container Keycloak + Postgres dev image. On first boot it imports a realm
pre-populated with the Loom platform's role model (`founder`, `member`, `mentor`,
`steward`, `leader`, etc.) plus a confidential client and a seed user — no manual
admin-console setup required.

This image is built from source in `loom-app` (`docker/keycloak-dev/`) and published
to `ghcr.io/getloom/keycloak-dev` so other `getloom/*` projects can reuse it without
checking out `loom-app`.

## What's baked in vs. parameterized

The realm's roles, client scopes, and authentication flows are specific to the Loom
platform and are **not** configurable. What *is* configurable via environment
variables is the realm name, the client, and the seed user — so a different
`getloom/*` project can point at this same image with its own values and still
inherit the shared Loom role model.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `REALM_NAME` | `loom` | Name of the imported realm |
| `CLIENT_ID` | `loom-app` | Confidential client's client ID |
| `CLIENT_SECRET` | `dev-secret-changeme` | Confidential client's secret |
| `REDIRECT_URIS` | `["http://localhost:5173/*"]` | JSON array literal of the client's valid redirect URIs |
| `POST_LOGOUT_REDIRECT_URIS` | `http://localhost:5173/*` | Client's valid post-logout redirect URI(s) |
| `DEV_USER_USERNAME` | `founder` | Seed user's username |
| `DEV_USER_PASSWORD` | `founder` | Seed user's password |
| `DEV_USER_ROLES` | `founder` | Realm role assigned to the seed user |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | `admin` | Keycloak admin console username |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | `admin` | Keycloak admin console password |

`KC_DB_*` and `POSTGRES_*` variables are also set, but are internal-only — Postgres
is never exposed outside the container, and these are not meant to be overridden by
consumers.

## Persistence behavior

Keycloak's `--import-realm` flag skips importing a realm that already exists in the
database. Combined with a persisted volume mounted at `/var/lib/postgresql/data`,
this means:

- **First boot**: the realm, client, and seed user are all created.
- **Subsequent restarts**: existing state (including anything changed by hand in the
  admin console) is left untouched — the import is skipped.
- **`docker compose down -v`** (or otherwise removing the volume): gives a full
  reset back to a fresh import on next boot.

## Standalone usage

```sh
docker run -d -p 8080:8080 \
  -v keycloak_data:/var/lib/postgresql/data \
  -e REALM_NAME=my-project \
  -e CLIENT_ID=my-app \
  -e CLIENT_SECRET=my-dev-secret \
  -e REDIRECT_URIS='["http://localhost:3000/callback"]' \
  -e POST_LOGOUT_REDIRECT_URIS=http://localhost:3000/signin \
  -e DEV_USER_USERNAME=admin-test \
  -e DEV_USER_PASSWORD=admin-test \
  ghcr.io/getloom/keycloak-dev:main
```
