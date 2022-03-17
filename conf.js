"use strict";

exports.bServeAsHub = false;
exports.bLight = true;

exports.bNoPassphrase = true;

exports.apiPort = process.env.testnet ? 4201 : 4200;

exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.explorer_base_url = process.env.testnet ? 'https://testnetexplorer.obyte.org/#' : 'https://explorer.obyte.org/#';

exports.oswap_base_aa = "2JYYNOSRFGLI3TBI4FVSE6GFBUAZTTI3";
exports.token_registry_aa_address = "O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ";

console.log('finished server conf');
