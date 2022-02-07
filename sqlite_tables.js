const db = require('ocore/db.js');

exports.create = async function(){
	console.log("will create tables if not exist");

	await db.query("CREATE TABLE IF NOT EXISTS hourly_candles (\n\
		aa_address CHAR(32) NOT NULL, \n\
		base CHAR(44) NOT NULL, \n\
		quote CHAR(44) NOT NULL, \n\
		quote_qty REAL DEFAULT 0, \n\
		base_qty REAL DEFAULT 0, \n\
		highest_price REAL, \n\
		lowest_price REAL, \n\
		open_price REAL, \n\
		close_price REAL, \n\
		start_timestamp TIMESTAMP NOT NULL, \n\
		UNIQUE (aa_address, base, quote, start_timestamp)\n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS daily_candles (\n\
		aa_address CHAR(32) NOT NULL, \n\
		base CHAR(44) NOT NULL, \n\
		quote CHAR(44) NOT NULL, \n\
		quote_qty REAL DEFAULT 0, \n\
		base_qty REAL DEFAULT 0, \n\
		highest_price REAL, \n\
		lowest_price REAL, \n\
		open_price REAL, \n\
		close_price REAL, \n\
		start_timestamp TIMESTAMP NOT NULL, \n\
		UNIQUE (aa_address, base, quote, start_timestamp)\n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS trades (\n\
		aa_address CHAR(32) NOT NULL, \n\
  	response_unit CHAR(44) NOT NULL, \n\
		indice INTEGER DEFAULT 0, \n\
		base CHAR(44) NOT NULL, \n\
		quote CHAR(44) NOT NULL, \n\
		quote_qty INTEGER NOT NULL, \n\
		base_qty INTEGER NOT NULL, \n\
		type VARCHAR(40), \n\
		timestamp TIMESTAMP NOT NULL, \n\
		UNIQUE (response_unit, indice)\n\
		FOREIGN KEY (aa_address) REFERENCES oswap_aas(address)\n\
	)");
	await db.query("CREATE INDEX IF NOT EXISTS tradesByBaseQuoteAndTime ON trades(base,quote,timestamp)");
	await db.query("CREATE INDEX IF NOT EXISTS tradesByQuoteBaseAndTime ON trades(quote,base,timestamp)");

	await db.query("CREATE TABLE IF NOT EXISTS pool_history (\n\
		aa_address CHAR(32) NOT NULL, \n\
  	response_unit CHAR(44) NOT NULL, \n\
  	trigger_unit CHAR(44) NOT NULL, \n\
  	trigger_address CHAR(32) NOT NULL, \n\
		base_asset CHAR(44) NOT NULL, \n\
		quote_asset CHAR(44) NOT NULL, \n\
		quote_qty INTEGER NOT NULL, \n\
		base_qty INTEGER NOT NULL, \n\
		type VARCHAR(40), \n\
		timestamp TIMESTAMP NOT NULL, \n\
		FOREIGN KEY (aa_address) REFERENCES oswap_aas(address)\n\
	)");
	await db.query("CREATE INDEX IF NOT EXISTS poolHistoryByPoolAddress ON pool_history(aa_address)");

	await db.query("CREATE TABLE IF NOT EXISTS oswap_assets (\n\
		asset CHAR(44) NOT NULL PRIMARY KEY, \n\
		symbol VARCHAR(40) NOT NULL, \n\
		decimals INTEGER NOT NULL, \n\
		description TEXT, \n\
		UNIQUE (symbol)\n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS supplies (\n\
		asset CHAR(44) NOT NULL PRIMARY KEY, \n\
		supply DEFAULT NULL \n\
	)");


	await db.query("CREATE TABLE IF NOT EXISTS oswap_aas (\n\
		address CHAR(32) NOT NULL PRIMARY KEY, \n\
		swap_asset CHAR(44) NOT NULL, \n\
		asset_0 CHAR(44) NOT NULL, \n\
		asset_1 CHAR(44) NOT NULL \n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS oswap_aa_balances ( \n\
    address CHAR(32) NOT NULL, \n\
    asset CHAR(44) NOT NULL, \n\
    balance BIGINT NOT NULL, \n\
    balance_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\
    PRIMARY KEY (address, asset, balance_date))")

	const rows = await db.query("SELECT name FROM pragma_table_info('oswap_aas')");
	const exists = !!rows.find(r => r.name === 'fee');
	if (!exists) {
		await db.query('ALTER TABLE oswap_aas ADD fee INT')
	}
}
