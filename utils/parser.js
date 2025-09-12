const toJson = string => {
  if (!string) return null;
  if (typeof string === 'object') return string;
  try {
    return JSON.parse(string);
  } catch (error) {
    return null;
  }
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

const getOptions = options => {
  let { delimiter, toCase: _toCase, filterBlank } = { ...options };
  delimiter = typeof delimiter === 'string' ? delimiter : ',';
  _toCase = _toCase || 'normal';
  filterBlank = typeof filterBlank === 'boolean' ? filterBlank : true;
  return { ...options, delimiter, toCase: _toCase, filterBlank };
};

const split = (string, options) => {
  const { delimiter, toCase: _toCase, filterBlank } = { ...getOptions(options) };
  return (typeof string !== 'string' && ![undefined, null].includes(string) ? [string] : (typeof string === 'string' ? string : '').split(delimiter).map(s => toCase(s, _toCase))).filter(s => !filterBlank || s);
};

const toArray = (x, options) => {
  options = getOptions(options);
  const { toCase: _toCase, filterBlank } = { ...options };
  if (Array.isArray(x)) return x.map(_x => toCase(_x, _toCase)).filter(_x => !filterBlank || _x);
  return split(x, options);
};

module.exports = {
  toJson,
  toCase,
  split,
  toArray,
};