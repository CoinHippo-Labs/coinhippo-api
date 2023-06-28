const _ = require('lodash');
const moment = require('moment');

const { getCoingecko } = require('../coingecko');
const { twitter, telegram } = require('../broadcasts');
const { CURRENCY } = require('../../utils/config');
const { sleep, split, toArray, numberFormat } = require('../../utils');

const WEBSITE = 'https://coinhippo.io';
const TIMES = ['1h', '24h', '7d', '30d'];
const EXCLUDES = ['tether','usd-coin','binance-usd','dai','frax','true-usd','compound-usd-coin','paxos-standard','neutrino','huobi-btc','usdd','compound-ether','cdai','fei-usd','tether-eurt','flex-usd','alchemix-usd','gemini-dollar','husd','liquity-usd','iron-bank-euro','usdx','nusd','terrausd','seth2','celo-dollar','ageur','compound-basic-attention-token','usdk','musd','celo-euro','seth','instadapp-eth','compound-uniswap','compound-0x','sbtc','compound-chainlink-token','e-money-eur','spiceusd','compound-wrapped-btc','tbtc','seur','veusd','compound-maker','compound-sushi'];

module.exports = async () => {
  let alerted;

  const now = moment();
  const hour = Number(now.hours());
  const minute = Number(now.minutes());

  let response = await getCoingecko({ path: '/coins/markets', vs_currency: CURRENCY, order: 'market_cap_desc', per_page: 250, price_change_percentage: TIMES.join(',') });
  const market_caps = toArray(response).filter(d => !EXCLUDES.includes(d.id));
  await sleep(30 * 1000);

  response = await getCoingecko({ path: '/coins/markets', category: 'decentralized-finance-defi', vs_currency: CURRENCY, order: 'market_cap_desc', per_page: 250, price_change_percentage: TIMES.join(',') });
  const defis = toArray(response).filter(d => !EXCLUDES.includes(d.id));
  await sleep(30 * 1000);

  response = await getCoingecko({ path: '/coins/markets', category: 'non-fungible-tokens-nft', vs_currency: CURRENCY, order: 'market_cap_desc', per_page: 250, price_change_percentage: TIMES.join(',') });
  const nfts = toArray(response).filter(d => !EXCLUDES.includes(d.id));
  await sleep(30 * 1000);

  response = await getCoingecko({ path: '/search/trending' });
  let trendings = toArray(toArray(response?.coins).map(d => d.item));
  if (trendings.length > 0) {
    await sleep(30 * 1000);
    response = await getCoingecko({ path: '/coins/markets', ids: trendings.map(d => d.id).join(','), vs_currency: CURRENCY, order: 'market_cap_desc', per_page: 250, price_change_percentage: TIMES.join(',') });
    if (response) {
      trendings = toArray(response).map((d, i) => {
        const { thumb } = { ...d };
        return {
          ...trendings.find(_d => _d.id === d.id),
          image: thumb,
          rank: i + 1,
        };
      });
    }
  }

  const top_gainers = _.orderBy(market_caps.filter(d => d.price_change_percentage_24h_in_currency), ['price_change_percentage_24h_in_currency'], ['desc']);
  const top_losers = _.orderBy(market_caps.filter(d => d.price_change_percentage_24h_in_currency), ['price_change_percentage_24h_in_currency'], ['asc']);
  const _market_caps = _.orderBy(
    market_caps.filter(d => d.market_cap_rank > 0 && d.market_cap_rank <= 100).map(d => {
      TIMES.forEach(t => {
        d[`price_change_percentage_${t}_in_currency_abs`] = Math.abs(d[`price_change_percentage_${t}_in_currency`]);
      });
      return d;
    }),
    ['price_change_percentage_24h_in_currency_abs', 'price_change_percentage_1h_in_currency_abs'],
    ['desc', 'desc'],
  );
  const volume_per_market_caps = _.orderBy(
    market_caps.filter(d => d.total_volume && d.market_cap).map(d => {
      TIMES.forEach(t => {
        d.volume_per_market_cap = d.total_volume / d.market_cap;
      });
      return d;
    }),
    ['volume_per_market_cap'], ['desc'],
  );
  const _defis = _.orderBy(
    defis.map(d => {
      TIMES.forEach(t => {
        d[`price_change_percentage_${t}_in_currency_abs`] = Math.abs(d[`price_change_percentage_${t}_in_currency`]);
      });
      return d;
    }),
    ['market_cap_rank', 'price_change_percentage_24h_in_currency_abs', 'price_change_percentage_1h_in_currency_abs'],
    ['asc', 'desc', 'desc'],
  );
  const _nfts = _.orderBy(
    nfts.map(d => {
      TIMES.forEach(t => {
        d[`price_change_percentage_${t}_in_currency_abs`] = Math.abs(d[`price_change_percentage_${t}_in_currency`]);
      });
      return d;
    }),
    ['market_cap_rank', 'price_change_percentage_24h_in_currency_abs', 'price_change_percentage_1h_in_currency_abs'],
    ['asc', 'desc', 'desc'],
  );
  const _trendings = _.orderBy(
    trendings.filter(d => typeof d.current_price === 'number').map(d => {
      TIMES.forEach(t => {
        d[`price_change_percentage_${t}_in_currency_abs`] = Math.abs(d[`price_change_percentage_${t}_in_currency`]);
      });
      return d;
    }),
    ['rank', 'price_change_percentage_24h_in_currency_abs', 'price_change_percentage_1h_in_currency_abs'],
    ['asc', 'desc', 'desc'],
  );
  const aths = _market_caps.filter(d => now.diff(moment(d.ath_date), 'hours') <= 1);
  const atls = _market_caps.filter(d => now.diff(moment(d.atl_date), 'hours') <= 1);

  const twitter_messages = [];
  const telegram_messages = [];
  if (minute === 0) {
    if (hour % 4 === 0) {
      const { id, symbol, name, current_price, price_change_percentage_24h_in_currency } = { ...market_caps.find(d => d.id === 'bitcoin') };
      if (id && symbol) {
        twitter_messages.push(`Today's 👑🟠 #${name} price is $${numberFormat(current_price, '0,0')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')} from yesterday.\n${WEBSITE}/token/${id}\n\n$${symbol.toUpperCase()} #Cryptocurrency`);
        telegram_messages.push(`Today's 👑🟠 <a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> price <b>$${numberFormat(current_price, '0,0')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`);
      }
    }
    else if (aths.length > 0 || atls.length > 0) {
      if (aths.length > 0) {
        const data = _.slice(aths, 0, 3).map(d => { return { ...d, value: _.max([d.ath, d.current_price, d.high_24h].filter(v => typeof v === 'number')) }; });
        let twitter_message = '';
        let telegram_message = '';
        data.forEach((d, i) => {
          const { id, symbol, value } = { ...d };
          if (id && symbol) {
            twitter_message = `${twitter_message}${i > 0 ? '\n' : ''}$${symbol.toUpperCase()} hits a new ATH at $${numberFormat(value, '0,0.00000000')}. 🚀🌙`;
            telegram_message = `${telegram_message}${i === 0 ? '🛸🌙 ALL TIME HIGH' : ''}\n`;
            telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <pre>$${numberFormat(value, '0,0.00000000')}</pre>`;
          }
        });
        twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : ''}`;
        twitter_message = `${twitter_message}\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')} #Cryptocurrency`;
        twitter_messages.push(twitter_message);
        telegram_messages.push(telegram_message);
      }
      else {
        const data = _.slice(atls, 0, 3).map(d => { return { ...d, value: _.max([d.atl, d.current_price, d.low_24h].filter(v => typeof v === 'number')) }; });
        let twitter_message = '';
        let telegram_message = '';
        data.forEach((d, i) => {
          const { id, symbol, value } = { ...d };
          if (id && symbol) {
            twitter_message = `${twitter_message}${i > 0 ? '\n' : ''}$${symbol.toUpperCase()} made a new ATL at $${numberFormat(value, '0,0.00000000')}. 😢🚨`;
            telegram_message = `${telegram_message}${i === 0 ? '🧸 ALL TIME LOW' : ''}\n`;
            telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <pre>$${numberFormat(value, '0,0.00000000')}</pre>`;
          }
        });
        twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : ''}`;
        twitter_message = `${twitter_message}\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')} #Cryptocurrency`;
        twitter_messages.push(twitter_message);
        telegram_messages.push(telegram_message);
      }
    }
    else {
      const i = Math.floor(Math.random() * 7);
      if (i < 1 && telegram_messages.length < 1) {
        const data = _.slice(_market_caps.filter(d => d.price_change_percentage_24h_in_currency_abs >= 5), 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `Let's check on the Top${data.length > 1 ? ` ${data.length}` : ''} % Changes 🌪` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}/tokens">🌪 High % Change</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n💙 if you HODL any one of them\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (i < 2 && telegram_messages.length < 1) {
        const data = _.slice(volume_per_market_caps, 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency, volume_per_market_cap } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `Let's check on the Top${data.length > 1 ? ` ${data.length}` : ''} Volume / Market Cap 🌊` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}/tokens">🌊 High Volume / Market Cap</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>\n<b>Vol/MCap: ${numberFormat(volume_per_market_cap, '0,0.0000')}</b>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n💙 if you HODL any one of them\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (i < 3 && telegram_messages.length < 1) {
        const data = _.slice(top_gainers, 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `Today's Top Gainers 🏅` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}">🥇🥈🥉 Top Gainers</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n💙 if you HODL any one of them\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (i < 4 && telegram_messages.length < 1) {
        const data = _.slice(top_losers, 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `Today's Top Losers ⚰️` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}">⚰️ Top Losers</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (i < 5 && telegram_messages.length < 1) {
        const data = _.slice(_defis, 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `🌱🌕🦄🥞🍣 Top${data.length > 1 ? ` ${data.length}` : ''} DeFi` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}/tokens/decentralized-finance-defi">🌱🌕🦄🥞🍣 Top DeFi</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n#DeFi ${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (i < 6 && telegram_messages.length < 1) {
        const data = _.slice(_nfts, 0, 3);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `🎮🏞👻 Update on the Top${data.length > 1 ? ` ${data.length}` : ''} NFTs` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}/tokens/non-fungible-tokens-nft">🎮🏞👻 Top NFTs</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n#NFTs ${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
      if (telegram_messages.length < 1) {
        const data = _.slice(_trendings, 0, 5);
        if (data.length > 0) {
          let twitter_message = '';
          let telegram_message = '';
          data.forEach((d, i) => {
            const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
            if (id && symbol) {
              twitter_message = `${twitter_message}${i === 0 ? `Trending Search. Let's check'em out! 🔥🔥🔥` : ''}\n`;
              twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
              telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}">🔥🔍🗯 Trending Search</a>` : ''}\n`;
              telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
            }
          });
          twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
          twitter_message = `${twitter_message}\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')}`;
          twitter_messages.push(twitter_message);
          telegram_messages.push(telegram_message);
        }
      }
    }
  }
  else {
    const data = _.slice(market_caps, 0, 3).map(d => {
      d.hour_market_cap_change = d.price_change_percentage_1h_in_currency * d.market_cap;
      d.day_market_cap_change = d.price_change_percentage_24h_in_currency * d.market_cap;
      return d;
    });
    const total_market_cap = _.sumBy(data, 'market_cap');
    if (total_market_cap > 0) {
      const sum_hour_market_cap_change = _.sumBy(data, 'hour_market_cap_change');
      const sum_day_market_cap_change = _.sumBy(data, 'day_market_cap_change');
      const hour_exceed = Math.abs(sum_hour_market_cap_change / total_market_cap) >= 5;
      const day_exceed = Math.abs(sum_day_market_cap_change / total_market_cap) >= 10;
      if (hour_exceed || day_exceed) {
        const status = (hour_exceed ? sum_hour_market_cap_change : sum_day_market_cap_change) < 0 ? 'panic' : 'fomo';
        let twitter_message = '';
        let telegram_message = '';
        data.forEach((d, i) => {
          const { id, symbol, current_price, price_change_percentage_24h_in_currency } = { ...d };
          if (id && symbol) {
            twitter_message = `${twitter_message}${i === 0 ? `${status === 'panic' ? '😱🥶😰 Some Panic selling detected:' : '🤩🤑😁 Some FOMO buying detected:'}` : ''}\n`;
            twitter_message = `${twitter_message}$${symbol.toUpperCase()} $${numberFormat(current_price, '0,0.00000000')} ${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}`;
            telegram_message = `${telegram_message}${i === 0 ? `<a href="${WEBSITE}">${status === 'panic' ? '😱🥶😰 Panic Selling' : '🤩🤑😁 FOMO Buying'}</a>` : ''}\n`;
            telegram_message = `${telegram_message}<a href="${WEBSITE}/token/${id}">${symbol.toUpperCase()}</a> <b>$${numberFormat(current_price, '0,0.00000000')}</b> <pre>${numberFormat(price_change_percentage_24h_in_currency / 100, '+0,0.00%')}</pre>`;
          }
        });
        twitter_message = `${twitter_message}${data.length === 1 ? `\n${WEBSITE}/token/${_.head(data).id}` : `\n${WEBSITE}/tokens`}`;
        twitter_message = `${twitter_message}\n\n${data.map(d => `#${split(d.name, 'normal', ' ').join('')}`).join(' ')} #Cryptocurrency`;
        twitter_messages.push(twitter_message);
        telegram_messages.push(telegram_message);
      }
    }
  }
  if (telegram_messages.length > 0) {
    await telegram(telegram_messages);
    alerted = true;
  }
  if (twitter_messages.length > 0) {
    await twitter(twitter_messages);
    alerted = true;
  }

  return alerted;
};