const { request } = require('../utils/http');

module.exports = async params => {
  params = { ...params, auth_token: process.env.NEWS_KEY };
  let { path } = { ...params };
  path = path || '/posts/';
  return await request('https://cryptopanic.com/api/v1/', { path, params });
};