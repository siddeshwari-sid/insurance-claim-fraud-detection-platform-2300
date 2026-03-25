const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Insurance Claim Fraud Detection API',
      version: '1.0.0',
      description: 'Express API for uploading insurance claims, rule-based fraud scoring, and reporting (in-memory session storage).',
    },
  },
  apis: ['./src/routes/*.js'], // includes index.js and api.js
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
