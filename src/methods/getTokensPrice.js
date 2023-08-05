const _ = require('lodash');
const moment = require('moment');

const { coingecko } = require('./coingecko');
const { read, write } = require('../services/index');
const { ASSET_COLLECTION, CURRENCY, getToken } = require('../utils/config');
const { sleep, equalsIgnoreCase, toArray } = require('../utils');

const getTokenConfig = (id, _id) => {
  const token = getToken(id);
  const { redirect } = { ...token };
  return redirect ? getTokenConfig(redirect, _id || id) : { ...token, id: _id || id };
};

module.exports = async (
  params = {},
  collection = ASSET_COLLECTION,
  currency = CURRENCY,
) => {
  let response;

  const current_time = moment();
  const { asset, timestamp } = { ...params };
  let { assets } = { ...params };
  assets = _.uniq(toArray(assets || asset, 'lower'));

  if (assets.length > 0) {
    const price_timestamp = moment(Number(timestamp) || current_time.valueOf()).startOf('day').valueOf();
    const cache = current_time.diff(moment(price_timestamp), 'hours', true) > 0 && await read(
      collection,
      {
        bool: {
          must: [
            { match: { price_timestamp } },
          ],
          should: assets.map(a => { return { match: { asset_id: a } }; }),
          minimum_should_match: 1,
        },
      },
      { size: assets.length },
    );

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
        if (index > -1) {
          data[index] = { ...data[index], ...d };
        }
      });
    }

    const updated_at_threshold = current_time.subtract(1, 'hours').valueOf();
    const to_update_data = data.filter(d => !d.updated_at || d.updated_at < updated_at_threshold || typeof d.price !== 'number');
    const coingecko_ids = _.uniq(toArray(to_update_data.map(d => d.coingecko_id)));

    if (coingecko_ids.length > 0) {
      let _data;
      if (timestamp) {
        for (const id of coingecko_ids) {
          const _response = await coingecko(`/coins/${id}/history`, { id, date: moment(Number(timestamp)).format('DD-MM-YYYY'), localization: 'false' });
          _data = toArray(_.concat(_data, _response));
        }
      }
      else {
        const _response = await coingecko('/coins/markets', { vs_currency: currency, ids: coingecko_ids.join(','), per_page: 250 });
        _data = toArray(_response);
      }

      // update data from coingecko
      toArray(_data)
        .map(d => {
          const { id, market_data, current_price } = { ...d };
          const asset_data = getToken(id) || data.find(d => d.coingecko_id === id);
          const { is_stablecoin } = { ...asset_data };
          let { asset_id } = { ...asset_data };
          asset_id = asset_id || asset_data?.id;
          let price = market_data?.current_price?.[currency] || current_price;
          price = !price && is_stablecoin ? 1 : price;
          return {
            id: `${asset_id}_${price_timestamp}`,
            asset_id,
            coingecko_id: id,
            price,
          };
        })
        .forEach(d => {
          const { asset_id, coingecko_id, price } = { ...d };
          for (let i = 0; i < data.length; i++) {
            const _d = data[i];
            if (equalsIgnoreCase(_d.asset_id, asset_id) || equalsIgnoreCase(_d.coingecko_id, coingecko_id)) {
              data[i] = {
                ...d,
                ...data[i],
                price: price || _d.price,
              };
            }
          }
        });
    }

    const updated_data = data.filter(d => d.asset_id && typeof d.price === 'number' && (!d.updated_at || d.updated_at < updated_at_threshold));
    if (updated_data.length > 0) {
      const synchronous = updated_data.length < 5;
      for (const d of updated_data) {
        const { asset_id } = { ...d };
        const updated_at = moment().valueOf();
        const price_timestamp = moment(Number(timestamp) || updated_at).startOf('day').valueOf();
        const id = `${asset_id}_${price_timestamp}`;
        const write_data = { ...d, id, price_timestamp, updated_at };
        if (synchronous) {
          await write(collection, id, write_data);
        }
        else {
          write(collection, id, write_data);
        }
      }
      if (!synchronous) {
        await sleep(5 * 1000);
      }
    }
    response = data;
  }

  return response;
};