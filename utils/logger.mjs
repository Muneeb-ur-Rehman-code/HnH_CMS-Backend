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

const safeStringify = (obj) => {
    try {
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (key.length > 0 && obj !== value && typeof obj[key] === 'object' && obj[key] !== null) {
                    return '[Circular]';
                }
            }
            return value;
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
        console.log(safeStringify(req.body));

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

        const bodyContent = safeLogContent(req.body, 'No Body');
        const paramsContent = safeLogContent(req.params, 'No Params');
        const queryContent = safeLogContent(req.query, 'No Query');

        console.log('');
        console.log(`${GRAY}${separator}${RESET}`);
        console.log('\n');

        console.log(`${BLUE}Method: ${methodColor}${req.method}${RESET}`);
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