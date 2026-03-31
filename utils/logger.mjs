import {
    GREEN,
    RED,
    RESET,
    YELLOW,
    BLUE,
    MAGENTA,
    CYAN,
    GRAY
} from '../config/constants.mjs';

/** Shallow clone and redact common secret fields from request bodies in logs. */
const sanitizeBodyForLog = (body) => {
    if (!body || typeof body !== 'object') return body;
    if (Array.isArray(body)) return body;
    const sensitive = new Set(['password', 'oldpassword', 'newpassword', 'token', 'otp', 'refreshtoken']);
    const out = { ...body };
    for (const k of Object.keys(out)) {
        if (sensitive.has(k.toLowerCase())) out[k] = '[redacted]';
    }
    return out;
};

const redactSensitive = (key, value) => {
    const k = String(key).toLowerCase();
    if ((k === 'authorization' || k === 'cookie' || k === 'set-cookie') && typeof value === 'string') {
        return value.length > 14 ? `${value.slice(0, 10)}…[redacted]` : '[redacted]';
    }
    return value;
};

const safeStringify = (obj) => {
    try {
        return JSON.stringify(obj, (key, value) => {
            const v = redactSensitive(key, value);
            if (typeof v === 'object' && v !== null) {
                if (key.length > 0 && obj !== value && typeof obj[key] === 'object' && obj[key] !== null) {
                    return '[Circular]';
                }
            }
            return v;
        }, 2);
    } catch (e) {
        return '[Object could not be stringified due to error]';
    }
};

export const logger = (isDetailed = false) => (req, res, next) => {
    const timestamp = new Date().toISOString();
    const separator = "==================================================";

    if (isDetailed) {

        console.log(`\n${RED}${separator}${RESET}`);
        console.log(`${MAGENTA}--- DETAILED REQUEST LOG (Timestamp: ${timestamp}) ---${RESET}`);
        console.log(`${RED}${separator}${RESET}`);

        console.log(`${YELLOW}Method:${RESET} ${req.method}`);
        console.log(`${YELLOW}Path:${RESET} ${req.originalUrl}`);
        console.log(`${YELLOW}IP Address:${RESET} ${req.ip || 'N/A'}`);

        console.log(`\n${BLUE}HEADERS:${RESET}`);
        console.log(safeStringify(req.headers));

        console.log(`\n${BLUE}QUERY PARAMS:${RESET}`);
        console.log(safeStringify(req.query));

        console.log(`\n${BLUE}ROUTE PARAMS:${RESET}`);
        console.log(safeStringify(req.params));

        console.log(`\n${BLUE}BODY:${RESET}`);
        console.log(safeStringify(sanitizeBodyForLog(req.body)));

        if (req.user) {
            console.log(`\n${CYAN}AUTHENTICATED USER:${RESET}`);
            console.log(safeStringify(req.user));
        }

        console.log(`\n${RED}${separator}${RESET}\n`);

    } else {

        const methodColor = req.method === 'GET' ? GREEN : req.method === 'POST' ? YELLOW : req.method === 'DELETE' ? RED : BLUE;

        const safeLogContent = (obj, emptyMsg = 'No Data') => {
            if (!obj) return 'Undefined/Null';
            return Object.keys(obj).length > 0 ? JSON.stringify(obj) : emptyMsg;
        };

        const bodyContent = safeLogContent(sanitizeBodyForLog(req.body), 'No Body');
        const paramsContent = safeLogContent(req.params, 'No Params');
        const queryContent = safeLogContent(req.query, 'No Query');

        console.log('');
        console.log(`${GRAY}${separator}${RESET}`);
        console.log('\n');

        console.log(`${BLUE}Method: ${methodColor}${req.method}${RESET}`);
        console.log(`${BLUE}Timestamp: ${CYAN}${timestamp}${RESET}`);
        console.log(`${BLUE}IP:     ${CYAN}${req.ip || 'N/A'}${RESET}`);
        console.log(`${BLUE}Path:   ${CYAN}${req.originalUrl}${RESET}`);
        console.log(`${BLUE}Body:   ${MAGENTA}${bodyContent}${RESET}`);
        console.log(`${BLUE}Params: ${MAGENTA}${paramsContent}${RESET}`);
        console.log(`${BLUE}Query:  ${MAGENTA}${queryContent}${RESET}`);

        console.log('\n');
        console.log(`${GRAY}${separator}${RESET}`);
        console.log('');
    }

    next();
};