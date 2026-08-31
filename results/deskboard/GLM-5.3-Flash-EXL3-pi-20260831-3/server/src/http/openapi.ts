import openApiDocumentJson from './openapi.json';

/**
 * OpenAPI 3 document describing every endpoint (spec §2.5), served as
 * Swagger UI at GET /api-docs. The document itself is declarative data
 * (`openapi.json`); this module gives it a typed export.
 */
export const openApiDocument = openApiDocumentJson;
