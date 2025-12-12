import swaggerAutogen from 'swagger-autogen';

const doc = {
    info: {
        version: '1.0.0',
        title: 'HNH_CRM API',
        description: 'Documentation for the HNH_CRM MERN Stack Backend API',
    },
    host: 'localhost:5000',
    basePath: '/api',
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
        apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'Add your **Bearer Token** to authorize API calls. Example: `Bearer <token>`'
        }
    },
    security: [
        {
            apiKeyAuth: []
        }
    ],
    definitions: {}
};

const outputFile = './swagger-output.json';
const routes = [
    './routes/Routes.mjs'
];

swaggerAutogen({ openapi: '3.0.0' })(outputFile, routes, doc);