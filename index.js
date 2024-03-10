exports.handler = async (event, context, callback) => {
  const moment = require('moment');

  const METHODS = require('./methods');
  const { parseParams, parseError, finalizeResponse } = require('./utils/io');
  const { log } = require('./utils/logger');

  // parse event to req
  const req = {
    url: (event.routeKey || '').replace('ANY ', ''),
    method: event.requestContext?.http?.method,
    headers: event.headers,
    params: { ...event.pathParameters },
    query: { ...event.queryStringParameters },
    body: { ...(event.body && JSON.parse(event.body)) },
  };
  // create params from req
  const params = parseParams(req, 'api');
  const { method } = { ...params };

  // when not triggered by API
  if (!method && !event.requestContext) {
    try {
      await METHODS.archive();
      await METHODS.alerts();
    } catch (error) {}
    return;
  }

  // for calculate timeSpent
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

  response = finalizeResponse(response, params, startTime);
  log('debug', 'api', 'send response', response);
  return response;
};