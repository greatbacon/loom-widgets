ARG KEYCLOAK_VERSION=26.0.8
ARG JRE_IMAGE=eclipse-temurin:21-jre-jammy

FROM ${JRE_IMAGE} AS jre

FROM postgres:18

ARG KEYCLOAK_VERSION
ENV JAVA_HOME=/opt/java
ENV PATH="${JAVA_HOME}/bin:/opt/keycloak/bin:${PATH}"

COPY --from=jre /opt/java/openjdk ${JAVA_HOME}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gettext-base ca-certificates \
    && curl -fsSL "https://github.com/keycloak/keycloak/releases/download/${KEYCLOAK_VERSION}/keycloak-${KEYCLOAK_VERSION}.tar.gz" \
       | tar xz -C /opt \
    && mv "/opt/keycloak-${KEYCLOAK_VERSION}" /opt/keycloak \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY realm-template.json /opt/keycloak-dev/realm-template.json
COPY entrypoint.sh /opt/keycloak-dev/entrypoint.sh
RUN chmod +x /opt/keycloak-dev/entrypoint.sh

ENV KC_DB=postgres \
    KC_DB_URL=jdbc:postgresql://localhost:5432/keycloak \
    KC_DB_USERNAME=keycloak \
    KC_DB_PASSWORD=keycloak-internal \
    KC_BOOTSTRAP_ADMIN_USERNAME=admin \
    KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
    POSTGRES_DB=keycloak \
    POSTGRES_USER=keycloak \
    POSTGRES_PASSWORD=keycloak-internal \
    REALM_NAME=loom \
    CLIENT_ID=loom-app \
    CLIENT_SECRET=dev-secret-changeme \
    REDIRECT_URIS=[\"http://localhost:5173/*\"] \
    POST_LOGOUT_REDIRECT_URIS=http://localhost:5173/* \
    DEV_USER_USERNAME=founder \
    DEV_USER_PASSWORD=founder \
    DEV_USER_ROLES=founder

EXPOSE 8080
ENTRYPOINT ["/opt/keycloak-dev/entrypoint.sh"]
