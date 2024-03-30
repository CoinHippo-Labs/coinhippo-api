const { request } = require('../utils/http');

module.exports = async params => await request('https://cryptopanic.com/api/v1', { path: params?.path || '/posts/', params: { ...params, auth_token: process.env.NEWS_KEY } });