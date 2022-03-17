const conf = require('ocore/conf.js');
const network = require('ocore/network.js');
const eventBus = require('ocore/event_bus.js');
const lightWallet = require('ocore/light_wallet.js');
const storage = require('ocore/storage.js');
const walletGeneral = require('ocore/wallet_general.js');
const objectHash = require('ocore/object_hash.js');
const sqlite_tables = require('./sqlite_tables.js');
const db = require('ocore/db.js');
const api = require('./api.js');
const dag = require('aabot/dag.js');
const initHistoryAABalances = require('./initHistoryAABalances');
const { dumpByAddress } = require('./dumpFunctions');
const formatDate = require('./helpers/formatDate');

lightWallet.setLightVendorHost(conf.hub);

eventBus.once('connected', function(ws){
	network.initWitnessesIfNecessary(ws, start);
});

const bounce_fees = 10000;
let apiIsStarted = false;

async function treatResponseFromOswapAA(objResponse, objInfos){

	const oswapAaAddress = objInfos.address;
	const shares_asset = objInfos.shares_asset;

	const x_asset = objInfos.x_asset;
	const y_asset = objInfos.y_asset;

	const { trigger_unit, trigger_address, response_unit, objResponseUnit, response: { responseVars } } = objResponse;

	if (!responseVars)
		return console.log(`no resp vars in response from ${trigger_unit}`);
	const { event: strEvent, interest: strInterest } = responseVars;
	if (!strEvent)
		return console.log(`no event in response from ${trigger_unit}`);
	const event = JSON.parse(strEvent);
	let base_interest = 0, quote_interest = 0;
	if (strInterest) {
		const interest = JSON.parse(strInterest); // can be "true" if early-returned from $charge_interest()
		base_interest = interest.x || 0;
		quote_interest = interest.y || 0;
	}

	const objTriggerUnit = await storage.readUnit(trigger_unit);
	if (!objTriggerUnit)
		throw Error('trigger unit not found ' + trigger_unit);

	const timestamp = new Date(objResponse.timestamp * 1000).toISOString();


	if (event.type === 'add'){

		if (!response_unit)
			throw Error('no response unit from trigger ' + trigger_unit);
	
		let x_amount = getAmountToAa(objTriggerUnit, oswapAaAddress, x_asset);
		let y_amount = getAmountToAa(objTriggerUnit, oswapAaAddress, y_asset); 

		if (x_amount > 0 && y_asset === 'base' && y_amount === bounce_fees)
			y_amount -= bounce_fees;
		if (y_amount > 0 && x_asset === 'base' && x_amount === bounce_fees)
			x_amount -= bounce_fees;

		let x_amount_out = getAmountFromAa(objResponseUnit, oswapAaAddress, x_asset);
		let y_amount_out = getAmountFromAa(objResponseUnit, oswapAaAddress, y_asset);
		let shares_amount = getAmountFromAa(objResponseUnit, oswapAaAddress, shares_asset);

		// subtract the change
		if (x_amount_out)
			x_amount -= x_amount_out
		if (y_amount_out)
			y_amount -= y_amount_out

		const oswapAaVars = await dag.readAAStateVars(oswapAaAddress);
		const supply = oswapAaVars.lp_shares.issued;

		const px = await dag.executeGetter(oswapAaAddress, 'get_price', ['x']);
		const total_value_in_y = y_amount + px * x_amount;
		const share_price_in_y = total_value_in_y / shares_amount;
		const share_price_in_x = share_price_in_y / px;
		const shares_for_x = x_amount / share_price_in_x;
		const shares_for_y = y_amount / share_price_in_y;

		if (x_amount > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?,?)", 
			[oswapAaAddress, response_unit, shares_asset, x_asset, shares_for_x, x_amount, 'buy', timestamp]);
			api.refreshMarket(oswapAaAddress, shares_asset, x_asset);
		}

		if (y_amount > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp, indice) VALUES (?,?,?,?,?,?,?,?,1)", 
			[oswapAaAddress, response_unit, shares_asset, y_asset, shares_for_y, y_amount, 'buy', timestamp]);
			api.refreshMarket(oswapAaAddress, shares_asset, y_asset);
		}

		await db.query("INSERT INTO pool_history (aa_address, response_unit, trigger_unit, trigger_address, base_asset, quote_asset, base_qty, quote_qty, type, timestamp, base_interest, quote_interest) VALUES (?,?,?,?, ?,?,?,?, ?,?, ?,?)",
			[oswapAaAddress, response_unit, trigger_unit, trigger_address,
				x_asset, y_asset, x_amount, y_amount,
				'add', timestamp,
				base_interest, quote_interest
			]
		);

		await saveSupplyForAsset(shares_asset, supply);
	}

	if (event.type === 'remove'){

		if (!response_unit)
			throw Error('no response unit from trigger ' + trigger_unit);
	
		const shares_amount = getAmountToAa(objTriggerUnit, oswapAaAddress, shares_asset); 	
		let x_amount = getAmountFromAa(objResponseUnit, oswapAaAddress, x_asset);
		let y_amount = getAmountFromAa(objResponseUnit, oswapAaAddress, y_asset);

		const oswapAaVars = await dag.readAAStateVars(oswapAaAddress);
		const supply = oswapAaVars.lp_shares.issued;

		const px = await dag.executeGetter(oswapAaAddress, 'get_price', ['x']);
		const total_value_in_y = y_amount + px * x_amount;
		const share_price_in_y = total_value_in_y / shares_amount;
		const share_price_in_x = share_price_in_y / px;
		const shares_for_x = x_amount / share_price_in_x;
		const shares_for_y = y_amount / share_price_in_y;

		if (x_amount > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?,?)", 
			[oswapAaAddress, response_unit, shares_asset, x_asset, shares_for_x, x_amount, 'sell', timestamp]);
			api.refreshMarket(oswapAaAddress, shares_asset, x_asset);
		}

		if (y_amount > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp, indice) VALUES (?,?,?,?,?,?,?,?,1)", 
			[oswapAaAddress, response_unit, shares_asset, y_asset, shares_for_y, y_amount, 'sell', timestamp]);
			api.refreshMarket(oswapAaAddress, shares_asset, y_asset);
		}

		await db.query("INSERT INTO pool_history (aa_address, response_unit, trigger_unit, trigger_address, base_asset, quote_asset, base_qty, quote_qty, type, timestamp, base_interest, quote_interest, base_exit_fee, base_quote_fee) VALUES (?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?)",
			[oswapAaAddress, response_unit, trigger_unit, trigger_address,
				x_asset, y_asset, x_amount, y_amount,
				'remove', timestamp,
				base_interest, quote_interest,
				event.x_fee || 0, event.y_fee || 0
			]
		);

		await saveSupplyForAsset(shares_asset, supply);
	}

	if (event.type === 'swap'){

		if (!response_unit)
			throw Error('no response unit from trigger ' + trigger_unit);
	
		let x_amount_in = getAmountToAa(objTriggerUnit, oswapAaAddress, x_asset); 
		let y_amount_in = getAmountToAa(objTriggerUnit, oswapAaAddress, y_asset); 

		let x_amount_out = getAmountFromAa(objResponseUnit, oswapAaAddress, x_asset);
		let y_amount_out = getAmountFromAa(objResponseUnit, oswapAaAddress, y_asset);

		// subtract the change
		if (x_amount_out > 0 && y_amount_out > 0) {
			if (x_amount_out < x_amount_in) {
				x_amount_in -= x_amount_out;
				x_amount_out = 0;
			}
			if (y_amount_out < y_amount_in) {
				y_amount_in -= y_amount_out;
				y_amount_out = 0;
			}
		}

		if (x_amount_out > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?,?)", 
			[oswapAaAddress, response_unit, x_asset, y_asset, x_amount_out, y_amount_in, 'buy', timestamp]);

			await db.query("INSERT INTO pool_history (aa_address, response_unit, trigger_unit, trigger_address, base_asset, quote_asset, base_qty, quote_qty, type, timestamp, base_interest, quote_interest, base_swap_fee, base_arb_profit_tax, base_total_fee) VALUES (?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?,?)",
				[oswapAaAddress, response_unit, trigger_unit, trigger_address,
					x_asset, y_asset, x_amount_out, y_amount_in,
					'buy', timestamp,
					base_interest, quote_interest,
					event.swap_fee, event.arb_profit_tax, event.total_fee
				]
			);
		}

		if (y_amount_out > 0){
			await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?,?)", 
			[oswapAaAddress, response_unit, x_asset, y_asset, x_amount_in, y_amount_out, 'sell', timestamp]);

			await db.query("INSERT INTO pool_history (aa_address, response_unit, trigger_unit, trigger_address, base_asset, quote_asset, base_qty, quote_qty, type, timestamp, base_interest, quote_interest, quote_swap_fee, quote_arb_profit_tax, quote_total_fee) VALUES (?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?,?)",
				[oswapAaAddress, response_unit, trigger_unit, trigger_address,
					x_asset, y_asset, x_amount_in, y_amount_out,
					'sell', timestamp,
					base_interest, quote_interest,
					event.swap_fee, event.arb_profit_tax, event.total_fee
				]
			);
		}

		api.refreshMarket(oswapAaAddress, x_asset, y_asset);
	}

	if (event.type === 'leverage'){

		const { shares, amount, token, L } = event;
		const x_symbol = api.getSymbol(x_asset);
		const y_symbol = api.getSymbol(y_asset);
		const side = token === 'x' ? 'base' : 'quote';
		const base = token === 'x' ? `${x_symbol}/${y_symbol}_${L}x` : `${y_symbol}/${x_symbol}_${L}x`;
		const quote = token === 'x' ? x_asset : y_asset;
		const base_qty = Math.abs(shares);
		const quote_qty = Math.abs(amount);

		await db.query("INSERT INTO trades (aa_address, response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?,?)", 
		[oswapAaAddress, response_unit, base, quote, base_qty, quote_qty, amount > 0 ? 'buy' : 'sell', timestamp]);

		await db.query(`INSERT INTO pool_history (aa_address, response_unit, trigger_unit, trigger_address, base_asset, quote_asset, base_qty, quote_qty, type, timestamp, base_interest, quote_interest, ${side}_swap_fee, ${side}_arb_profit_tax, ${side}_l_tax, ${side}_total_fee) VALUES (?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?,?,?)`,
			[oswapAaAddress, response_unit, trigger_unit, trigger_address,
				base, quote, base_qty, quote_qty,
				amount > 0 ? 'buy_leverage' : 'sell_leverage', timestamp,
				base_interest, quote_interest,
				event.swap_fee, event.arb_profit_tax, event.l_tax, event.total_fee
			]
		);

		api.refreshMarket(oswapAaAddress, base, quote); // fix
	}

	if(apiIsStarted) {
		const d = new Date();
		await dumpByAddress(formatDate(d), oswapAaAddress);
	}
}


eventBus.on('aa_response', async function(objResponse){
	if(objResponse.response.error)
		return console.log('ignored response with error: ' + objResponse.response.error);
	const aa_address = objResponse.aa_address;

	var rows = await db.query("SELECT * FROM oswap_aas WHERE address=?",[aa_address]);
	if (rows[0])
		return treatResponseFromOswapAA(objResponse, rows[0]);

});


function getAmountToAa(objTriggerUnit, aa_address, asset = 'base'){

	if (!objTriggerUnit)
		return 0;
	let amount = 0;
	objTriggerUnit.messages.forEach(function (message){
		if (message.app !== 'payment')
			return;
		const payload = message.payload;
		if (asset == 'base' && payload.asset || asset != 'base' && asset !== payload.asset)
			return;
		payload.outputs.forEach(function (output){
			if (output.address === aa_address) {
				amount += output.amount; // in case there are several outputs
			}
		});
	});
	return amount;
}

function getAmountFromAa(objResponseUnit, aa_address, asset = 'base'){

	if (!objResponseUnit)
		return 0;
	let amount = 0;
	objResponseUnit.messages.forEach(function (message){
		if (message.app !== 'payment')
			return;
		const payload = message.payload;
		const a = payload.asset || 'base';
		if (asset !== a)
			return;
		payload.outputs.forEach(function (output){
			if (output.address !== aa_address) {
				amount += output.amount; // in case there are several outputs
			}
		});
	});
	return amount;
}


function addWatchedAas(){
	network.addLightWatchedAa(conf.oswap_base_aa, null, console.log);
	network.addLightWatchedAa(conf.token_registry_aa_address, null, console.log);
}


async function start(){
	await sqlite_tables.create();
	await discoverOswapAas()
	await api.initAssetsCache();
	addWatchedAas();
	eventBus.on('connected', addWatchedAas);
	lightWallet.refreshLightClientHistory();
	eventBus.once('refresh_light_done', async () => {
		apiIsStarted = true;
		await initHistoryAABalances();
		await api.start()
	});
	initBalanceDumpService()
}

function initBalanceDumpService() {
	const nowDate = new Date();
	const nextDate = new Date();
	nextDate.setUTCHours(0, 1, 0);
	nextDate.setUTCDate(nextDate.getUTCDate() + 1);
	const time = nextDate.getTime() - nowDate.getTime();
	setTimeout(startDump, time)
}

async function startDump() {
	await initHistoryAABalances();
	initBalanceDumpService();
}

function discoverOswapAas(){
	return new Promise((resolve)=>{
		network.requestFromLightVendor('light/get_aas_by_base_aas', {
			base_aa: conf.oswap_base_aa
		}, async function(ws, request, arrResponse){
			console.log(arrResponse);
			const allAaAddresses = arrResponse.map(obj => obj.address);
			const rows = await db.query("SELECT address FROM oswap_aas WHERE address IN("+ allAaAddresses.map(db.escape).join(',')+")");
			const knownAaAddresses = rows.map(obj => obj.address);
			const newOswapAas = arrResponse.filter(address => !knownAaAddresses.includes(address))
			await Promise.all(newOswapAas.map(saveAndwatchOswapAa));
			resolve();
		});
	})
}

async function saveAndwatchOswapAa(objAa){
	return new Promise(async function(resolve){
		await saveOswapAa(objAa);
		walletGeneral.addWatchedAddress(objAa.address, resolve);
	});
}

async function saveSupplyForAsset(asset, supply){
	await db.query("REPLACE INTO supplies (supply,asset) VALUES (?,?)", [supply, asset]);
}

let knownAssets = {};

async function saveSymbolForAsset(asset){
	if (knownAssets[asset])
		return;
	var symbol,decimals, description;
	if (asset !== 'base'){
		var registryVars = await getStateVarsForPrefixes(conf.token_registry_aa_address, [
			'a2s_' + asset, 
			'current_desc_' + asset
		]);
		const current_desc = registryVars['current_desc_' + asset];
		registryVars = Object.assign(registryVars, await getStateVarsForPrefixes(conf.token_registry_aa_address, ['decimals_' + current_desc, 'desc_' + current_desc]));
		symbol = registryVars['a2s_' + asset];
		decimals = registryVars['decimals_' + current_desc];
		description = registryVars['desc_' + current_desc];
		if (!symbol || typeof decimals !== 'number'){
			console.log('asset ' + asset + ' not found in registry');
			await db.query("DELETE FROM oswap_assets WHERE asset=?", [asset]);
			return;
		}
	} else {
		symbol = 'GBYTE';
		decimals = 9;
		description = 'Obyte DAG native currency';
	};

	await db.query("REPLACE INTO oswap_assets (asset, symbol, decimals, description) VALUES (?,?,?,?)", [asset, symbol, decimals, description]);
	knownAssets[asset] = true;
}

async function refreshSymbols(){
	const rows = await db.query("SELECT shares_asset AS asset FROM oswap_aas UNION SELECT DISTINCT x_asset AS asset FROM oswap_aas \n\
	UNION SELECT y_asset AS asset FROM oswap_aas");
	for (var i=0; i < rows.length; i++)
		await saveSymbolForAsset(rows[i].asset);
	api.initMarkets();
}



async function saveOswapAa(objAa){
	return new Promise(async (resolve)=>{

		const oswapAaAddress = objAa.address;
		const x_asset = objAa.definition[1].params.x_asset;
		const y_asset = objAa.definition[1].params.y_asset;

		const stateVars = await dag.readAAStateVars(oswapAaAddress);
		const { lp_shares } = stateVars;
		const shares_asset = lp_shares.asset;

		if (!shares_asset)
			return setTimeout(function(){ saveOswapAa(objAa).then(resolve) }, 1000);
		await db.query("INSERT OR REPLACE INTO oswap_aas (address, x_asset, y_asset, shares_asset) VALUES (?,?,?,?)", [oswapAaAddress, x_asset, y_asset, shares_asset]);
		await Promise.all([saveSymbolForAsset(shares_asset), saveSymbolForAsset(x_asset), saveSymbolForAsset(y_asset)]);
		resolve();
	})
}

function handleJustsaying(ws, subject, body) {
	switch (subject) {
		case 'light/aa_definition':
			onAADefinition(body);
		break;

		case 'light/aa_response':
			if (body.aa_address == conf.token_registry_aa_address)
				refreshSymbols();
		break;

		case 'light/have_updates':
			lightWallet.refreshLightClientHistory(); // needed
		break;
	}
}

eventBus.on("message_for_light", handleJustsaying);

function onAADefinition(objUnit){

	for (var i=0; i<objUnit.messages.length; i++){
		var message = objUnit.messages[i];
		var payload = message.payload;
		if (message.app === 'definition' && payload.definition[1].base_aa){
				const base_aa = payload.definition[1].base_aa;
				if (base_aa == conf.oswap_base_aa){
					const address = objectHash.getChash160(payload.definition);
					const definition = payload.definition;
					saveAndwatchOswapAa({ address, definition });
				}
		}
	}
}


function getStateVarsForPrefixes(aa_address, arrPrefixes){
	return new Promise(function(resolve){
		Promise.all(arrPrefixes.map((prefix)=>{
			return getStateVarsForPrefix(aa_address, prefix)
		})).then((arrResults)=>{
			return resolve(Object.assign({}, ...arrResults));
		}).catch((error)=>{
			return resolve({});
		});
	});
}

function getStateVarsForPrefix(aa_address, prefix, start = '0', end = 'z', firstCall = true){
	return new Promise(function(resolve, reject){
		if (firstCall)
			prefix = prefix.slice(0, -1);
		const CHUNK_SIZE = 2000; // server wouldn't accept higher chunk size

		if (start === end)
			return getStateVarsForPrefix(aa_address, prefix + start,  '0', 'z').then(resolve).catch(reject); // we append prefix to split further

		network.requestFromLightVendor('light/get_aa_state_vars', {
			address: aa_address,
			var_prefix_from: prefix + start,
			var_prefix_to: prefix + end,
			limit: CHUNK_SIZE
		}, function(ws, request, objResponse){
			if (objResponse.error)
				return reject(objResponse.error);

			if (Object.keys(objResponse).length >= CHUNK_SIZE){ // we reached the limit, let's split in two ranges and try again
				const delimiter =  Math.floor((end.charCodeAt(0) - start.charCodeAt(0)) / 2 + start.charCodeAt(0));
				Promise.all([
					getStateVarsForPrefix(aa_address, prefix, start, String.fromCharCode(delimiter), false),
					getStateVarsForPrefix(aa_address, prefix, String.fromCharCode(delimiter +1), end, false)
				]).then(function(results){
					return resolve({...results[0], ...results[1]});
				}).catch(function(error){
					return reject(error);
				})
			} else{
				return resolve(objResponse);
			}

		});
	});
}




process.on('unhandledRejection', up => { throw up });
