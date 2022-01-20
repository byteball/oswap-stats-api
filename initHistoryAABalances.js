const db = require('ocore/db.js');
const formatDate = require('./helpers/formatDate')
const { dumpByAddress } = require('./dumpFunction');

async function getAllAAs() {
  const rows = await db.query("SELECT address FROM oswap_aas");
  return rows.map(r => r.address);
}

async function getSyncStartDataForAAs(aas) {
  const assocAAtoDate = {}
  for (let n in aas) {
    const rows = await db.query(
      "SELECT balance_date FROM oswap_aa_balances WHERE address = ? ORDER BY balance_date DESC LIMIT 1",
      [aas[n]]);
      assocAAtoDate[aas[n]] = rows.length ? rows[0].balance_date : null;
  }
  return assocAAtoDate;
}

async function fillAABalances(address, startDate) {
  let days;
  if (startDate === null) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 30);
    days = 30;
    startDate = date;
  } else {
    const date = new Date(startDate.replace(' ', 'T') + 'Z');
    const nowDate = new Date();
    days = Math.ceil((nowDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    startDate = date;
  }
  for(let i = 0; i <= days; i++) {
    await dumpByAddress(formatDate(startDate), address)
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
}

async function initHistoryAABalances() {
  const aas = await getAllAAs();
  const aasWithDate = await getSyncStartDataForAAs(aas);
  for (let address in aasWithDate) {
    await fillAABalances(address, aasWithDate[address]);
    console.log('Init aa balances:', address);
  }
  console.log('Init aa balances: done');
}

module.exports = initHistoryAABalances;