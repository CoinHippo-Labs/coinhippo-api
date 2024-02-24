const { decodeBase64, getAddress, hexlify } = require('ethers');

const getIcapAddress = string => {
  try {
    return string?.startsWith('0x') ? getAddress(string) : string;
  } catch (error) {
    return string;
  }
};

const base64ToHex = string => {
  try {
    return hexlify(decodeBase64(string));
  } catch (error) {
    return string;
  }
};

const toJson = string => {
  if (!string) return null;
  if (typeof string === 'object') return string;
  try {
    return JSON.parse(string);
  } catch (error) {
    return null;
  }
};

const toHex = byteArray => {
  let string = '0x';
  if (typeof byteArray === 'string' && byteArray.startsWith('[') && byteArray.endsWith(']')) byteArray = toJson(byteArray);
  if (Array.isArray(byteArray)) byteArray.forEach(byte => string += ('0' + (byte & 0xFF).toString(16)).slice(-2));
  else string = byteArray;
  return string;
};

const toCase = (string, _case = 'normal') => {
  if (typeof string !== 'string') return string;
  string = string.trim();
  switch (_case) {
    case 'upper':
      string = string.toUpperCase();
      break;
    case 'lower':
      string = string.toLowerCase();
      break;
    default:
      break;
  }
  return string;
};

const split = (string, options) => {
  let { delimiter, toCase: _toCase, filterBlank } = { ...options };
  delimiter = typeof delimiter === 'string' ? delimiter : ',';
  _toCase = _toCase || 'normal';
  filterBlank = typeof filterBlank === 'boolean' ? filterBlank : true;
  return (typeof string !== 'string' && ![undefined, null].includes(string) ? [string] : (typeof string === 'string' ? string : '').split(delimiter).map(s => toCase(s, _toCase))).filter(s => !filterBlank || s);
};

const toArray = (x, options) => {
  let { delimiter, toCase: _toCase, filterBlank } = { ...options };
  delimiter = typeof delimiter === 'string' ? delimiter : ',';
  _toCase = _toCase || 'normal';
  filterBlank = typeof filterBlank === 'boolean' ? filterBlank : true;
  if (Array.isArray(x)) return x.map(_x => toCase(_x, _toCase)).filter(_x => !filterBlank || _x);
  return split(x, { delimiter, toCase: _toCase, filterBlank });
};

module.exports = {
  getIcapAddress,
  base64ToHex,
  toJson,
  toHex,
  toCase,
  split,
  toArray,
};