import { createHmac } from 'crypto';
import { PayOS } from '@payos/node';

describe('payOS SDK webhook signature verification', () => {
  const checksumKey = 'test-checksum';
  const payos = new PayOS({ clientId: 'test', apiKey: 'test', checksumKey });
  const data = {
    orderCode: 123456,
    amount: 10000,
    description: 'PON123456',
    accountNumber: '123456789',
    reference: 'REF123',
    transactionDateTime: '2026-11-03 12:00:00',
    currency: 'VND',
    paymentLinkId: 'test-link',
    code: '00',
    desc: 'success',
  };
  const signature = createHmac('sha256', checksumKey)
    .update(
      Object.entries(data)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    )
    .digest('hex');

  it('accepts a correctly signed payload', async () => {
    await expect(
      payos.webhooks.verify({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature,
      }),
    ).resolves.toEqual(data);
  });

  it('rejects a changed payment amount using the original signature', async () => {
    await expect(
      payos.webhooks.verify({
        code: '00',
        desc: 'success',
        success: true,
        data: { ...data, amount: 500000 },
        signature,
      }),
    ).rejects.toThrow();
  });
});
