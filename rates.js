/*jslint node: true */
'use strict';
const network = require('ocore/network.js');

let rates = {};
let updating = false;

function updateRates() {
	if (updating)
		return console.log('already updating rates, will skip');
	updating = true;
	rates = {}; // reset
	network.requestFromLightVendor('hub/get_exchange_rates', null, (ws, err, result) => {
		rates = result;
		updating = false;
	})
}

updateRates();
//setInterval(updateRates, 1000 * 60 * 5);

module.exports = () => {
	if (Object.keys(network.exchangeRates).length > 0)
		return network.exchangeRates;
	console.log(`network rates are still empty`);
	if (Object.keys(rates).length > 0)
		return rates;
	throw Error(`no rates yet`);
};
