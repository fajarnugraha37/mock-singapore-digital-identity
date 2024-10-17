# [WIP] Deno mock-singapore-digital-identity
A mock Singpass/Corppass server for development purposes

## Quick Start

### Configuring the Identity Provider
```
$ export APP_PORT=80
$ export SHOW_LOGIN_PAGE=false
$ export MOCKPASS_NRIC=S8979373D
$ export SERVICE_PROVIDER_MYINFO_SECRET=<your secret here>
$ export ENCRYPT_MYINFO=false
$ export SP_RP_JWKS_ENDPOINT=http://localhost:8080/oauth2/jwks
$ export CP_RP_JWKS_ENDPOINT=http://localhost:8080/oauth2/jwks

$ run -A main.ts
```
### Singpass v2 (NDI OIDC)

### Corppass v2 (Corppass OIDC)

### MyInfo v3

## Integration Details
The following things are needed to be configured for the integration:
* Exposing the signature and encryption public keys via a JWKS endpoint
* Use `private_key_jwt` client authentication with the `aud` claim set to the `iss` value and the `typ` header set to `JWT`
* ID token needs to be decrypted with the private decryption key and signature verified against the Identity Provider's JWKS endpoint

### Json Web Key Sets
Mockpass will call the endpoint http://localhost:8080/oauth2/jwks in order to get the public keys of the application
* The public encryption key used for Mockpass to encrypt the ID Token to send to the application
* The public verification key used for Mockpass to verify the signature for the `private_key_jwt` client assertion

## Flow

```mermaid
sequenceDiagram
    autonumber

    participant User
    participant Browser
    participant Application Server
    participant Mockpass

    User->>Browser: Navigate to user information page

    Browser->>Application Server: Send request for user information page (/login-user)

    Application Server->>Application Server: Not authenticated, determine provider to redirect to

    Application Server-->>Browser: Redirect to Application for Mockpass provider

    Browser->>Application Server: Send request for Mockpass provider (/oauth2/authorization/mockpass)

    Application Server->>Application Server: Generate Authorization Request

    Application Server-->>Browser: Redirect to Mockpass with Authorization Request

    Browser->>Mockpass: Send Authorization Request (/singpass/v2/authorize)

    Mockpass->>Mockpass: Generate login page

    Mockpass-->>Browser: Return login page

    User->>Browser: Enter login credentials and sign in

    Browser->>Mockpass: Send login credentials 

    Mockpass->>Mockpass: Process login credentials

    Mockpass-->>Browser: Redirect to Application with Authorization Response with code

    Browser->>Application Server: Send Authorization Response with code (/login/oauth2/code/mockpass)

    Application Server->>Application Server: Generate Token Request and client credentials

    Application Server->>Mockpass: Send Token Request with client credentials (/singpass/v2/token)

    Mockpass->>Application Server: Send request for client json web key set (/oauth2/jwks)

    Application Server-->>Mockpass: Return client json web key set

    Mockpass->>Mockpass: Process client credentials and create tokens

    Mockpass-->>Application Server: Return Token Response with access and id tokens

    Application Server-->>Browser: Redirect to user information page

    Browser->>Application Server: Send request for user information page (/login-user)

    Application Server->>Application Server: Authenticated

    Application Server-->>Browser: Return user information page
```