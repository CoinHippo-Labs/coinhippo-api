const moment = require('moment');

const { deleteByQuery } = require('../services/index');
const { CACHE_COLLECTION } = require('../utils/config');

const CACHE_COLLECTIONS = [CACHE_COLLECTION];
const CACHE_AGE_SECONDS = 300;

module.exports = async () => {
  for (const collection of CACHE_COLLECTIONS) {
    await deleteByQuery(collection, { range: { updated_at: { lt: moment().subtract(CACHE_AGE_SECONDS, 'seconds').valueOf() } } });
  }
  return;
};