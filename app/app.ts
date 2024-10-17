import "@app-config/index.ts";
import { Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { readFileAsUtf8 } from "@app-util/index.ts";
import { getConsentHandler, getMyInfoHandler, getNDIV2Handler, getSPCPHandler, getSgIdHandler } from "./handlers/index.ts";


export const App = constructApp();

function constructApp() {
    const app = new Hono();

    registerStaticHandler(app);
    registerIndexHandler(app);
    registerServiceHandler(app);

    return app;
}

function registerServiceHandler(app: Hono) {
    app.route('/', getConsentHandler({ isStateless: false}));
    app.route('/', getMyInfoHandler());
    app.route('/', getNDIV2Handler());
    app.route('/', getSPCPHandler());
    app.route('/', getSgIdHandler());
}

function registerIndexHandler(app: Hono) {
    app.get('/', (c) => {
        return c.html(readFileAsUtf8('static/resources/index.html'));
    });
    app.get('/ping', (c) => c.json({
        message: 'Pong: ' + Date.now(),
    }));
}

function registerStaticHandler(app: Hono) {
    app.use(
        '/resources/*', 
        serveStatic({ 
            root: './static/resources', 
            rewriteRequestPath: (path: string) => path.replace('/resources/', '/'),
            onFound: (_path, c) => {
              c.header('Cache-Control', `public, immutable, max-age=31536000`);
            },
            onNotFound: (path, c) => {
                console.log(`${path} is not found, you access ${c.req.path}`)
            },
        }),
    );
    app.use(
        '/favicon.ico', 
        serveStatic({ 
            root: './static',
            onFound: (_path, c) => {
              c.header('Cache-Control', `public, immutable, max-age=31536000`);
            },
            onNotFound: (path, c) => {
                console.log(`${path} is not found, you access ${c.req.path}`)
            },
        }),
    );
}