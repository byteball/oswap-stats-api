const conf = require('ocore/conf.js');
const db = require('ocore/db.js');
const express = require('express')
const cors = require('cors');
const mutex = require('ocore/mutex.js');
const addZero = require('./helpers/addZero');
const getBalancesByAddress = require('./helpers/getBalancesByAddress');
const exchangeRates = require('./rates');

const assocTickersByAssets = {};
const assocTickersByMarketNames = {};

const assocTradesByAssets = {};
const assocTradesByMarketNames = {};

var assocAssets = {};
var assocAssetsBySymbols = {};

const unifiedCryptoAssetIdsByAssets = {
	base: {
		id: 1492,
		name: 'Obyte'
	}
}

var bRefreshing = false;

async function initMarkets(){
	await initAssetsCache();
	const rows = await db.query('SELECT DISTINCT base,quote FROM trades');
	for (var i=0; i < rows.length; i++){
		await refreshMarket(rows[i].base, rows[i].quote)
	}
}

async function initAssetsCache(){
	var rows = await db.query("SELECT * FROM oswap_assets LEFT JOIN supplies USING(asset)");
	assocAssets = {};
	rows.forEach(function(row){
		setAsset(row);
	});
}
function setAsset(row){
	if (!row)
		return;
	assocAssets[row.asset] = {
		symbol: row.symbol,
		decimals: row.decimals,
	};

	assocAssetsBySymbols[row.symbol] = {
		asset_id: row.asset,
		decimals: row.decimals,
		description: row.description,
		symbol: row.symbol,
		fee: row.fee,
	};

	if (row.supply)
		assocAssetsBySymbols[row.symbol].supply = row.supply / 10 ** row.decimals;

	if (unifiedCryptoAssetIdsByAssets[row.asset]){
		assocAssetsBySymbols[row.symbol].unified_cryptoasset_id = unifiedCryptoAssetIdsByAssets[row.asset].id;
		assocAssetsBySymbols[row.symbol].name = unifiedCryptoAssetIdsByAssets[row.asset].name;
	}
}

function getMarketNameSeparator(){
	return "-";
}

function getDecimalsPriceCoefficient(base, quote){
	return 10 ** (assocAssets[base].decimals - assocAssets[quote].decimals);
}

async function createTicker(base, quote){
	if (assocAssets[base] && assocAssets[quote]){

		const market_name = assocAssets[base].symbol + getMarketNameSeparator() + assocAssets[quote].symbol
		const ticker = {
			market_name,
			quote_symbol: assocAssets[quote].symbol,
			base_symbol: assocAssets[base].symbol,
			quote_id: quote,
			base_id: base,
		};

		assocTickersByAssets[base + "_" + quote] = ticker;
		assocTickersByMarketNames[market_name] = ticker;

		const trades = [];
		assocTradesByAssets[base + "_" + quote] = trades;
		assocTradesByMarketNames[market_name] = trades;
		return true;
	}
	else {
		delete assocTickersByAssets[base + "_" + quote]; // we remove from api any ticker that has lost a symbol
		return false;
	}
}

async function refreshMarket(base, quote){
	const unlock = await mutex.lockOrSkip(['refresh_' + base + '-' + quote]);
	bRefreshing = true;
	await refreshAsset(base);
	await refreshAsset(quote);
	if (await createTicker(base, quote)){
		await refreshTrades(base, quote);
		await refreshTicker(base, quote);
		await makeNextCandlesForMarket(base, quote);
	} else
		console.log("symbol missing");
	bRefreshing = false;
	if (unlock) unlock();
}

async function refreshAsset(asset){
	var rows = await db.query("SELECT * FROM oswap_assets LEFT JOIN supplies USING(asset) WHERE oswap_assets.asset=?", [asset]);
	setAsset(rows[0]);
}


async function refreshTrades(base, quote){
	const ticker = assocTickersByAssets[base + "_" + quote];
	if (!ticker)
		return console.log(base + "_" + quote + " not found in assocTickersByAssets")

	const address = await getTheMostVoluminousAddress(base, quote);

	const trades = assocTradesByAssets[base + "_" + quote];

	trades.length = 0; // we clear array without deferencing it

	var rows = await db.query("SELECT quote_qty*1.0/base_qty AS price,base_qty AS base_volume,quote_qty AS quote_volume,timestamp,response_unit,indice,type,timestamp FROM trades \n\
	WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=? ORDER BY timestamp DESC", [quote, base, address]);
	rows.forEach(function(row){
		trades.push({
			market_name: ticker.base_symbol + getMarketNameSeparator() + ticker.quote_symbol,
			price: row.price * getDecimalsPriceCoefficient(base, quote),
			base_volume: row.base_volume / 10 ** assocAssets[base].decimals,
			quote_volume: row.quote_volume / 10 ** assocAssets[quote].decimals,
			time: row.timestamp,
			timestamp: (new Date(row.timestamp)).getTime(),
			trade_id: row.response_unit + '_' + row.indice,
			type: row.type,
			explorer: conf.explorer_base_url + row.response_unit
		});
	});

}

async function getTheMostVoluminousAddress(base, quote) {
	const addresses = await db.query("SELECT DISTINCT aa_address FROM trades WHERE base=? AND quote=?", [base, quote]);

	if(addresses.length === 1) {
		return addresses[0].aa_address;
	}

	let balances = [];

	const query = `SELECT address, asset, SUM(amount) AS balance FROM outputs
 JOIN units USING(unit) WHERE is_spent=0
  AND is_stable=1 AND address=?
   AND asset${base === 'base' ? ' IS NULL' : '=?'}
    AND sequence='good' GROUP BY address, asset`;

	for (let i = 0; i < addresses.length; i++) {
		const params = [addresses[i].aa_address];

		if(base !== 'base') {
			params.push(base)
		}

		const rows = await db.query(query, params);

		if(rows.length) {
			balances.push(rows[0]);
		}
	}

	const max = balances.reduce((prev, current) => (prev.balance > current.balance) ? prev : current);
	return max.address;
}

async function refreshTicker(base, quote){
	const ticker = assocTickersByAssets[base + "_" + quote];
	if (!ticker)
		return console.log(base + "_" + quote + " not found in assocTickersByAssets")

	const address = await getTheMostVoluminousAddress(base, quote);

	var rows = await db.query("SELECT MIN(quote_qty*1.0/base_qty) AS low FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=?", [quote, base, address]);
	if (rows[0])
		ticker.lowest_price_24h = rows[0].low * getDecimalsPriceCoefficient(base, quote);
	else
		delete ticker.lowest_price_24h;

	rows = await db.query("SELECT MAX(quote_qty*1.0/base_qty) AS high FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=?", [quote, base, address]);
	if (rows[0])
		ticker.highest_price_24h = rows[0].high * getDecimalsPriceCoefficient(base, quote);
	else
		delete ticker.highest_price_24h * getDecimalsPriceCoefficient(base, quote);

	rows = await db.query("SELECT quote_qty*1.0/base_qty AS last_price FROM trades WHERE quote=? AND base=? ORDER BY timestamp DESC LIMIT 1",[quote, base]);
	if (rows[0])
		ticker.last_price = rows[0].last_price * getDecimalsPriceCoefficient(base, quote);

	rows = await db.query("SELECT SUM(quote_qty) AS quote_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=?", [quote, base, address]);
	if (rows[0])
		ticker.quote_volume = rows[0].quote_volume  / 10 ** assocAssets[quote].decimals;
	else
		ticker.quote_volume = 0;

	rows = await db.query("SELECT SUM(base_qty) AS base_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=?", [quote, base, address]);
		if (rows[0])
			ticker.base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;
		else
			ticker.base_volume = 0;

	rows = await db.query("SELECT SUM(base_qty) AS base_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? AND aa_address=?", [quote, base, address]);
			if (rows[0])
				ticker.base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;
			else
				ticker.base_volume = 0;
}



async function makeNextCandlesForMarket(base, quote){
	await makeNextHourlyCandlesForMarket(base, quote, true);
	await makeNextDailyCandlesForMarket(base, quote, true);
}

async function makeNextDailyCandlesForMarket(base, quote, bReplaceLastCandle){
	var last_start_timestamp,last_end_timestamp,next_end_timestamp;

	const address = await getTheMostVoluminousAddress(base, quote);

	const candles = await db.query("SELECT start_timestamp AS last_start_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+24 hours') AS last_end_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+48 hours') AS next_end_timestamp \n\
	FROM daily_candles WHERE base=? AND quote=? AND aa_address=? ORDER BY start_timestamp DESC LIMIT 1", [base,quote, address]);

	if (candles[0]){
		last_start_timestamp = candles[0].last_start_timestamp;
		last_end_timestamp = candles[0].last_end_timestamp;
		next_end_timestamp = candles[0].next_end_timestamp;
	} else { // if no candle exists yet, we find the first candle time start
		const trades = await db.query("SELECT strftime('%Y-%m-%dT00:00:00.000Z',timestamp) AS last_start_timestamp, strftime('%Y-%m-%dT00:00:00.000Z', DATETIME(timestamp, '+24 hours')) AS last_end_timestamp\n\
		FROM trades WHERE base=? AND quote=? AND aa_address=? ORDER BY timestamp ASC LIMIT 1", [base, quote, address]);
		if (!trades[0])
			return console.log("no trade yet for " + base + " - " + quote);
		last_start_timestamp = trades[0].last_start_timestamp;
		last_end_timestamp = trades[0].last_end_timestamp;
	}

	if (last_end_timestamp > (new Date()).toISOString())
		return; // current candle not closed yet
	if (bReplaceLastCandle)
		await makeCandleForPair('daily_candles', last_start_timestamp, last_end_timestamp, base, quote, address);
	else
		await makeCandleForPair('daily_candles', last_end_timestamp, next_end_timestamp, base, quote, address);

	await makeNextDailyCandlesForMarket(base, quote);
}


async function makeNextHourlyCandlesForMarket(base, quote, bReplaceLastCandle){
	var last_start_timestamp,last_end_timestamp,next_end_timestamp;

	const address = await getTheMostVoluminousAddress(base, quote);

	const candles = await db.query("SELECT start_timestamp AS last_start_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+1 hour') AS last_end_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+2 hours') AS next_end_timestamp \n\
	FROM hourly_candles WHERE base=? AND quote=? AND aa_address=? ORDER BY start_timestamp DESC LIMIT 1", [base, quote, address]);

	if (candles[0]){
		last_start_timestamp = candles[0].last_start_timestamp;
		last_end_timestamp = candles[0].last_end_timestamp;
		next_end_timestamp = candles[0].next_end_timestamp;
	} else { // if no candle exists yet, we find the first candle time start
		const trades = await db.query("SELECT strftime('%Y-%m-%dT%H:00:00.000Z',timestamp) AS last_start_timestamp, strftime('%Y-%m-%dT%H:00:00.000Z', DATETIME(timestamp, '+1 hour')) AS last_end_timestamp\n\
		FROM trades WHERE base=? AND quote=? AND aa_address=? ORDER BY timestamp ASC LIMIT 1", [base, quote, address]);
		if (!trades[0])
			return console.log("no trade yet for " + base + " - " + quote);
		last_start_timestamp = trades[0].last_start_timestamp;
		last_end_timestamp = trades[0].last_end_timestamp;
	}
	if (last_end_timestamp > (new Date()).toISOString())
		return; // current candle not closed yet
	if (bReplaceLastCandle)
		await makeCandleForPair('hourly_candles', last_start_timestamp, last_end_timestamp, base, quote, address);
	else
		await makeCandleForPair('hourly_candles', last_end_timestamp, next_end_timestamp, base, quote, address);

	await makeNextHourlyCandlesForMarket(base, quote);

}

async function makeCandleForPair(table_name, start_timestamp, end_timestamp, base, quote, aa_address){
	var low, high, open_price, close_price;
	var quote_volume, base_volume = 0;

	var rows = await db.query("SELECT MIN(quote_qty*1.0/base_qty) AS low,MAX(quote_qty*1.0/base_qty) AS high,SUM(quote_qty) AS quote_volume,SUM(base_qty) AS base_volume \n\
	 FROM trades WHERE timestamp >=? AND timestamp <?  AND quote=? AND base=? AND aa_address=?",[start_timestamp, end_timestamp, quote, base, aa_address]);

	if (rows[0] && rows[0].low){
		low = rows[0].low * getDecimalsPriceCoefficient(base, quote);
		high = rows[0].high * getDecimalsPriceCoefficient(base, quote);
		quote_volume = rows[0].quote_volume  / 10 ** assocAssets[quote].decimals;
		base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;

		rows = await db.query("SELECT quote_qty*1.0/base_qty AS open_price FROM trades WHERE timestamp >=? AND quote=? AND base=? AND aa_address=? \n\
		ORDER BY timestamp ASC LIMIT 1" ,[start_timestamp, quote, base, aa_address]);

		open_price = rows[0].open_price * getDecimalsPriceCoefficient(base, quote);
		rows = await db.query("SELECT quote_qty*1.0/base_qty AS close_price FROM trades WHERE timestamp <? AND quote=? AND base=? AND aa_address=? \n\
		ORDER BY timestamp DESC LIMIT 1", [end_timestamp, quote, base, aa_address]);
		close_price = rows[0].close_price * getDecimalsPriceCoefficient(base, quote);

	} else {
		rows = await db.query("SELECT close_price FROM " + table_name + " WHERE start_timestamp <? AND quote=? AND base=? AND aa_address=? ORDER BY start_timestamp DESC LIMIT 1",
		[start_timestamp, quote, base, aa_address]);
		low = rows[0].close_price;
		high = rows[0].close_price;
		open_price = rows[0].close_price;
		close_price = rows[0].close_price;
		quote_volume = 0;
		base_volume = 0;
	}

	await db.query("REPLACE INTO " + table_name + " (base,quote,aa_address,quote_qty,base_qty,highest_price,lowest_price,open_price,close_price,start_timestamp)\n\
	VALUES (?,?,?,?,?,?,?,?,?,?)",[ base, quote, aa_address, quote_volume, base_volume, high, low, open_price, close_price,start_timestamp]);
}

async function calcBalancesOfAddressWithSlicesByDate(address, start_time, end_time) {
	start_time.setUTCHours(0, 0, 0);
	const start = start_time.getUTCFullYear() + '-' + addZero(start_time.getUTCMonth() +1) + '-' + addZero(start_time.getUTCDate())+' 00:00:00';
	const end = end_time.getUTCFullYear() + '-' + addZero(end_time.getUTCMonth() +1) + '-' + addZero(end_time.getUTCDate())+' 23:59:59';
	const rows = await db.query("SELECT * FROM oswap_aas_balances WHERE address = ? \n\
		AND creation_date >= ? AND creation_date <= ?", [address, start, end]);
	const assocDateToBalances = {};
	rows.forEach(row => {
		if(!assocDateToBalances[row.creation_date]) {
			assocDateToBalances[row.creation_date] = {
				creation_date: row.creation_date
			}
		}
		if(row.asset === null) row.asset = 'GBYTE';
		assocDateToBalances[row.creation_date][row.asset] = row.balance;
	})

	const todayRows = await db.query(
		"SELECT address, asset, SUM(amount) AS balance \n\
		FROM outputs JOIN units USING(unit) \n\
		WHERE is_spent=0 AND is_stable=1 AND address=? AND sequence='good' \n\
		GROUP BY address, asset", [address]);
	const date = new Date();
	const key = date.getUTCFullYear() + '-' + addZero(date.getUTCMonth() + 1) + '-' + addZero(date.getUTCDate()) + ' 23:59:59'
	assocDateToBalances[key] = {creation_date: key};
	todayRows.forEach(row => {
		if(row.asset === null) row.asset = 'GBYTE';
		assocDateToBalances[key][row.asset] = row.balance;
	})

	return Object.values(assocDateToBalances).sort((a, b) => {
		return new Date(a.creation_date).getTime() - new Date(b.creation_date).getTime()
	});
}

async function getCandles(period, start_time, end_time, quote_id, base_id) {
	const address = await getTheMostVoluminousAddress(base_id, quote_id);

	return db.query("SELECT quote_qty AS quote_volume,base_qty AS base_volume,highest_price,lowest_price,open_price,close_price,start_timestamp\n\
		FROM " + period + "_candles WHERE start_timestamp>=? AND start_timestamp<? AND quote=? AND base=? AND aa_address=?",
		[start_time.toISOString(), end_time.toISOString(), quote_id, base_id, address])
}

function assetValue(value, asset) {
	const decimals = asset ? asset.decimals : 0;
	return value / 10 ** decimals;
}

function getMarketcap(balances, asset0, asset1) {
	let assetValue0 = 0;
	let assetValue1 = 0;
	let base = 0;
	if (asset0 === 'base' || asset1 === 'base') base = balances.base;

	if (base) {
		assetValue0 = assetValue1 =
			(exchangeRates.GBYTE_USD / 1e9) * base;
	} else {
		const assetId0 = asset0 === "base" ? "GBYTE" : asset0;
		const assetId1 = asset1 === "base" ? "GBYTE" : asset1;
		const assetInfo0 = assocAssets[asset0];
		const assetInfo1 = assocAssets[asset1];
		assetValue0 = exchangeRates[`${assetId0}_USD`]
			? exchangeRates[`${assetId0}_USD`] *
			assetValue(balances[assetId0], assetInfo0)
			: 0;
		assetValue1 = exchangeRates[`${assetId1}_USD`]
			? exchangeRates[`${assetId1}_USD`] *
			assetValue(balances[assetId1], assetInfo1)
			: 0;
	}
	return assetValue0 && assetValue1 ? assetValue0 + assetValue1 : 0;
}

async function getAPY7d(startTime, endTime, quote_id, base_id, balances, fee) {
	const candles = await getCandles('daily', startTime, endTime, quote_id, base_id);
	const marketCap = getMarketcap(balances, quote_id, base_id);

	let asset = quote_id === 'base' ? 'GBYTE' : quote_id;
	let type = "quote";
	let rate = exchangeRates[`${asset}_USD`];
	if (!rate) {
		asset = base_id === 'base' ? 'GBYTE' : base_id;
		type = "base";
		rate = exchangeRates[`${asset}_USD`];
	}
	const APY7D = candles.map((c) => {
		const volume = type === "quote" ? c.quote_volume : c.base_volume;
		const inUSD = volume * rate;

		return ((inUSD * fee) / marketCap) * 365;
	});


	const avgAPY = APY7D.reduce((prev, curr) => {
		return prev + curr;
	}, 0) / 7;

	return Number((avgAPY * 100).toFixed(2)) || 0;
}

async function getHistory(address) {
	const result = await db.query("SELECT * FROM aa_responses WHERE aa_address=? \n\
		AND (json_extract(response, '$.responseVars.type') = 'swap' OR \n\
		json_extract(response, '$.responseVars.type') = 'mint' OR \n\
		json_extract(response, '$.responseVars.type') = 'burn') \n\
		ORDER BY creation_date DESC LIMIT 20", [address]);

	return await Promise.all(result.map(async aaResponse => {
		const output = await db.query("SELECT * FROM outputs WHERE unit=?", [aaResponse.trigger_unit]);
		console.error('11111111111111111', output);
		const item = {
			author: output.address,
			sent_asset: output.asset,
			sent_amount: output.amount,
			date: aaResponse.creation_date,
		}

		const response = JSON.parse(aaResponse.response);
		const type = response.type;

		if (type === 'burn') {
			item.asset0_amount = response.asset0_amount;
			item.asset1_amount = response.asset1_amount;
		}

		if (type === 'mint') {
			item.asset_amount = response.asset_amount;
		}

		if (type === 'swap') {
			item.direction = response.asset0_amount ? '1-0' : '0-1';
			item.asset_amount = response.asset0_amount ? response.asset0_amount : response.asset1_amount;
		}

		return item;
	}));
}

async function start(){
	const app = express();
	const server = require('http').Server(app);
	app.use(cors());

	await initMarkets();
	setInterval(initMarkets, 3600 * 1000); // compute last hourly candle even when no trade happened

	app.get('/', async function(request, response){
		return response.send(getLandingPage());
	});

	app.get('/api/v1/assets', async function(request, response){
		await waitUntilRefreshFinished();
		return response.send(assocAssetsBySymbols);
	});

	app.get('/api/v1/summary', async function(request, response){
		await waitUntilRefreshFinished();
		const arrSummary = [];
		for(var key in assocTickersByMarketNames)
			arrSummary.push(assocTickersByMarketNames[key]);
		return response.send(arrSummary);
	});

	app.get('/api/v1/tickers', async function(request, response){
		await waitUntilRefreshFinished();
		return response.send(assocTickersByMarketNames);
	});

	app.get('/api/v1/ticker/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		if (assocTickersByMarketNames[marketName]){
			await waitUntilRefreshFinished();
			return response.send(assocTickersByMarketNames[marketName]);
		}
		else
			return response.status(400).send('Unknown market');
	});

	app.get('/api/v1/trades/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		if (assocTradesByMarketNames[marketName]){
			await waitUntilRefreshFinished();
			return response.send(assocTradesByMarketNames[marketName]);
		}
		else
			return response.status(400).send('Unknown market');
	});

	app.get('/api/v1/candles/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		const period = request.query.period;
		const start_time = parseDateTime(request.query.start);
		const end_time = parseDateTime(request.query.end, true);

		if (!start_time)
			return response.status(400).send('start_time not valid');
		if (!end_time)
			return response.status(400).send('end_time not valid');

		if (period !== 'hourly' && period !== 'daily')
			return response.status(400).send('period must be "daily" or "hourly"');
		if (assocTickersByMarketNames[marketName]){
			await waitUntilRefreshFinished();

		const rows = await getCandles(period, start_time, end_time, assocTickersByMarketNames[marketName].quote_id, assocTickersByMarketNames[marketName].base_id);
		return response.send(rows);
		}
		else
			return response.status(400).send('Unknown market');
	});

	app.get('/api/v1/balances/:address', async function (request, response) {
		const address = request.params.address;
		const start_time = parseDateTime(request.query.start);
		const end_time = parseDateTime(request.query.end);

		if (!start_time)
			return response.status(400).send('start_time not valid');
		if (!end_time)
			return response.status(400).send('end_time not valid');

		response.send(await calcBalancesOfAddressWithSlicesByDate(address, start_time, end_time));
	});

	app.get('/api/v1/apy7d', async function (request, response) {
		const startTime = new Date();
		startTime.setUTCDate(startTime.getUTCDate() - 7);
		const endTime = new Date();
		endTime.setDate(endTime.getUTCDate() + 1);

		const assocAPYByMarketName = {};

		for (let key in assocTickersByMarketNames) {
			const q = assocTickersByMarketNames[key];

			const address = await getTheMostVoluminousAddress(q.base_id, q.quote_id);

			const rows = await db.query("SELECT fee FROM oswap_aas WHERE address=?",
				[address]);

			if (!rows.length) {
				assocAPYByMarketName[key] = 0
			} else {
				const fee = rows[0].fee / 10 ** 11;
				const balances = await getBalancesByAddress(address);
				assocAPYByMarketName[key] = await getAPY7d(startTime,
					endTime,
					q.quote_id,
					q.base_id,
					balances,
					fee);
			}
		}
		response.send(assocAPYByMarketName);
	});

	app.get('/api/v1/exchangeRates', async function (request, response) {
		response.send(exchangeRates);
	});

	app.get('/api/v1/history/:address', async function (request, response) {
		const address = request.params.address;

		const history = await getHistory(address);

		response.send(history);
	});

	server.listen(conf.apiPort, () => {
		console.log(`== server started listening on ${conf.webServerPort} port`);
	});
}

function parseDateTime(string, bEndDate){

	if (typeof string !== 'string')
		return null;
	var date = null;
	if (string.match(/^\d\d\d\d-\d\d-\d\d$/)){
		date = new Date(Date.parse(string));
		if (bEndDate)
			date.setDate(date.getUTCDate() + 1); // make end day inclusive
		return date;
	}
	else if (string.match(/^\d\d\d\d-\d\d-\d\d( |T)\d\d:\d\d:\d\dZ$/))
		date = new Date(Date.parse(string));
	else if (string.match(/^\d\d\d\d-\d\d-\d\d( |T)\d\d:\d\d:\d\d.\d\d\dZ$/))
		date = new Date(Date.parse(string));
	else if (string.match(/^\d+$/))
		date = new Date(parseInt(string) / 1000);
	else
		return null;
	if (bEndDate)
		date.setUTCHours(date.getUTCHours() + 1); // make end hour inclusive
	return date;
}


function waitUntilRefreshFinished(){
	return new Promise(function(resolve){
		if (!bRefreshing)
			return resolve()
		else
			return setTimeout(function(){
				waitUntilRefreshFinished().then(resolve);
			}, 50);
	})
}

function getLandingPage(){
	var html = '<html><ul>';
	html +='<li><a href="/api/v1/assets">assets</a></li>';
	html +='<li><a href="/api/v1/summary">summary</a></li>';
	html +='<li><a href="/api/v1/tickers">tickers</a></li>';
	for (var key in assocTickersByMarketNames)
		html +='<li><a href="/api/v1/ticker/'+ key + '">ticker ' + key + ' </a></li>';
	for (var key in assocTickersByMarketNames)
		html +='<li><a href="/api/v1/trades/'+ key + '">trades ' + key + ' </a></li>';
	html += '</ul></html>';
	return html;
}


exports.start = start;
exports.refreshMarket = refreshMarket;
exports.initMarkets = initMarkets;
