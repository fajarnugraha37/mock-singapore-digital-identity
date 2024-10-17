import * as log from '@std/log';
import { format } from '@std/datetime';

log.setup({
    handlers: {
        default: new log.ConsoleHandler('DEBUG', {
            formatter: log.formatters.jsonFormatter,
            useColors: false,
        }),
        console: new log.ConsoleHandler('DEBUG', {
            formatter: log.formatters.jsonFormatter,
            useColors: false,
        }),
        file: new log.FileHandler('DEBUG', {
            mode: 'a',
            bufferSize: 4096,
            filename: `./logs/log-${Date.now()}.log`,
            formatter: (record) => `${format(record.datetime, 'yyyy-MM-dd HH:mm:ss.SSS', { timeZone: 'UTC' })} [${record.levelName}] ${record.loggerName} ${JSON.stringify(record.args)}`,
        }),
    },

    loggers: {
        default: {
            level: 'DEBUG',
            handlers: ['console', 'file'],
        },
        info: {
            level: 'INFO',
            handlers: ['console'],
        },
        error: {
            level: 'ERROR',
            handlers: ['console', 'file'],
        },
    },
});