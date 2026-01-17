/**
 * Swagger Configuration
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'WebAR Restaurant API', version: '1.0.0', description: 'API for WebAR Restaurant Platform' },
        servers: [{ url: process.env.BASE_URL || 'http://localhost:3001', description: 'Main server' }],
        components: {
            securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
            schemas: {
                User: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, businessName: { type: 'string' }, plan: { type: 'string' } } },
                MenuItem: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, targetImage: { type: 'string' }, arContent: { type: 'string' }, contentType: { type: 'string' }, qrCode: { type: 'string' }, viewerUrl: { type: 'string' } } },
                Error: { type: 'object', properties: { error: { type: 'string' } } }
            }
        }
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);