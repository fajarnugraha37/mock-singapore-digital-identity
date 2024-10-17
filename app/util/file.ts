import { resolve } from '@std/path';
import { existsSync } from '@std/fs';
import { Buffer } from 'node:buffer';


const decoder = {
    utf8: new TextDecoder('utf-8'),
    utf16: new TextDecoder('utf-16'),
};

export function readFileAsByte(path: string): Uint8Array {
    const actualPath = resolve(Deno.cwd(), path); 
    if(existsSync(actualPath)) {
        return Deno.readFileSync(actualPath);
    }
    
    throw new Deno.errors.NotFound('File ' + path + ' is not exists');
}

export function readFileAsBuffer(path: string): Buffer {
    const data = readFileAsByte(path);

    return Buffer.from(data);
}

export function readFileAsUtf8(path: string): string {
    const data = readFileAsByte(path);
    return decoder.utf8.decode(data);
}