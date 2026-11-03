import { ProductService } from '../services/product.service';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db';

describe('Product image gallery persistence', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  const user = '000000000000000000000001';
  const images = ['https://example.com/one.jpg', 'https://example.com/two.jpg', 'https://example.com/three.jpg'];
  const body = { name: 'Xoai', location: 'Viet Nam', farm: 'Farm', image: images[0], images,
    priceMin: 10000, priceMax: 15000, category: 'fruit', region: 'south' };

  it('saves all photos and retains the first as the cover', async () => {
    const product = await ProductService.create(body, user, 'Test Farmer');
    const saved = await ProductService.getById(String(product._id));
    expect(saved.images).toEqual(images);
    expect(saved.image).toBe(images[0]);
    const updated = await ProductService.update(String(product._id), user, { images: [...images].reverse() });
    expect(updated.images).toEqual([...images].reverse());
    expect(updated.image).toBe(images[2]);
  });

  it('keeps legacy single-image products usable', async () => {
    const { images: unused, ...legacy } = body;
    const product = await ProductService.create(legacy, user, 'Test Farmer');
    expect(product.images).toEqual([]);
    expect(product.image).toBe(images[0]);
  });

  it('rejects invalid gallery entries and excessive photo counts', async () => {
    await expect(ProductService.create({ ...body, images: ['javascript:alert(1)'] }, user, 'Test')).rejects.toThrow();
    await expect(ProductService.create({ ...body, images: Array(11).fill(images[0]) }, user, 'Test')).rejects.toThrow();
  });
});
