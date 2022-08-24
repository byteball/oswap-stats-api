## Oswap-stats-api

This O<sub>byte</sub> light node explores the DAG and provides API endpoints giving information about trades happening on [Oswap v2](https://v2.oswap.io). The API is used by https://v2-stats.oswap.io.


#### Installation

Install node.js 8+, clone the repository, then

`npm install`

By default the API is accessible at `http://localhost:4200` (`http://localhost:4201` for testnet). You may want to setup a reverse proxy like Nginx to make it accessible on a public url.

#### Run

`node start.js oswap2-stats 2>errlog`


#### Endpoints

See some popular examples at https://v2-data.oswap.io.

- */api/v1/assets*

Example https://v2-data.oswap.io/api/v1/assets

Return all assets having trades listed. Only assets having a symbol registered on [Obyte decentralized registry](https://tokens.ooo) will appear.

```json
{
  "GBYTE": {
    "asset_id": "base",
    "decimals": 9,
    "description": "Obyte DAG native currency",
    "symbol": "GBYTE",
    "unified_cryptoasset_id": 1492,
    "name": "Obyte"
  },
  "LAMBO": {
    "asset_id": "J98n2rfwcEqxSXPmoyrAezPc1Q4X6CzeZdygAe2IZaA=",
    "decimals": 9,
    "description": "This is just a test token.",
    "symbol": "LAMBO"
  }
}
```

---------------------------------------

- */api/v1/summary*

Example https://v2-data.oswap.io/api/v1/summary

Return an array of all traded pairs with their characteristics and statistics for last 24 hours

```json
[{
  "market_name": "LAMBO-GBYTE",
  "address":"ELRBOANJWTDZC5JUPPZRJ7BP72ZGVLMT",
  "full_market_name":"ELRBOANJWTDZC5JUPPZRJ7BP72ZGVLMT-LAMBO-GBYTE",
  "quote_symbol": "GBYTE",
  "base_symbol": "LAMBO",
  "quote_id": "base",
  "base_id": "J98n2rfwcEqxSXPmoyrAezPc1Q4X6CzeZdygAe2IZaA=",
  "lowest_price_24h": 3.2046504862368113,
  "highest_price_24h": 3.2046504862368113,
  "last_price": 3.2046504862368113,
  "quote_volume": 0.1,
  "base_volume": 0.031204651
}]
```

---------------------------------------

- */api/v1/tickers*

Example https://v2-data.oswap.io/api/v1/tickers

Return an associative array  of all tickers sorted by markets

```json
{
  "ELRBOANJWTDZC5JUPPZRJ7BP72ZGVLMT-LAMBO-GBYTE": {
    "market_name": "LAMBO-GBYTE",
    "address":"ELRBOANJWTDZC5JUPPZRJ7BP72ZGVLMT",
    "full_market_name":"ELRBOANJWTDZC5JUPPZRJ7BP72ZGVLMT-LAMBO-GBYTE",
    "quote_symbol": "GBYTE",
    "base_symbol": "LAMBO",
    "quote_id": "base",
    "base_id": "J98n2rfwcEqxSXPmoyrAezPc1Q4X6CzeZdygAe2IZaA=",
    "lowest_price_24h": 3.2046504862368113,
    "highest_price_24h": 3.2046504862368113,
    "last_price": 3.2046504862368113,
    "quote_volume": 0.1,
    "base_volume": 0.031204651
  }
}
```
---------------------------------------

- */api/v1/ticker_by_full_market_name/<full_market_name>*

Example https://v2-data.oswap.io/api/v1/ticker_by_full_market_name/MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC

Return a ticker for a specific market identified by the full market name.

```json
{
  "address": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6",
  "full_market_name": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC",
  "market_name": "GBYTE-USDC",
  "quote_symbol": "USDC",
  "base_symbol": "GBYTE",
  "quote_id": "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=",
  "base_id": "base",
  "lowest_price_24h": 21.569597918132715,
  "highest_price_24h": 22.088048728151882,
  "last_price": 21.723220563523515,
  "quote_volume": 10447.2029,
  "base_volume": 477.855551085
}
```

---------------------------------------

- */api/v1/ticker/<market_name>*

Example https://v2-data.oswap.io/api/v1/ticker/GBYTE-USDC

Return a ticker for a specific market identified by base and quote tokens. If there are several markets for the base/quote pair, the market with most liquidity is automatically selected.

```json
{
  "address": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6",
  "full_market_name": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC",
  "market_name": "GBYTE-USDC",
  "quote_symbol": "USDC",
  "base_symbol": "GBYTE",
  "quote_id": "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=",
  "base_id": "base",
  "lowest_price_24h": 21.569597918132715,
  "highest_price_24h": 22.088048728151882,
  "last_price": 21.723220563523515,
  "quote_volume": 10447.2029,
  "base_volume": 477.855551085
}
```

---------------------------------------

- */api/v1/trades_by_full_market_name/<full_market_name>*

Example https://v2-data.oswap.io/api/v1/trades_by_full_market_name/MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC

Return an array of last 24h trades for a specific market identified by the full market name.

```json
[{
  "full_market_name": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC",
  "market_name": "GBYTE-USDC",
  "price": 21.73712384723442,
  "base_volume": 2.160525023,
  "quote_volume": 46.9636,
  "time": "2022-04-05T17:37:32.000Z",
  "timestamp": 1649180252000,
  "trade_id": "JbG9NDJoo77jffSUydV623qhufwjGI0EsEF2o9b8I1s=_0",
  "type": "buy",
  "explorer": "https://explorer.obyte.org/#JbG9NDJoo77jffSUydV623qhufwjGI0EsEF2o9b8I1s="
}]
```

---------------------------------------

- */api/v1/trades/<market_name>*

Example https://v2-data.oswap.io/api/v1/trades/GBYTE-USDC

Return an array of the last 24h trades for a specific market identified by base and quote tokens. If there are several markets for the base/quote pair, the market with most liquidity is automatically selected.

```json
[{
  "full_market_name": "MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC",
  "market_name": "GBYTE-USDC",
  "price": 21.73712384723442,
  "base_volume": 2.160525023,
  "quote_volume": 46.9636,
  "time": "2022-04-05T17:37:32.000Z",
  "timestamp": 1649180252000,
  "trade_id": "JbG9NDJoo77jffSUydV623qhufwjGI0EsEF2o9b8I1s=_0",
  "type": "buy",
  "explorer": "https://explorer.obyte.org/#JbG9NDJoo77jffSUydV623qhufwjGI0EsEF2o9b8I1s="
}]
```

---------------------------------------

- */api/v1/trades?market=<full_market_name>*

Example https://v2-data.oswap.io/api/v1/trades?market=MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC

Return an array of _all_ trades for the specified market. The trades are sorted from old to new and paginated using the `since` parameter, 100 trades per page.

- **since**: the `id` of the last seen trade. The trades starting with (but not including) this trade will be returned. If the `since` parameter is not passed, the first 100 trades since the market's inception will be returned.

```json
[{
  "id":"lfQQrWQJ+HgMdUM/GQ5eqAPdzzKlBbeSwsbE7raoZe4=",
  "price":"20.064322577162415",
  "amount":"0.692278543",
  "amount_quote":"13.8901",
  "side":"buy",
  "timestamp":"2022-03-23T03:13:45.000Z"
}]
```

---------------------------------------


- */api/v1/candles_by_full_market_name/\<full_market_name\>?period=\<period\>&start=\<start\>&end=\<end\>*

Example https://v2-data.oswap.io/api/v1/candles_by_full_market_name/MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC?period=daily&start=2022-04-01&end=2022-04-03

Return an array of candlesticks for a time window. The market is uniquely identified by its full market name.

- **period**: `hourly` or `daily`
- **start**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)
- **end**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)


```json
[{
    "quote_volume": 0.3483240085253005,
    "base_volume": 0.014380741,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2022-04-01T00:00:00.000Z"
}, {
    "quote_volume": 0,
    "base_volume": 0,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2022-04-02T00:00:00.000Z"
}, {
    "quote_volume": 0.035434728,
    "base_volume": 0.0011,
    "highest_price": 32.215553,
    "lowest_price": 32.19175,
    "open_price": 32.215553,
    "close_price": 32.19175,
    "start_timestamp": "2022-04-03T00:00:00.000Z"
}]
```

---------------------------------------


- */api/v1/candles/\<market_name\>?period=\<period\>&start=\<start\>&end=\<end\>*

Example https://v2-data.oswap.io/api/v1/candles/GBYTE-USDC?period=daily&start=2022-04-01&end=2022-04-03

Return an array of candlesticks for a time window. The market is identified by base/quote pair. If there are several markets for the same base/quote pair, the market with most liquidity is automatically selected.

- **period**: `hourly` or `daily`
- **start**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)
- **end**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)


```json
[{
    "quote_volume": 0.3483240085253005,
    "base_volume": 0.014380741,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2022-04-01T00:00:00.000Z"
}, {
    "quote_volume": 0,
    "base_volume": 0,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2022-04-02T00:00:00.000Z"
}, {
    "quote_volume": 0.035434728,
    "base_volume": 0.0011,
    "highest_price": 32.215553,
    "lowest_price": 32.19175,
    "open_price": 32.215553,
    "close_price": 32.19175,
    "start_timestamp": "2022-04-03T00:00:00.000Z"
}]
```

---------------------------------------


- */api/v1/orders/snapshot/?market=\<full_market_name\>*

Example https://v2-data.oswap.io/api/v1/orders/snapshot?market=MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6-GBYTE-USDC

Return a virtual orderbook. There are no real orders since it is an AMM but the virtual orderbook represents the depth of the market. The returned `bids` and `asks` are arrays of [`price`, `amount`] tuples, `amount` being in the base currency.

```json
{
  "bids":[
    [17.548487909638002, 2.567216438],
    [17.51346098766268, 5.100309889]
  ],
  "asks":[
    [17.583602433945185, 2.574063898],
    [17.618769638813077, 5.170418098]
  ],
  "timestamp": "2022-05-02T09:26:34.728Z"
}
```


-------------------------
- */api/v1/balances/\<address\>?start=\<start\>&end=\<end\>*

Example https://v2-data.oswap.io/api/v1/balances/MBTF5GG44S3ARJHIZH3DEAB4DGUCHCF6?start=2022-01-01&end=2022-04-05

Return an array of balances of a pool address for a time window.

- **start**: ISO8601 date (`2020-09-25`)
- **end**: ISO8601 date (`2020-09-25`)

```json
[
  {
    "balance_date": "2022-04-01 23:59:59",
    "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=": 246631738,
    "base": 1440240608161
  },
  {
    "balance_date": "2022-04-02 23:59:59",
    "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=": 242589827,
    "base": 1459700798868
  },
  {
    "balance_date": "2022-04-03 23:59:59",
    "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=": 279437493,
    "base": 1291139545344
  },
  {
    "balance_date": "2022-04-04 23:59:59",
    "S/oCESzEO8G2hvQuI6HsyPr0foLfKwzs+GU73nO9H40=": 277960876,
    "base": 1300417719368
  }
]
```

### Nginx
```text
server {
	listen 80;
	server_name localhost;

	location / {
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_pass http://127.0.0.1:4200;
	}

	location ~ \.(js|ico|svg|css|png) {
		root /path/to/dist;
	}
}
```
