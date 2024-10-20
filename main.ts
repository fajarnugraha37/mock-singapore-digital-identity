import "@deps";
import * as log from "@std/log";
import { App } from "@app";


Deno.serve({ 
  port: parseInt(Deno.env.get('APP_PORT') || '80'),
  onListen: (addr) => log.info('App listening on ', addr)
}, App.fetch);