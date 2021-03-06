'use strict';

/**
 * @file
 * Configure and start our server
 */

// Config
import {version} from '../package.json';
// path for the API-endpoint, ie /v0/, /v1/, or ..
const apiPath = '/v' + parseInt(version, 10) + '/';

// Libraries
import fs from 'fs';
import express from 'express';
import path from 'path';
import Logger from 'dbc-node-logger';
import RedisStore from 'connect-redis';
import ServiceProviderSetup from './ServiceProviderSetup.js';

// Middleware
import bodyParser from 'body-parser';
import compression from 'compression';
import expressSession from 'express-session';
import helmet from 'helmet';

// Generation of swagger specification
import swaggerFromSpec from './swaggerFromSpec.js';

module.exports.run = function (worker) {
  // Setup
  const app = express();
  const server = worker.httpServer;
  const ENV = app.get('env');
  const PRODUCTION = ENV === 'production';
  const APP_NAME = process.env.APP_NAME || 'app_name'; // eslint-disable-line no-process-env
  const logger = new Logger({app_name: APP_NAME});
  const expressLoggers = logger.getExpressLoggers();

  // Old config, currently stored in config.json, should be delivered from auth-server, etc. later on
  const config = JSON.parse(
        fs.readFileSync(
          process.env.CONFIG_FILE || // eslint-disable-line no-process-env
            __dirname + '/../config.json', 'utf8'));
  config.cache.store = require('cache-manager-redis');

  // Direct requests to app
  server.on('request', app);

  // Setting bodyparser
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));

  // don't set the X-Powered-By header
  app.disable('x-powered-by');

  // Helmet configuration
  // TODO: Setup rest of Helmet, in a way that works with the server setup.
  app.use(helmet.frameguard());
  app.use(helmet.ieNoOpen());
  app.use(helmet.noSniff());

  // Port config
  app.set('port', process.env.PORT || 8080); // eslint-disable-line no-process-env

  // Configure app variables
  let serviceProvider = ServiceProviderSetup(config, logger);
  app.set('serviceProvider', serviceProvider);
  app.set('logger', logger);

  // Setup environments
  let redisConfig;

  // Redis
  switch (ENV) {
    case 'development':
      redisConfig = config.sessionStores.redis.development; // eslint-disable-line no-process-env
      break;
    case 'production':
      redisConfig = config.sessionStores.redis.production; // eslint-disable-line no-process-env
      break;
    default:
      redisConfig = config.sessionStores.redis.local; // eslint-disable-line no-process-env
      break;
  }

  let redisStore = RedisStore(expressSession);

  let sessionMiddleware = expressSession({
    store: new redisStore({
      host: redisConfig.host,
      port: redisConfig.port,
      prefix: APP_NAME + '_session_'
    }),
    secret: redisConfig.secret + APP_NAME,
    name: APP_NAME,
    rolling: true,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: PRODUCTION
    }
  });

  // Adding gzip'ing
  app.use(compression());

  // Setting paths
  app.all('/', (req, res) => res.redirect(apiPath));
  app.use(apiPath, express.static(path.join(__dirname, '../static')));

  // Setting logger
  app.use(expressLoggers.logger);

  // Setting sessions
  app.use(sessionMiddleware);


  // DUMMY context, - TODO: get this from the auth server through token, and preserve through sessions
  let dummyContext = {
    request: {session: {}},
    libdata: {
      kommune: 'aarhus',
      config: config,
      libraryId: (config || {}).agency
    }
    // request: {session: req.session},
    // libdata: res.locals.libdata
  };

  // Execute transform
  function callApi(event, query, context, callback) {
    let prom;
    // Currently it is needed to run the old-school version of getRecommendations,
    // since the apitests uses the property isFrontPage=true, which calls the meta-recommender.
    // But only the regular recommender is implemented in the current neoGetRecommendations.
    prom = serviceProvider.trigger(event, query, context);
    // When the above mentioned is fixed, the below will make use of neoGetRecommendations!
    // if (event === 'getRecommendations') {
    //   console.log('Neo Event called: ' + event); // eslint-disable-line no-console
    //   // The below expects an array. We will give it what it asks for!
    //   prom = [serviceProvider.execute(event, query, context)];
    // } else { // eslint-disable-line brace-style
    //   console.log('Old-School Event called: ' + event); // eslint-disable-line no-console
    //   prom = serviceProvider.trigger(event, query, context);
    // }

    // TODO: result from serviceProvider should just be a single promise.
    // fix this in provider
    if (Array.isArray(prom)) {
      console.log('warning', 'result is array, instead of single promise', event); // eslint-disable-line no-console
      if (prom.length !== 1) {
        console.error('error', 'result length is ', prom.length); // eslint-disable-line no-console
      }
      prom = Array.isArray(prom) ? prom : [prom];
    }
    prom[0].then((response) => {
      callback(response);
    }, (error) => {
      callback(error);
    });
  }

  // WebSocket/SocketCluster transport
  worker.on('connection', (connection) => {
    for (let key of serviceProvider.availableTransforms()) {
      connection.on(key, (data, callback) => { // eslint-disable-line no-loop-func
        callApi(key, data, dummyContext, callback);
      });
    }
  });

  // HTTP Transport
  for (let event of serviceProvider.availableTransforms()) {
    app.all(apiPath + event, (req, res) => { // eslint-disable-line no-loop-func
      // TODO: should just be req.body, when all endpoints accept object-only as parameter, until then, this hack supports legacy transforms
      let query = Array.isArray(req.body) ? req.body[0] : req.body;

      query = query || {};
      for (let key in req.query) { // eslint-disable-line guard-for-in
        try {
          query[key] = JSON.parse(req.query[key]);
        }
        catch (_) {
          query[key] = req.query.key;
        }
      }
      callApi(event, query, dummyContext, response => {
        app.set('json spaces', query.pretty ? 2 : null);
        res.jsonp(response);
      });
    });
  }

  app.all(apiPath + 'swagger.json', (req, res) => {
    return swaggerFromSpec().then((response) => {
      res.jsonp(response);
    }, (error) => {
      res.jsonp(error);
    });
  });

  // Graceful handling of errors
  app.use((err, req, res, next) => {
    logger.log('error', 'An error occurred! Got following: ' + err);
    console.error('error', 'An error occurred! Got following: ', err); // eslint-disable-line no-console
    console.error(err.stack); // eslint-disable-line no-console
    if (res.headersSent) {
      return next(err);
    }

    res.status(500);
    res.jsonp({error: String(err)});
    res.end();
  });

  // Handle 404's
  app.use((req, res) => {
    res.status(404);
    res.jsonp({error: '404 Not Found'});
    res.end();
  });

  // Setting logger -- should be placed after routes
  app.use(expressLoggers.errorLogger);

  logger.log('debug', '>> Worker PID: ' + process.pid);
  logger.log('debug', 'Server listening on port ' + app.get('port'));
  logger.log('debug', 'APP_NAME: ' + APP_NAME);
  logger.log('info', 'Versions: ', process.versions);
  logger.log('info', version + ' is up and running');
};
