const db = require('ocore/db');
const sqlite_tables = require('./sqlite_tables');

(async () => {
	await db.query("DROP TABLE daily_candles");
	await db.query("DROP TABLE hourly_candles");
	await db.query("DELETE FROM oswap_aa_balances");
	await sqlite_tables.create();
	console.log('done');
})();