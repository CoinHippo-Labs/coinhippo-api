const { TOKEN_API } = require('../utils/config');
const { readCache, writeCache } = require('../utils/cache');
const { request } = require('../utils/http');

const generateCacheId = (path, params) => {
  if (Object.keys(params).length > 0) {
    return `${path}/${JSON.stringify(params)}`;
  }

  return path;
};

module.exports = async params => {
  if (!params) return;

  const { path } = { ...params };
  delete params.path;

  const cacheId = generateCacheId(path, params);

  // get coingecko from cache
  const cache = await readCache(cacheId, 300);
  if (cache) return cache;

  // get coingecko from api
  const response = await request(TOKEN_API, { path, params });

  if (response && !response.error) {
    // caching
    await writeCache(cacheId, response);
    return response;
  }

  return await readCache(cacheId, 24 * 3600);
};