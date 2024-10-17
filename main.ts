import * as log from "@std/log";
import { App } from './app/app.ts';


Deno.serve({ 
  port: 80,
  onListen: (addr) => log.info('App listening on ', addr)
}, App.fetch);