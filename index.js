exports.handler = async (event = {}, context, callback) => {
  const moment = require('moment');

  const METHODS = require('./methods');
  const { parseParams, parseError, finalizeResponse } = require('./utils/io');
  const { getLogLevel } = require('./utils/config');
  const { toJson } = require('./utils/parser');
  const { version } = require('./package.json');

  // parse event to req
  const req = {
    url: (event.routeKey || '').replace('ANY ', ''),
    method: event.requestContext?.http?.method,
    headers: event.headers,
    params: { ...event.pathParameters },
    query: { ...event.queryStringParameters },
    body: { ...toJson(event.body) },
  };

  // create params from req
  const params = parseParams(req);
  const { method } = { ...params };

  // when not triggered by API
  if (!method && !event.requestContext) {
    try {
      await METHODS.archive();
      await METHODS.alerts();
    } catch (error) {}
  }

  // without method (default)
  if (!method) {
    return {
      version,
      env: {
        log_level: getLogLevel(),
      },
    };
  }

  // for calculate time spent
  const startTime = moment();

  let response;
  switch (method) {
    default:
      if (method in METHODS) {
        try {
          response = await METHODS[method](params);
        } catch (error) {
          response = parseError(error);
        }
        break;
      }
      response = { error: true, code: 400, message: 'method not supported' };
      break;
  }

  return finalizeResponse(response, params, startTime);
};