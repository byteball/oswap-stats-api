const { getSyncStartDataForAAs, fillAABalances } = require('./dumpFunctions');

async function updateBalancesForOneAddress(aa) {
  const aasWithDate = await getSyncStartDataForAAs([aa]);
  for (let address in aasWithDate) {
    await fillAABalances(address, aasWithDate[address]);
    console.log('Update aa balances:', address);
  }
  console.log('Update aa balances: done');
}

module.exports = updateBalancesForOneAddress;