const db = require('ocore/db');
const formatDate = require('./helpers/formatDate');

async function getAllAAs() {
	const rows = await db.query("SELECT address FROM oswap_aas");
	return rows.map(r => r.address);
}

async function getSyncStartDateForAAs(aas) {
	const assocAAtoDate = {}
	for (let aa of aas) {
		const rows = await db.query(
		"SELECT balance_date FROM oswap_aa_balances WHERE address = ? ORDER BY balance_date DESC LIMIT 30",
		[aa]);

		if (rows.length && rows.length === 30) {
			assocAAtoDate[aa] = rows[0].balance_date;
		} else {
			assocAAtoDate[aa] = null
		}
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
	for (let i = 0; i <= days; i++) {
		await dumpByAddress(formatDate(startDate), address)
		startDate.setUTCDate(startDate.getUTCDate() + 1);
	}
}


async function dumpByAddress(date, address) {
	const rows = await db.query('SELECT outputs.address, SUM(amount) AS balance, outputs.asset \n\
	FROM outputs \n\
	JOIN units USING(unit) \n\
	WHERE is_stable=1 AND sequence="good" AND creation_date<=? AND address=? \n\
	AND NOT EXISTS ( \n\
	SELECT 1 \n\
	FROM inputs \n\
	JOIN units USING(unit) \n\
	WHERE outputs.unit=inputs.src_unit \n\
	AND outputs.message_index=inputs.src_message_index \n\
	AND outputs.output_index=inputs.src_output_index \n\
	AND inputs.type="transfer" \n\
	AND is_stable=1 AND sequence="good" \n\
	AND creation_date<=?) \n\
	GROUP BY address, asset', [date, address, date]);

	console.log('DUMP BY ADDRESS::', date, address);
	for (let row of rows) {
		await db.query(
			"REPLACE INTO oswap_aa_balances (address, asset, balance, balance_date) VALUES (?,?,?,strftime('%Y-%m-%d %H:%M:%S', ?))",
			[row.address, row.asset === null ? 'GBYTE' : row.asset, row.balance, date]);
	}
}

module.exports = {getAllAAs, getSyncStartDateForAAs, fillAABalances, dumpByAddress};