#!/bin/sh

echo 'booting up application'

echo 'running migrations first'

npm run db:migrate

echo 'starting node server'

node build
