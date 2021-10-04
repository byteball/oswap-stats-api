function addZero(number) {
  return number < 10 ? '0' + number: number;
}

module.exports = addZero;