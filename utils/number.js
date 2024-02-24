const { FixedNumber, isHexString, formatUnits: _formatUnits, parseUnits: _parseUnits } = require('ethers');
const numeral = require('numeral');

const { split } = require('./parser');
const { isString, headString } = require('./string');

const isNumber = number => typeof number === 'number' || (isString(number) && number && !isNaN(number));

const toNumber = number => isNumber(number) ? Number(number) : 0;

const toBigNumber = number => {
  try {
    return number.round(0).toString().replace('.0', '');
  } catch (error) {
    return headString((isHexString(number?.hex) ? BigInt(number.hex) : isHexString(number) ? BigInt(number) : number)?.toString(), '.') || '0';
  }
};

const toFixedNumber = number => FixedNumber.fromString(number?.toString().includes('.') ? number.toString() : toBigNumber(number));

const formatUnits = (number = '0', decimals = 18, parseNumber = true) => {
  const formattedNumber = _formatUnits(toBigNumber(number), decimals);
  return parseNumber ? toNumber(formattedNumber) : formattedNumber;
};

const parseUnits = (number = 0, decimals = 18) => {
  try {
    number = number.toString();
    if (number.includes('.')) {
      const [_number, _decimals] = split(number, { delimiter: '.' });
      if (isString(_decimals) && _decimals.length > decimals) {
        let output = `${_number}${_decimals.substring(0, decimals)}`;
        while (output.length > 1 && output.startsWith('0')) {
          output = output.substring(1);
        }
        return output;
      }
    }
    return toBigNumber(_parseUnits(number, decimals));
  } catch (error) {
    return '0';
  }
};

const toFixed = (number = 0, decimals = 18) => toNumber(number).toFixed(decimals);

const removeDecimals = number => {
  if (isNumber(number)) number = number.toString();
  if (!number) return '';
  if (number.includes('NaN')) return number.replace('NaN', '< 0.00000001');
  if (!(number.indexOf('.') > -1)) return number;

  let decimals = number.substring(number.indexOf('.') + 1);
  while (decimals.endsWith('0')) decimals = decimals.substring(0, decimals.length - 1);

  if (number.substring(0, number.indexOf('.')).length >= 7 && decimals.length > 2 && isNumber(`0.${decimals}`)) {
    decimals = toFixed(`0.${decimals}`, 2);
    if (decimals.indexOf('.') > -1) {
      decimals = decimals.substring(decimals.indexOf('.') + 1);
      while (decimals.endsWith('0')) decimals = decimals.substring(0, decimals.length - 1);
    }
  }

  return `${number.substring(0, number.indexOf('.'))}${decimals ? '.' : ''}${decimals}`;
};

const toDecimals = n => {
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
      if (dec) l = l - dec.length;
      n = `${coeff_array.join('')}${new Array(l + 1).join(zero)}`;
    }
  }

  return sign < 0 && isString(n) && !n.startsWith('-') ? -n : n;
};

const numberFormat = (number, format, exact) => {
  if (number === Infinity) return number.toString();

  let formattedNumber = numeral(number).format(format.includes('.000') && Math.abs(Number(number)) >= 1.01 ? format.substring(0, format.indexOf('.') + (exact ? 7 : 3)) : format === '0,0' && toNumber(number) < 1 ? '0,0.00' : format);
  if (['NaN', 'e+', 'e-', 't'].findIndex(s => formattedNumber.includes(s)) > -1) {
    formattedNumber = number.toString();

    if (formattedNumber.includes('e-')) formattedNumber = toDecimals(number);
    else if (formattedNumber.includes('e+')) {
      const [n, e] = formattedNumber.split('e+');

      if (toNumber(e) <= 72) {
        const fixedDecimals = 2;

        let _number = `${parseInt(toNumber(toFixed(n, fixedDecimals)) * Math.pow(10, fixedDecimals))}${_.range(Number(e)).map(i => '0').join('')}`;
        _number = formatUnits(BigInt(_number), 16 + fixedDecimals);

        const _format = `0,0${_number >= 100000 ? '.00a' : _number >= 100 ? '' : _number >= 1 ? '.00' : '.000000'}`;
        return `${numberFormat(_number, _format)}t`;
      }
      else return numeral(number).format('0,0e+0');
    }
    else return numeral(number).format(`0,0${number < 1 ? '.00' : ''}a`);
  }
  else if (isNumber(number) && ['a', '+'].findIndex(c => format.includes(c)) < 0 && toNumber(split(formattedNumber).join('')).toString() !== removeDecimals(split(formattedNumber).join(''))) formattedNumber = number.toString();

  let string = removeDecimals(formattedNumber);
  if (string.toLowerCase().endsWith('t') && split(string).length > 1) string = numeral(number).format('0,0e+0');
  if (['0.0', ''].includes(string)) string = '0';

  return toCase(string, 'upper');
};

module.exports = {
  isNumber,
  toNumber,
  toBigNumber,
  toFixedNumber,
  formatUnits,
  parseUnits,
  toFixed,
  removeDecimals,
  numberFormat,
};