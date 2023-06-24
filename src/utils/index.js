const _ = require('lodash');
const numeral = require('numeral');

const { numberFormatUnits } = require('./number');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const equalsIgnoreCase = (a, b) => (!a && !b) || a?.toLowerCase() === b?.toLowerCase();

const toCase = (string, to_case = 'normal') => {
  if (typeof string === 'string') {
    string = string.trim();
    switch (to_case) {
      case 'upper':
        string = string.toUpperCase();
        break;
      case 'lower':
        string = string.toLowerCase();
        break;
      default:
        break;
    }
  }
  return string;
};

const split = (
  string,
  to_case = 'normal',
  delimiter = ',',
  filter_blank = true,
) =>
  (typeof string !== 'string' && ![undefined, null].includes(string) ?
    [string] :
    (typeof string === 'string' ? string : '').split(delimiter).map(s => toCase(s, to_case))
  )
  .filter(s => !filter_blank || s);

const toArray = (
  x,
  to_case = 'normal',
  delimiter = ',',
  filter_blank = true,
) =>
  Array.isArray(x) ?
    x.map(v => toCase(v, to_case)).filter(v => !filter_blank || v) :
    split(x, to_case, delimiter, filter_blank);

const find = (x, list = []) => list.find(_x => typeof x === 'string' ? equalsIgnoreCase(_x, x) : _x === x);

const includesStringList = (x, list = []) => toArray(list).findIndex(s => toArray(x).findIndex(_x => _x.includes(s)) > -1) > -1;

const removeDecimal = number => {
  if (typeof number === 'number') {
    number = number.toString();
  }
  if (number.includes('NaN')) {
    return number.replace('NaN', '< 0.00000001');
  }
  if (typeof number === 'string') {
    if (number.indexOf('.') > -1) {
      let decimal = number.substring(number.indexOf('.') + 1);
      while (decimal.endsWith('0')) {
        decimal = decimal.substring(0, decimal.length - 1);
      }
      if (number.substring(0, number.indexOf('.')).length >= 7 && decimal.length > 2 && !isNaN(`0.${decimal}`)) {
        decimal = Number(`0.${decimal}`).toFixed(2);
        if (decimal.indexOf('.') > -1) {
          decimal = decimal.substring(decimal.indexOf('.') + 1);
          while (decimal.endsWith('0')) {
            decimal = decimal.substring(0, decimal.length - 1);
          }
        }
      }
      return `${number.substring(0, number.indexOf('.'))}${decimal ? '.' : ''}${decimal}`;
    }
    return number;
  }
  return '';
};

const numberFormat = (number, format, is_exact) => {
  if (number === Infinity) {
    return number.toString();
  }
  let formatted_number = numeral(number).format(format.includes('.000') && Math.abs(Number(number)) >= 1.01 ? format.substring(0, format.indexOf('.') + (is_exact ? 7 : 3)) : format === '0,0' && Number(number) < 1 ? '0,0.00' : format);
  if (['NaN', 'e+', 'e-', 't'].findIndex(s => formatted_number.includes(s)) > -1) {
    formatted_number = number.toString();

    const toDecimal = n => {
      const sign = Math.sign(n);
      if (/\d+\.?\d*e[\+\-]*\d+/i.test(n)) {
        const zero = '0';
        const parts = String(n).toLowerCase().split('e');
        const e = parts.pop();
        let l = Math.abs(e);
        const direction = e / l;
        const coeff_array = parts[0].split('.');
        if (direction === -1) {
          coeff_array[0] = Math.abs(coeff_array[0]);
          n = `${zero}.${new Array(l).join(zero)}${coeff_array.join('')}`;
        }
        else {
          const dec = coeff_array[1];
          if (dec) {
            l = l - dec.length;
          }
          n = `${coeff_array.join('')}${new Array(l + 1).join(zero)}`;
        }
      }
      return sign < 0 ? -n : n;
    }

    if (formatted_number.includes('e-')) {
      formatted_number = toDecimal(number);
    }
    else if (formatted_number.includes('e+')) {
      const [n, e] = formatted_number.split('e+');
      if (Number(e) <= 72) {
        const fixed_decimals = 2;
        let _number = `${parseInt(Number(Number(n).toFixed(fixed_decimals)) * Math.pow(10, fixed_decimals))}${_.range(Number(e)).map(i => '0').join('')}`;
        _number = Number(numberFormatUnits(BigInt(_number), 16 + fixed_decimals));
        const _format = `0,0${_number >= 100000 ? '.00a' : _number >= 100 ? '' : _number >= 1 ? '.00' : '.000000'}`;
        return `${numberFormat(_number, _format)}t`;
      }
      else {
        return numeral(number).format('0,0e+0');
      }
    }
    else {
      return numeral(number).format(`0,0${number < 1 ? '.00' : ''}a`);
    }
  }
  else if (typeof number === 'number' && !format?.includes('a') && Number(split(formatted_number).join('')).toString() !== removeDecimal(split(formatted_number).join(''))) {
    formatted_number = number.toString();
  }

  let string = removeDecimal(formatted_number) || '';
  if (string.toLowerCase().endsWith('t') && split(string).length > 1) {
    string = numeral(number).format('0,0e+0');
  }
  if (['0.0', ''].includes(string)) {
    string = '0';
  }
  return toCase(string, 'upper');
};

const names = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
};

const capitalize = s => typeof s !== 'string' ? '' : `${s.substr(0, 1).toUpperCase()}${s.substr(1)}`;

const getTitle = (s, data) => names[s] ? names[s] : data?.name && data.id === s ? data.name : s && s.length <= 3 ? s.toUpperCase() : capitalize(s);

const camel = (s, delimiter = '_') => toArray(s, 'normal', delimiter).map((s, i) => i > 0 ? capitalize(s) : s).join('');

const toJson = s => {
  if (s) {
    if (typeof s === 'object') {
      return s;
    }
    try {
      return JSON.parse(s);
    } catch (error) {}
  }
  return null;
};

const normalizeQuote = (string, to_case = 'normal') => split(string, 'normal', '"').join('');

const parseRequestError = error => { return { error: error?.response?.data } };

module.exports = {
  sleep,
  equalsIgnoreCase,
  split,
  toArray,
  find,
  includesStringList,
  numberFormat,
  capitalize,
  getTitle,
  camel,
  toJson,
  normalizeQuote,
  parseRequestError,
};