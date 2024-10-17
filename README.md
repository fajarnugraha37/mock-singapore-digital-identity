# Deno mock-singapore-digital-identity
A mock Singpass/Corppass server for development purposes

## Quick Start

## Run App
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