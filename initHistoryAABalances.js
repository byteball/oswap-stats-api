const { getAllAAs, getSyncStartDateForAAs, fillAABalances } = require('./dumpFunctions');

async function initHistoryAABalances() {
	const aas = await getAllAAs();
	const aasWithDate = await getSyncStartDateForAAs(aas);
	for (let address in aasWithDate) {
		await fillAABalances(address, aasWithDate[address]);
		console.log('Init aa balances:', address);
	}
	console.log('Init aa balances: done');
}

module.exports = initHistoryAABalances;