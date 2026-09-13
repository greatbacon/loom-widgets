#!/usr/bin/env bash
set -euo pipefail

docker-entrypoint.sh postgres &
PG_PID=$!

until pg_isready -h localhost -U "${POSTGRES_USER}" >/dev/null 2>&1; do
  sleep 1
done

mkdir -p /opt/keycloak/data/import
envsubst '${REALM_NAME} ${CLIENT_ID} ${CLIENT_SECRET} ${REDIRECT_URIS} ${POST_LOGOUT_REDIRECT_URIS} ${DEV_USER_USERNAME} ${DEV_USER_PASSWORD} ${DEV_USER_ROLES}' \
  < /opt/keycloak-dev/realm-template.json \
  > /opt/keycloak/data/import/realm.json

/opt/keycloak/bin/kc.sh start-dev --import-realm --http-port=8080 &
KC_PID=$!

wait -n "$PG_PID" "$KC_PID"
