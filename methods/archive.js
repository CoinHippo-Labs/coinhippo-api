const moment = require('moment');

const { deleteByQuery } = require('../services/indexer');
const { CACHE_COLLECTION } = require('../utils/cache');

const CACHE_AGE = 300;

module.exports = async () => {
  for (const collection of [CACHE_COLLECTION]) {
    await deleteByQuery(collection, { range: { updated_at: { lt: moment().subtract(CACHE_AGE, 'seconds').valueOf() } } });
  }

  return;
};