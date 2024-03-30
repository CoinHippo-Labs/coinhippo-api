const { request } = require('../utils/http');

module.exports = async params => await request('https://api.alternative.me', { path: params?.path || '/fng/', params: { ...params, limit: 31 } });