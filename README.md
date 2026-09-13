# Loom-app

This is the core template that drives Loom's programmable social platform applications.

It provides the core styling & OAuth2 integrations, as well as a DB migrations framework.

## Developing

Before you start developing, you'll first need to make sure you have a keycloak instance & postgres to work with locally.

You'll need to make sure you have docker (or other containerization tools) are installed on you system.

To test locally with a running Keycloak instance & Postgres DB, use

```sh
docker compose up -d
```
Then follow the instructions below for setting up Keycloak sign-in locally

Once you've cloned the project and installed dependencies with `npm install` start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Make a copy of the .env.example file to have local env variables setup. The defaults should work with the docker-compose stack.

Run
```sh
npm run db:migrate
```
to get your DB schema up to date.




### Setting up Keycloak sign-in locally

`docker compose up -d` brings up a fully configured Keycloak instance — the `loom` realm, the `loom-app` confidential client, and a seed user are created automatically by the `ghcr.io/getloom/keycloak-dev` image.

1. `docker compose up -d`
2. Copy `.env.example` to `.env` — the defaults already match the seeded client's secret.
3. Sign in with the seed account: username `founder`, password `founder` (has the `founder` realm role, used for initial admin testing).
4. To customize the realm name, client, redirect URIs, or seed user (e.g. for a different `getloom` project), set the corresponding environment variables on the `keycloak` service in `compose.yaml` — see `docker/keycloak-dev/README.md` for the full list.


## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

To build a test docker image, run

```sh
npm run build:image
```

And then test it runs with

```sh
docker run -p 3000:3000 loom-app
```

To test that it runs properly alongside keycloak you can use

```sh
docker compose up
```

## Production

Loom utilizes Docker, docker-compose, & the OCI format for production deployments.

Once you've built your image, you can use the following command to test a full production stack locally.

We recommend following this guide for getting set up on Docker: https://linuxiac.com/how-to-install-docker-on-linux-mint-21/

```
docker compose up
```

## Dependencies

Keycloak

Postgresql
