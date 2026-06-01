const formatNumber = (n) => Math.floor(Number(n)).toLocaleString('en-US');

function parseAmount(str, balance) {
    if (!str) return NaN;
    const s = str.toString().toLowerCase().trim();
    if (s === 'all' || s === 'max') return balance ?? NaN;
    const k = s.match(/^(\d+(?:\.\d+)?)k$/);
    if (k) return parseFloat(k[1]) * 1_000;
    const m = s.match(/^(\d+(?:\.\d+)?)m$/);
    if (m) return parseFloat(m[1]) * 1_000_000;
    return parseFloat(s);
}

module.exports = { formatNumber, parseAmount };