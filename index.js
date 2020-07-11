let joi = require('@hapi/joi');
let j2s = require('joi-to-swagger');
let SwaggerUI = require('swagger-ui-express');

// Convert Joi schema as swagger json
function convertJoiSchema(schema) {
    let { swagger } = j2s(schema);
    return swagger;
}

function paramsGenerator(schema, location) {
    let swaggerParams = [];
    _.mapKeys(schema.properties, (value, key) => {
        if (schema.required && schema.required.includes(key)) {
            value.required = true;
        }
        value.name = key;
        value.in = location;
        response.push(value);
    })
    return swaggerParams;
}

function bodyGenerator(schema) {
    let swaggerBody = {
        "in": "body",
        "name": "body",
        "schema": schema
    };
    return swaggerBody;
}

function responseGenerator(schema) {
    let swaggerResponse = {
        "200": {
            "description": "successful operation",
            "schema": schema
        }
    }
    return swaggerResponse;
}

function formatParameters(schema) {
    let parameters = [];
    // Body schema
    if (joi.isSchema(schema.body)) {
        let convertedBodySchema = convertJoiSchema(schema.body);
        let bodySwaggerJSON = bodyGenerator(convertedBodySchema);
        parameters.push(bodySwaggerJSON);
        delete schema.body;
    }
    // Params schema
    let locations = Object.keys(schema);
    locations.forEach(location => {
        if (joi.isSchema(schema[location])) {
            let convertedSchema = convertJoiSchema(schema[location]);
            let swaggerJSON = paramsGenerator(convertedSchema, location);
            parameters.push(swaggerJSON);
        }
    });
    return parameters;
}


function generateSwagger(express, app, {  path = '/api-docs', apiInfos = [], swaggerInfo = {} } = {}) {
    if (!express || !app || !apiInfos.length) return;
    let locations = {};

    apiInfos.forEach(apiInfo => {
        let { apiPath, method, tags, summary, schema } = apiInfo;
        locations[apiPath] = locations[apiPath] || {};
        // Response schema
        let responseSwaggerJSON;
        if (joi.isSchema(schema.response)) {
            let convertedResponseSchema = convertJoiSchema(schema.response);
            responseSwaggerJSON = responseGenerator(convertedResponseSchema);
            delete schema.response;
        }
        // Parameter & body schema
        let parameters = formatParameters(schema);
        let pathInfo = {
            tags,
            summary,
            parameters,
            responses: responseSwaggerJSON
        };
        locations[apiPath][method] = pathInfo;
    });

    let swaggerDocument = Object.assign({
        swagger: "2.0",
        paths: locations
    }, swaggerInfo);

    app.use(path, express.static('public'));
    app.use(path, SwaggerUI.serve, SwaggerUI.setup(swaggerDocument));

    return {};
}


module.exports = generateSwagger;
module.exports.generateSwagger = generateSwagger;