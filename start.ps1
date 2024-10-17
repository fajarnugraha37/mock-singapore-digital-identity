Write-Host "Setting environment variables...";
$env:SHOW_LOGIN_PAGE="true";
$env:APP_PORT="5156";
$env:SP_RP_JWKS_ENDPOINT="http://localhost:8080/oauth2/jwks";
$env:CP_RP_JWKS_ENDPOINT="http://localhost:8080/oauth2/jwks";
Write-Host "Initializing process..."

deno run -A main.ts