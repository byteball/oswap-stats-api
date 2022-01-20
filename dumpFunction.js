const db = require('ocore/db');

async function dump(date, oswapAAs) {
  const rows = await db.query('SELECT outputs.address, SUM(amount) AS balance, outputs.asset \n\
    FROM outputs \n\
    JOIN units USING(unit) \n\
    WHERE is_stable=1 AND sequence="good" AND creation_date<=? \n\
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
    GROUP BY address, asset', [date, date]);

  for (let row of rows) {
    if(oswapAAs.includes(row.address)) {
      await db.query(
        "INSERT " + db.getIgnore() + " INTO oswap_aa_balances (address, asset, balance, balance_date) VALUES (?,?,?,strftime('%Y-%m-%d %H:%M:%S', ?))",
        [row.address, row.asset, row.balance, date]);
    }
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
        [row.address, row.asset, row.balance, date]);
  }
}

module.exports = { dumpByAddress };