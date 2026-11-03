const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getPayoutClient } = require('../dist/config/payos-payout');
(async () => {
  const { client } = getPayoutClient();
  const account = await client.payoutsAccount.balance();
  console.log(JSON.stringify({ connected: true, currency: account.currency, availableBalance: account.balance }));
  console.log('Read-only check. No payout was created.');
})().catch(error => {
  let detail = String(error.desc || '');
  for (const key of ['PAYOS_PAYOUT_CLIENT_ID', 'PAYOS_PAYOUT_API_KEY', 'PAYOS_PAYOUT_CHECKSUM_KEY']) {
    const secret = process.env[key]?.trim();
    if (secret) detail = detail.split(secret).join('[redacted]');
  }
  console.error(JSON.stringify({ connected: false, type: error.name, code: error.code,
    message: error.isOperational ? error.message : detail || 'Kiểm tra khóa riêng kênh chi, IP whitelist, nguồn tiền và gói dịch vụ chi.' }));
  process.exitCode = 1;
});
