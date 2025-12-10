const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Tracking API',
            version: '1.0.0',
            description: 'API for tracking packages from multiple providers',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server',
            },
            {
                url: 'https://tracking-app.vercel.app',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'connect.sid',
                },
            },
        },
    },
    apis: ['./tracker-app.js'], // Path to the API docs
};

module.exports = options;
