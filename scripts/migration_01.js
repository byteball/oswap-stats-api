const db = require("ocore/db");
const sqlite_table = require('../sqlite_tables');

(async () => {
	await db.query('ALTER TABLE trades ADD aa_address CHAR(32)');
	const rows = await db.query("SELECT unit, address FROM trades \
        JOIN unit_authors ON unit_authors.unit = trades.response_unit");
	await db.query("BEGIN");
	for (let row of rows) {
		await db.query("UPDATE trades SET aa_address=? WHERE response_unit=?", [row.address, row.unit]);
	}
	await db.query("COMMIT");

	await db.query('CREATE TABLE tmp_trades AS SELECT * FROM trades');
	await db.query('DROP TABLE trades');
	await db.query("CREATE TABLE IF NOT EXISTS trades (\
        aa_address CHAR(32) NOT NULL, \
        response_unit CHAR(44) NOT NULL, \
        indice INTEGER DEFAULT 0, \
        base CHAR(44) NOT NULL, \
        quote CHAR(44) NOT NULL, \
        quote_qty INTEGER NOT NULL, \
        base_qty INTEGER NOT NULL, \
        type VARCHAR(40), \
        timestamp TIMESTAMP NOT NULL, \
        UNIQUE (response_unit, indice)\
    )");
	await db.query("INSERT INTO trades (aa_address, response_unit, indice, base, quote, quote_qty, base_qty, type,  timestamp) \
        SELECT aa_address, response_unit, indice,  base, quote, quote_qty, base_qty, type, timestamp FROM tmp_trades;")
	await db.query("CREATE INDEX IF NOT EXISTS tradesByBaseQuoteAndTime ON trades(aa_address,base,quote,timestamp)");
	await db.query("CREATE INDEX IF NOT EXISTS tradesByQuoteBaseAndTime ON trades(aa_address,quote,base,timestamp)");
	await db.query('DROP TABLE tmp_trades');

	await db.query('DROP TABLE IF EXISTS hourly_candles');
	await db.query('DROP TABLE IF EXISTS daily_candles');
	await db.query('DROP TABLE IF EXISTS oswap_aa_balances');
	await sqlite_table.create();

	console.log('done')
})();