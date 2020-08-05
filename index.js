let joi = require('@hapi/joi');
let _ = require('lodash');
let j2s = require('joi-to-swagger');
let SwaggerUI = require('swagger-ui-express');
let { REQ_DATA } = require('./constants/constants');

// Convert Joi schema as swagger json
function convertJoiSchema(schema) {
    let { swagger } = j2s(schema);
    return swagger;
}

function paramsGenerator(schema, location) {
    let swaggerParams = [];
    _.mapKeys(schema.properties, (value, key) => {
        value = {
            schema: value
        }
        if ((schema.required && schema.required.includes(key)) || location == 'path') {
            value.required = true;
        }
        value.name = key;
        value.in = location;
        swaggerParams.push(value);
    })
    return swaggerParams;
}

function resquestBodyGenerator(schema) {
    let swaggerBody = {
        description: "Optional description in *Markdown*",
        required: true,
        content: {
          'application/json': {
              schema
          }
        }
    };
    return swaggerBody;
}

function responseGenerator(schema, {schema: baseSchema = {}} = {}) {
    let finalSchema = JSON.parse(JSON.stringify(baseSchema));
    if(_.has(finalSchema, 'properties')) {
        finalSchema.properties.data = schema;
    } else {
        finalSchema = schema;
    }
    let swaggerResponse = {
        "200": {
            "description": "successful operation",
            content: {
                'application/json': {
                    "schema": finalSchema
                }
            }
        }
    }
    return swaggerResponse;
}

function formatParameters(schema) {
    schema = Object.assign({}, schema);
    let parameters = [];
    // Body schema
    if (joi.isSchema(schema.body)) {
        let convertedBodySchema = convertJoiSchema(schema.body);
        // let bodySwaggerJSON = bodyGenerator(convertedBodySchema);
        delete schema.body;
    }
    // Params schema
    let locations = Object.keys(schema);
    locations.forEach(location => {
        if (joi.isSchema(schema[location])) {
            let convertedSchema = convertJoiSchema(schema[location]);
            location = REQ_DATA[location];
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


function generateSwagger(express, app, {  path = '/api-docs', pathRegex, apiInfos = [], swaggerInfo = {}, responseBase } = {}) {
    if (!express || !app || !apiInfos.length) return;
    let locations = {};

    apiInfos.forEach(apiInfo => {
        let { apiPath, method, tags, summary, schema = {} } = apiInfo;
        let {request = {}, response = {}} = schema;
        let {body: requestBody} = request;
        // Format apiPath as per swagger docs
        apiPath = formatApiPath(apiPath, pathRegex);
        locations[apiPath] = locations[apiPath] || {};
        let convertedRequestBodySchema = '', convertedResponseSchema = '';
        if (joi.isSchema(response)) {
            convertedResponseSchema = convertJoiSchema(response);
        }
        if (joi.isSchema(requestBody)) {
            convertedRequestBodySchema = convertJoiSchema(requestBody);
        }
        // Parameter & body schema
        let parameters = formatParameters(request);
        let pathInfo = {
            tags,
            summary,
            parameters,
            requestBody: resquestBodyGenerator(convertedRequestBodySchema),
            responses: responseGenerator(convertedResponseSchema, responseBase)
        };
        locations[apiPath][method] = pathInfo;
    });

    let swaggerDocument = Object.assign({
        openapi: "3.0.0",
        paths: locations
    }, swaggerInfo);
    app.use(path, express.static('public'));
    app.use(path, SwaggerUI.serve, SwaggerUI.setup(swaggerDocument));

    return {};
}


module.exports = generateSwagger;
module.exports.generateSwagger = generateSwagger;