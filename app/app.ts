import './config/index.ts';
import { Hono } from 'hono';
import { serveStatic } from 'hono/deno';


export const App = constructApp();

function constructApp() {
    const app = new Hono();

    app.use(
        '/public/*', 
        serveStatic({ 
            root: './static', 
            precompressed: true,
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
            root: './static/favicon.ico',
            onFound: (_path, c) => {
              c.header('Cache-Control', `public, immutable, max-age=31536000`);
            },
            onNotFound: (path, c) => {
                console.log(`${path} is not found, you access ${c.req.path}`)
            },
        }),
    );
    app.get('/', (c) => c.text('Hello Deno!'));

    return app;
}