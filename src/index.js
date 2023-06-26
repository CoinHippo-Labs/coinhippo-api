exports.handler = async (event, context, callback) => {
  const moment = require('moment');

  const { getCoingecko, getFearAndGreed, archive, alerts } = require('./methods');
  const { getChainsList } = require('./utils/config');
  const { getParams, errorOutput, finalizeOutput } = require('./utils/io');

  // parse function event to req
  const req = {
    url: (event.routeKey || '').replace('ANY ', ''),
    method: event.requestContext?.http?.method,
    headers: event.headers,
    params: { ...event.pathParameters },
    query: { ...event.queryStringParameters },
    body: { ...(event.body && JSON.parse(event.body)) },
  };

  let output;
  // create params from req
  const params = getParams(req);
  const { method } = { ...params };
  // for calculate time spent
  const start_time = moment();

  switch (req.url) {
    case '/':
      delete params.method;
      switch (method) {
        case 'coingecko':
          try {
            output = await getCoingecko(params);
          } catch (error) {
            output = errorOutput(error);
          }
          break;
        case 'getFearAndGreed':
          try {
            output = await getFearAndGreed(params);
          } catch (error) {
            output = errorOutput(error);
          }
          break;
        case 'getChains':
          output = getChainsList();
          break;
        default:
          break;
      }
      break;
    default:
      if (!req.url) {
        try {
          await archive();
          output = await alerts();
        } catch (error) {
          output = errorOutput(error);
        }
      }
      break;
  }

  output = finalizeOutput(output, { ...params, method }, start_time);
  return output;
};