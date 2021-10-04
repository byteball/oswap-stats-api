const db = require('ocore/db');
const dump = require('./dumpFunction');
const addZero = require('./helpers/addZero');

async function init() {
  await db.query("CREATE TABLE IF NOT EXISTS oswap_aas_balances ( \n\
    address CHAR(32) NOT NULL, \n\
    asset CHAR(44) DEFAULT NULL, \n\
    balance BIGINT NOT NULL, \n\
    creation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\
    PRIMARY KEY (address, asset, creation_date))")


  let oswapAAs = await db.query("SELECT address FROM oswap_aas");
  oswapAAs = oswapAAs.map(row => row.address);
  const dates = [];
  const date = new Date();
  for (let i = 0; i < 60; i++) {
    date.setUTCDate(date.getUTCDate() - 1);
    dates.push(date.getUTCFullYear() + '-' + addZero(date.getUTCMonth() + 1) + '-' + addZero(date.getUTCDate()) + ' 23:59:59');
  }

  let n = 0;
  for (let d of dates) {
    await dump(d, oswapAAs);
    console.log(n + '/' + 59);
    n++;
  }
  
  console.log('done');
}
init();