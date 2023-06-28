const _ = require('lodash');
const moment = require('moment');

const whaleAlert = require('../whaleAlert');
const { twitter, telegram } = require('../broadcasts');
const { equalsIgnoreCase, split, toArray, numberFormat, getTitle } = require('../../utils');

const DONATION_KEYWORDS = ['charity', 'donation' ,'donate'];
const HACKED_KEYWORDS = ['hack'];
const HUGE_SYMBOLS = ['btc', 'eth', 'usdt', 'usdc'];
const MIN_AMOUNT = 1e7;

const repeatEmoji = d => {
  const { amount_usd, transaction_type, is_donation, is_hacked } = { ...d };

  let emoji;
  switch (transaction_type) {
    case 'mint':
      emoji = '🖨';
      break;
    case 'burn':
      emoji = '🔥';
      break;
    case 'lock':
      emoji = '🔐';
      break;
    case 'unlock':
      emoji = '🔓';
    case '':
      if (is_donation) {
        emoji = '🎁';
      }
      else if (is_hacked) {
        emoji = '🥷';
      }
      else {
        if (amount_usd <= 5 * MIN_AMOUNT) {
          emoji = '🐟';
        }
        else if (amount_usd <= 10 * MIN_AMOUNT) {
          emoji = '🐬';
        }
        else if (amount_usd <= 50 * MIN_AMOUNT) {
          emoji = '🐋';
        }
        else {
          emoji = '🐳';
        }
      }
      break;
  }

  const repeatConditions = [
    { n: 1, test: v => v <= (transaction_type !== 'transfer' ? 1.5 : is_donation || is_hacked ? 1 : 5) * MIN_AMOUNT },
    { n: 2, test: v => v <= (transaction_type !== 'transfer' ? 3 : is_donation || is_hacked ? 2 : 10) * MIN_AMOUNT },
    { n: 3, test: v => v <= (transaction_type !== 'transfer' ? 10 : is_donation || is_hacked ? 5 : 50) * MIN_AMOUNT },
    { n: 4, test: () => true },
  ];
  const { n } = repeatConditions.find(c => c.test(amount_usd));
  return _.range(n).map(i => emoji).join('');
};

const getValueFromList = (data, fields = [], strategy = 'first') => {
  data = toArray(
    toArray(data).map(v => {
      let _v = v;
      for (const field of toArray(fields, 'normal', '.')) {
        if (_v) {
          _v = _v[field];
        }
        else {
          break;
        }
      }
      return _v;
    })
  );
  switch (strategy) {
    case 'first':
      return _.head(data);
    case 'uniq':
      return _.uniq(data);
    default:
      return data;
  }
};

module.exports = async () => {
  let alerted;

  const now = moment();
  const response = await whaleAlert({ start: moment(now).subtract(3, 'minutes').unix(), end: moment(now).unix() });
  let data = toArray(response?.transactions);

  data = _.orderBy(
    Object.entries(_.groupBy(data, 'hash')).map(([k, v]) => {
      return {
        k, v,
        amount: _.sumBy(v, 'amount'),
        amount_usd: _.sumBy(v, 'amount_usd'),
        timestamp: _.min(v.map(d => d.timestamp)),
      };
    }),
    ['amount_usd', 'timestamp'],
    ['desc', 'asc'],
  )
  .filter(d => d.v?.findIndex(v => v.symbol) > -1)
  .map(d => {
    const { v } = { ...d };
    const transaction_type = getValueFromList(v, 'transaction_type');
    return {
      ...d,
      transaction_type,
      blockchain: getValueFromList(v, 'blockchain'),
      symbol: getValueFromList(v, 'symbol'),
      from_addresses: getValueFromList(v, 'from.address', 'uniq'),
      from_address_name: getValueFromList(v, 'from.owner'),
      from_address_type: getValueFromList(v.filter(v => v.from?.owner), 'from.owner_type'),
      to_addresses: getValueFromList(v, 'to.address', 'uniq'),
      to_address_name: getValueFromList(v, 'to.owner'),
      to_address_type: getValueFromList(v.filter(v => v.to?.owner), 'to.owner_type'),
      is_donation: transaction_type === 'transfer' && getValueFromList(v, 'to.owner', 'uniq').findIndex(v => DONATION_KEYWORDS.findIndex(k => v.toLowerCase().includes(k)) > -1) > -1,
      is_hacked: transaction_type === 'transfer' && getValueFromList(v, 'from.owner', 'uniq').findIndex(v => HACKED_KEYWORDS.findIndex(k => v.toLowerCase().includes(k)) > -1) > -1,
    };
  })
  .map(d => {
    const { symbol, from_address_name, to_address_name } = { ...d };
    return {
      ...d,
      from_address_name: getTitle(from_address_name ? split(from_address_name, 'normal', ' ').map(s => s.replace(symbol, symbol.toUpperCase())).join(' ') : symbol === 'husd' ? `${symbol.toUpperCase()} incinerator` : 'unknown wallet'),
      to_address_name: getTitle(to_address_name ? split(from_address_name, 'normal', ' ').map(s => s.replace(symbol, symbol.toUpperCase())).join(' ') : 'unknown wallet'),
    };
  })
  .filter(d => {
    const { from_address_name, from_address_type, to_address_name, to_address_type } = { ...d };
    return from_address_name && to_address_name && [from_address_name, to_address_name].findIndex(s => !s.toLowerCase().includes('unknown owner')) > -1 && !(from_address_type === 'exchange' && to_address_type === 'exchange' && equalsIgnoreCase(from_address_name, to_address_name));
  })
  .filter(d => {
    const { v, amount_usd, transaction_type, symbol, from_address_name, to_address_name, is_donation, is_hacked } = { ...d };
    return v && amount_usd >= (transaction_type !== 'transfer' ? 1.5 : is_donation || is_hacked ? 0.25 : 3) * (equalsIgnoreCase(from_address_name, to_address_name) && HUGE_SYMBOLS.indexOf(symbol) > -1 ? 1.5 : 1) * MIN_AMOUNT;
  })
  .map(d => {
    const { k } = { ...d };
    let { blockchain } = { ...d };
    blockchain = blockchain?.toLowerCase();
    let url;
    switch (blockchain) {
      case 'bitcoin':
        url = `https://www.blockchain.com/btc/tx/${k}`;
        break;
      case 'ethereum':
        url = `https://etherscan.io/tx/${!k.startsWith('0x') ? '0x' : ''}${k}`;
        break;
      case 'binancechain':
        url = `https://bscscan.com/tx/${!k.startsWith('0x') ? '0x' : ''}${k}`;
        break;
      case 'arbitrum':
        url = `https://arbitrum.io/tx/${!k.startsWith('0x') ? '0x' : ''}${k}`;
        break;
      case 'ripple':
        url = `https://xrpscan.com/tx/${k}`;
        break;
      case 'tron':
        url = `https://tronscan.org/#/transaction/${k}`;
        break;
      case 'eos':
        url = `https://eosflare.io/tx/${k}`;
        break;
      case 'stellar':
        url = `https://stellarchain.io/tx/${k}`;
        break;
      case 'neo':
        url = `https://neoscan.io/transaction/${k}`;
        break;
      default:
        url = `https://whale-alert.io/transaction/${blockchain}/${k}`;
        break;
    }
    return { ...d, url };
  });

  if (data.length > 0) {
    let twitter_message = '';
    let telegram_message = '';
    _.orderBy(_.slice(data, 0, 5), ['timestamp'], ['asc']).forEach((d, i) => {
      const { symbol, amount, amount_usd, url, transaction_type, from_address_name, to_address_name, is_donation, is_hacked } = { ...d };
      telegram_message = `${telegram_message}${i === 0 ? '' : '\n\n'}`;
      telegram_message = `${telegram_message}<a href="${url}">${repeatEmoji(d)} ${transaction_type ? getTitle(is_donation ? 'donation' : is_hacked ? 'stolen funds' : transaction_type) : 'transaction'}</a> <b>${numberFormat(amount, '0,0')} ${symbol.toUpperCase()}</b> <pre>$${numberFormat(amount_usd, '0,0')}</pre>\n${transaction_type === 'mint' ? `at ${to_address_name}` : transaction_type === 'burn' ? `at ${from_address_name}` : transaction_type === 'lock' ? `at ${to_address_name}` : transaction_type === 'unlock' ? `at ${to_address_name}` : `${from_address_name.replace('Unknown ', '❔')} ➡️ ${to_address_name.replace('Unknown ', '❔')}`}`;
    });
    data = _.orderBy(
      _.slice(
        data.filter(d => {
          const { symbol, amount_usd, transaction_type, from_address_name, to_address_name, is_donation, is_hacked } = { ...d };
          return amount_usd >= (transaction_type !== 'transfer' ? 2 : is_donation || is_hacked ? 0.4 : 5) * (equalsIgnoreCase(from_address_name, to_address_name) && HUGE_SYMBOLS.indexOf(symbol) > -1 ? 2 : 1) * MIN_AMOUNT;
        }),
        0, 3,
      ),
      ['timestamp'], ['asc'],
    );
    data.forEach((d, i) => {
      const { symbol, amount, amount_usd, url, transaction_type, from_address_name, to_address_name, is_donation, is_hacked } = { ...d };
      twitter_message = `${twitter_message}${i === 0 ? `Recent whale${data.length > 1 ? `s'` : `'s`} activit${data.length > 1 ? 'ies' : 'y'} you should be notified.` : ''}\n`;
      twitter_message = `${twitter_message}${i > 0 ? '\n' : ''}- ${repeatEmoji(d)} ${transaction_type ? getTitle(is_donation ? 'donation' : is_hacked ? 'stolen funds' : transaction_type) : 'transaction'} ${numberFormat(amount, '0,0')} ${symbol.toUpperCase()} ($${numberFormat(amount_usd, '0,0')})\n${transaction_type === 'mint' ? `at ${to_address_name}` : transaction_type === 'burn' ? `at ${from_address_name}` : transaction_type === 'lock' ? `at ${to_address_name}` : transaction_type === 'unlock' ? `at ${to_address_name}` : `${from_address_name.replace('Unknown ', '❔')} ➡️ ${to_address_name.replace('Unknown ', '❔')}`}`;
      twitter_message = `${twitter_message}${data.length < 3 ? `\n${url}` : ''}`;
    });
    twitter_message = `${twitter_message}${data.length > 2 ? '' : `\n\n${_.uniq(toArray(_.concat(data.map(d => `${d.blockchain ? `#${getTitle(d.blockchain)}` : ''}`), data.flatMap(d => [[' ', 'unknown'].findIndex(s => d.from_address_name.toLoweCase().includes(s)) < 0 && `#${getTitle(d.from_address_name)}`, [' ', 'unknown'].findIndex(s => d.to_address_name.toLoweCase().includes(s)) < 0 && `#${getTitle(d.to_address_name)}`])))).join(' ')} #WhaleAlert`}`;
    if (telegram_message) {
      await telegram([telegram_message]);
      alerted = true;
    }
    if (twitter_message) {
      await twitter(twitter_message);
      alerted = true;
    }
  }

  return alerted;
};