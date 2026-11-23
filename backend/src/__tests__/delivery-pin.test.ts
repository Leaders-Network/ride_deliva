import { generatePin, hashPin, verifyPin } from '@/modules/delivery/pin';

describe('delivery PIN', () => {
  it('is always four digits, including leading zeros', () => {
    for (let i = 0; i < 500; i++) expect(generatePin()).toMatch(/^\d{4}$/);
  });

  it('verifies against its hash and rejects other PINs', async () => {
    const hash = await hashPin('0420');
    expect(hash).not.toContain('0420');
    await expect(verifyPin('0420', hash)).resolves.toBe(true);
    await expect(verifyPin('0421', hash)).resolves.toBe(false);
    await expect(verifyPin('420', hash)).resolves.toBe(false);
  });
});
