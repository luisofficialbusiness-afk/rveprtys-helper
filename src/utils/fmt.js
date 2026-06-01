const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');
module.exports = { fmt, fmtInt };
