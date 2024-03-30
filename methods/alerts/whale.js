const _ = require('lodash');
const moment = require('moment');

const whaleAlert = require('../whaleAlert');
const { telegram } = require('../broadcasts');
const { split, toArray } = require('../../utils/parser');
const { equalsIgnoreCase, toTitle } = require('../../utils/string');

const DONATION_KEYWORDS = ['charity', 'donation' ,'donate'];
const HACKED_KEYWORDS = ['hack'];
const HUGE_SYMBOLS = ['btc', 'eth', 'usdt', 'usdc'];
const MIN_AMOUNT = 1e7;

const repeatEmoji = d => {
  let emoji;
  switch (d.transaction_type) {
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
      break;
    default:
      if (d.is_donation) emoji = '🎁';
      else if (d.is_hacked) emoji = '🥷';
      else emoji = d.amount_usd <= 5 * MIN_AMOUNT ? '🐟' : d.amount_usd <= 10 * MIN_AMOUNT ? '🐬' : d.amount_usd <= 50 * MIN_AMOUNT ? '🐋' : '🐳';
      break;
  }

  const repeatConditions = [
    { n: 1, test: v => v <= (d.transaction_type !== 'transfer' ? 1.5 : d.is_donation || d.is_hacked ? 1 : 5) * MIN_AMOUNT },
    { n: 2, test: v => v <= (d.transaction_type !== 'transfer' ? 3 : d.is_donation || d.is_hacked ? 2 : 10) * MIN_AMOUNT },
    { n: 3, test: v => v <= (d.transaction_type !== 'transfer' ? 10 : d.is_donation || d.is_hacked ? 5 : 50) * MIN_AMOUNT },
    { n: 4, test: () => true },
  ];
  const { n } = { ...repeatConditions.find(c => c.test(amount_usd)) };
  return _.range(n).map(i => emoji).join('');
};

const getValueFromList = (data, fields = [], strategy = 'first') => {
  data = toArray(toArray(data).map(d => {
    let _d = d;
    for (const field of toArray(fields, { delimiter: '.' })) {
      if (_d) _d = _d[field];
      else break;
    }
    return _d;
  }));
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
  const { transactions } = { ...await whaleAlert({ start: moment().subtract(3, 'minutes').unix(), end: moment().unix() }) };
  const data = _.orderBy(Object.entries(_.groupBy(toArray(transactions), 'hash')).map(([k, v]) => {
    return {
      k, v,
      amount: _.sumBy(v, 'amount'),
      amount_usd: _.sumBy(v, 'amount_usd'),
      timestamp: _.min(v.map(d => d.timestamp)),
    };
  }), ['amount_usd', 'timestamp'], ['desc', 'asc']).filter(d => toArray(d.v).findIndex(d => d.symbol) > -1).map(d => {
    const { v } = { ...d };
    const transaction_type = getValueFromList(v, 'transaction_type');
    return {
      ...d,
      transaction_type,
      blockchain: getValueFromList(v, 'blockchain'),
      symbol: getValueFromList(v, 'symbol'),
      from_addresses: getValueFromList(v, 'from.address', 'uniq'),
      from_address_name: getValueFromList(v, 'from.owner'),
      from_address_type: getValueFromList(v.filter(d => d.from?.owner), 'from.owner_type'),
      to_addresses: getValueFromList(v, 'to.address', 'uniq'),
      to_address_name: getValueFromList(v, 'to.owner'),
      to_address_type: getValueFromList(v.filter(d => d.to?.owner), 'to.owner_type'),
      is_donation: transaction_type === 'transfer' && getValueFromList(v, 'to.owner', 'uniq').findIndex(d => DONATION_KEYWORDS.findIndex(k => d.toLowerCase().includes(k)) > -1) > -1,
      is_hacked: transaction_type === 'transfer' && getValueFromList(v, 'from.owner', 'uniq').findIndex(d => HACKED_KEYWORDS.findIndex(k => d.toLowerCase().includes(k)) > -1) > -1,
    };
  }).map(d => ({ ...d, from_address_name: toTitle(d.from_address_name ? split(d.from_address_name, { delimiter: ' ' }).map(s => s.replace(d.symbol, d.symbol.toUpperCase())).join(' ') : d.symbol === 'husd' ? `${d.symbol.toUpperCase()} incinerator` : 'unknown wallet'), to_address_name: toTitle(d.to_address_name ? split(d.to_address_name, { delimiter: ' ' }).map(s => s.replace(d.symbol, d.symbol.toUpperCase())).join(' ') : 'unknown wallet') }))
  .filter(d => d.from_address_name && d.to_address_name && [d.from_address_name, d.to_address_name].findIndex(s => !s.toLowerCase().includes('unknown owner')) > -1 && !(d.from_address_type === 'exchange' && d.to_address_type === 'exchange' && equalsIgnoreCase(d.from_address_name, d.to_address_name)))
  .filter(d =>  d.v && d.amount_usd >= (d.transaction_type !== 'transfer' ? 1.5 : d.is_donation || d.is_hacked ? 0.25 : 3) * (equalsIgnoreCase(d.from_address_name, d.to_address_name) && HUGE_SYMBOLS.indexOf(d.symbol) > -1 ? 1.5 : 1) * MIN_AMOUNT).map(d => {
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

  if (!(data.length > 0)) return;
  let message = '';
  _.orderBy(_.slice(data, 0, 5), ['timestamp'], ['asc']).forEach((d, i) => {
    message = `${message}${i === 0 ? '' : '\n\n'}`;
    message = `${message}<a href="${d.url}">${repeatEmoji(d)} ${d.transaction_type ? toTitle(d.is_donation ? 'donation' : d.is_hacked ? 'stolen funds' : d.transaction_type) : 'transaction'}</a> <b>${d.amount} ${d.symbol.toUpperCase()}</b> <pre>$${d.amount_usd}</pre>\n${d.transaction_type === 'mint' ? `at ${d.to_address_name}` : d.transaction_type === 'burn' ? `at ${d.from_address_name}` : d.transaction_type === 'lock' ? `at ${d.to_address_name}` : d.transaction_type === 'unlock' ? `at ${d.to_address_name}` : `${d.from_address_name.replace('Unknown ', '❔')} ➡️ ${d.to_address_name.replace('Unknown ', '❔')}`}`;
  });
  await telegram(message);
  return true;
};