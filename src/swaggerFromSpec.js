'use strict';

function specToPaths(specs) {
  let paths = {};
  for (let method in specs.api) { // eslint-disable-line guard-for-in
    let spec = specs.api[method];
    let ref = {
      properties: {},
      required: []
    };
    if (spec.$ref) {
      if (!spec.$ref.startsWith('#/definitions/')) {
        throw 'Unexpected $ref prefix';
      }
      let definitionName = spec.$ref.slice('#/definitions/'.length);
      ref = specs.definitions[definitionName];
      if (!ref) {
        throw 'Missing definition';
      }
    }
    spec.properties = Object.assign({}, spec.properties, ref.properties);
    spec.required = spec.required || ref.required;
    spec.required.push('access_token');
    spec.properties.access_token = {
      type: 'string',
      description: 'Access token from the OAuth2 server'
    };
    let request = {
      name: 'request',
      description: 'Request object',
      in: 'body',
      required: true,
      schema: {
        type: 'object',
        required: spec.required,
        properties: spec.properties
      }};
    let obj = {
      description: spec.description || '',
      parameters: [request],
      responses: {
        default: {
          description: 'Response envelope',
          schema: {
            type: 'object',
            required: ['statusCode'],
            properties: {
              statusCode: {type: 'integer'},
              data: spec.response || {
                type: 'object',
                properties: {}
              },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {}
                }
              }
            }
          }
        }
      }
    };
    paths['/' + method] = {post: obj};
  }
  return paths;
}

const version = require('../package.json').version;
const majorVersion = parseInt(version, 10);

export default function(specName = 'spec') {
  let fs = require('fs');
  let yaml = require('js-yaml');
  let path = __dirname + '/../doc/';

  return Promise.all(
      [new Promise((resolve, reject) =>
        fs.readFile(path + specName + '.yaml', 'utf-8', (err, result) => err ? reject(err) : resolve(yaml.safeLoad(result)))),
      new Promise((resolve, reject) =>
        fs.readFile(path + 'description.md', 'utf-8', (err, result) => err ? reject(err) : resolve(result)))])
    .then(([spec, desc]) => {
      return {
        swagger: '2.0',
        info: {
          version: version,
          title: 'DBC ServiceProvider',
          description: desc
        },
        basePath: '/v' + majorVersion + '/',
        schemes: ['https', 'wss'],
        consumes: ['application/json'],
        produces: ['application/json'],
        paths: specToPaths(spec),
        definitions: spec.definitions,
        externalDocs: {
          description: 'Extra documentation in the github repository',
          url: 'https://github.com/DBCDK/serviceprovider/tree/master/doc'
        }
      };
    }).catch(e => {
      return {error: e};
    });
}
