// src/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API - ARCHICLOUD",
            version: "1.0.0",
            description: "API complète ArchiCloud",
        },
        servers: [
            { url: `http://localhost:${process.env.PORT ?? 3000}`, description: "Serveur dev" },
        ],
        // Les securitySchemes et schémas partagés sont déclarés dans src/docs/*.ts
        // (swagger-jsdoc les fusionne). Pas de `security` global : chaque route protégée
        // déclare `security: - bearerAuth: []`, ce qui évite d'afficher un cadenas sur
        // /auth/login et /auth/register.
    },
    apis: [
        "./src/docs/*.ts",
        "./src/router/*.route.ts",
        "./src/router/**/*.route.ts",
        "./src/routes/*.ts",
    ],
};

export const specs = swaggerJsdoc(options);
export const swaggerUiSetup = swaggerUi.setup(specs);
export const swaggerUiServe = swaggerUi.serve;