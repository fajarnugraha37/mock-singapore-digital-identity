export {}

declare global {
    interface Entry {
        [key: string]: unknown;
    }
    
    interface MaxAgeEntry extends Entry {
        maxAge: number;
    }    
}