#!/bin/bash

SHOW_LOGIN_PAGE=true
APP_PORT=5156
SP_RP_JWKS_ENDPOINT="http://localhost:8080/oauth2/jwks"
CP_RP_JWKS_ENDPOINT="http://localhost:8080/oauth2/jwks"

echo "Initializing process..."
deno run -A main.ts