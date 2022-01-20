const addZero = require('./addZero');

function formatDate(date) {
  return date.getUTCFullYear() + '-' + addZero(date.getUTCMonth() + 1) + '-' + addZero(date.getUTCDate()) + ' 23:59:59';
}

module.exports = formatDate;