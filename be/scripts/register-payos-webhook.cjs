const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getPayOS } = require('../dist/services/payment.service');
(async () => {
  const url = new URL(process.argv[2] || '');
  if (url.protocol !== 'https:' || url.pathname !== '/api/v1/payment/webhook') {
    throw new Error('Provide https://<public-host>/api/v1/payment/webhook');
  }
  await getPayOS().webhooks.confirm(url.toString());
  console.log('payOS webhook registered: ' + url.toString());
})().catch(error => {
  console.error('Could not register webhook: ' + error.name);
  process.exitCode = 1;
});
