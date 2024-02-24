const _ = require('lodash');
const moment = require('moment');

const { coingecko } = require('./coingecko');
const { read, write } = require('../services/index');
const { ASSET_COLLECTION, CURRENCY, getToken } = require('../utils/config');
const { sleep } = require('../utils/operator');
const { toArray } = require('../utils/parser');
const { equalsIgnoreCase } = require('../utils/string');
const { isNumber, toNumber } = require('../utils/number');
const { timeDiff } = require('../utils/time');

const getTokenConfig = (id, _id) => {
  const tokenData = getToken(id);
  const { redirect } = { ...tokenData };
  return redirect ? getTokenConfig(redirect, _id || id) : { ...tokenData, id: _id || id };
};

module.exports = async (params = {}, collection = ASSET_COLLECTION, currency = CURRENCY) => {
  let response;

  const currentTime = moment();
  const { asset, timestamp } = { ...params };
  let { assets } = { ...params };
  assets = _.uniq(toArray(assets || asset, { toCase: 'lower' }));

  if (assets.length > 0) {
    const price_timestamp = moment(toNumber(timestamp) || currentTime.valueOf()).startOf('day').valueOf();
    const cache = timeDiff(price_timestamp, 'hours', currentTime, true) > 0 && await read(collection, {
      bool: {
        must: [
          { match: { price_timestamp } },
        ],
        should: assets.map(a => { return { match: { asset_id: a } }; }),
        minimum_should_match: 1,
      },
    }, { size: assets.length });

    const data = assets.map(a => {
      const { id, coingecko_id, is_stablecoin, default_price } = { ...getTokenConfig(a) };
      return {
        id: `${id}_${price_timestamp}`,
        asset_id: id,
        coingecko_id,
        price: is_stablecoin ? 1 : default_price || undefined,
      };
    });

    if (cache?.data) {
      toArray(cache.data).forEach(d => {
        const index = data.findIndex(_d => equalsIgnoreCase(_d.asset_id, d.asset_id));
        if (index > -1) data[index] = { ...data[index], ...d };
      });
    }

    const updatedAtThreshold = currentTime.subtract(1, 'hours').valueOf();
    const toUpdateData = data.filter(d => !d.updated_at || d.updated_at < updatedAtThreshold || !isNumber(d.price));
    const coingecko_ids = _.uniq(toArray(toUpdateData.map(d => d.coingecko_id)));

    if (coingecko_ids.length > 0) {
      let _data;
      if (timestamp) {
        for (const id of coingecko_ids) {
          _data = toArray(_.concat(_data, await coingecko(`/coins/${id}/history`, { id, date: moment(Number(timestamp)).format('DD-MM-YYYY'), localization: 'false' })));
        }
      }
      else _data = toArray(await coingecko('/coins/markets', { vs_currency: currency, ids: coingecko_ids.join(','), per_page: 250 }));

      // update data from coingecko
      toArray(_data).map(d => {
        const assetData = getToken(d.id) || data.find(d => d.coingecko_id === d.id);
        let { asset_id } = { ...assetData };
        asset_id = asset_id || assetData?.id;
        let price = d.market_data?.current_price?.[currency] || d.current_price;
        price = !price && assetData?.is_stablecoin ? 1 : price;
        return {
          id: `${asset_id}_${price_timestamp}`,
          asset_id,
          coingecko_id: d.id,
          price,
        };
      }).forEach(d => {
        for (let i = 0; i < data.length; i++) {
          const _d = data[i];
          if (equalsIgnoreCase(_d.asset_id, d.asset_id) || equalsIgnoreCase(_d.coingecko_id, d.coingecko_id)) {
            data[i] = { ...d, ...data[i], price: d.price || _d.price };
          }
        }
      });
    }

    const updatedData = data.filter(d => d.asset_id && isNumber(d.price) && (!d.updated_at || d.updated_at < updatedAtThreshold));
    if (updatedData.length > 0) {
      const synchronous = updatedData.length < 5;
      for (const d of updatedData) {
        const updated_at = moment().valueOf();
        const price_timestamp = moment(Number(timestamp) || updated_at).startOf('day').valueOf();
        const id = `${d.asset_id}_${price_timestamp}`;
        const writeData = { ...d, id, price_timestamp, updated_at };
        if (synchronous) await write(collection, id, writeData);
        else write(collection, id, writeData);
      }
      if (!synchronous) await sleep(5 * 1000);
    }
    response = data;
  }

  return response;
};