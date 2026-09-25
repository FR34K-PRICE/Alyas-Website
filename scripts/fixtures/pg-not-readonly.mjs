/**
 * Test fixture for `npm run check:audit`. Preloaded with `node --import` in front of the audit script, it makes the
 * database "lie" that the transaction is NOT read-only, and records every query the audit sends afterwards.
 * The audit must refuse to read anything in that situation.
 */
import pg from "pg";

const original = pg.Client.prototype.query;
pg.Client.prototype.query = function (text, ...rest) {
  const sql = typeof text === "string" ? text : text?.text || "";
  process.stderr.write(`QUERY: ${sql.replace(/\s+/g, " ").slice(0, 70)}\n`);
  if (/SHOW transaction_read_only/i.test(sql)) return Promise.resolve({ rows: [{ transaction_read_only: "off" }] });
  return original.call(this, text, ...rest);
};
