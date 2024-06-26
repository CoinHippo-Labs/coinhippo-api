const { request } = require('../utils/http');

module.exports = async params => await request('https://api.whale-alert.io/v1', { path: params?.path || '/transactions', params: { ...params, api_key: process.env.WHALE_ALERT_KEY } });