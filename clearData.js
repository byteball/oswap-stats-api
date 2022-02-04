const db = require('ocore/db');

(async () => {
  await db.query("DELETE FROM daily_candles");
  await db.query("DELETE FROM hourly_candles");
  await db.query("DELETE FROM oswap_aa_balances");
  console.log('done');
})();