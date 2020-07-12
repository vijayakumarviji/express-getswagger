let joi = require('@hapi/joi');
let _ = require('lodash');
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
        swaggerParams.push(value);
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
            parameters = parameters.concat(swaggerJSON);
        }
    });
    return parameters;
}

function formatApiPath(apiPath, regex = '') {
    if(!regex.length) regex = /:([a-zA-Z0-9_])*/g;
    let matches = apiPath.match(regex);
    matches && matches.forEach(match => {
        let xmatch = match.slice(1)
        apiPath.replace(match, `{${xmatch}}`);
        apiPath = apiPath.replace(match, `{${xmatch}}`);
    });
    return apiPath;
}


function generateSwagger(express, app, {  path = '/api-docs', pathRegex, apiInfos = [], swaggerInfo = {} } = {}) {
    if (!express || !app || !apiInfos.length) return;
    let locations = {};

    apiInfos.forEach(apiInfo => {
        let { apiPath, method, tags, summary, schema = {} } = apiInfo;
        let {request = {}, response = {}} = schema;
        // Format apiPath as per swagger docs
        apiPath = formatApiPath(apiPath, pathRegex);
        locations[apiPath] = locations[apiPath] || {};
        // Response schema
        let responseSwaggerJSON;
        if (joi.isSchema(response)) {
            let convertedResponseSchema = convertJoiSchema(response);
            responseSwaggerJSON = responseGenerator(convertedResponseSchema);
        }
        // Parameter & body schema
        let parameters = formatParameters(request);
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