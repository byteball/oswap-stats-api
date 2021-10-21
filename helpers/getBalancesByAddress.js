const db = require('ocore/db.js');

async function getBalancesByAddress(address) {
  const rows = await db.query(
    "SELECT address, asset, SUM(amount) AS balance \n\
    FROM outputs JOIN units USING(unit) \n\
    WHERE is_spent=0 AND is_stable=1 AND address=? AND sequence='good' \n\
    GROUP BY address, asset", [address]);
  if(address === 'UNSX6BCDLLZCLYOD7UFBJFVQIUQ2ENTU')
    console.log('gbb', rows);
  
  const balances = {};
  rows.forEach(row => {
    if (row.asset === null) row.asset = 'base';
    balances[row.asset] = row.balance;
  })
  return balances;
}

module.exports = getBalancesByAddress;