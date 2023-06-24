const normalizeObject = object => Array.isArray(object) ? object : Object.fromEntries(Object.entries(object).map(([k, v]) => [k, typeof v === 'object' ? normalizeObject(v) : typeof v === 'boolean' ? v : !isNaN(v) ? Number(v) : v]));

module.exports = {
  normalizeObject,
};