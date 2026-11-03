import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { v2 as cloudinary } from 'cloudinary';
import uploadRoutes from '../routes/upload.routes';

jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload: jest.fn() } } }));
jest.mock('../middlewares/auth.middleware', () => ({ protect: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../utils/logger', () => ({ createLogger: () => ({ error: jest.fn() }) }));
let server: Server;
let url: string;
const file = { fileName: 'test.png', fileType: 'image/png', fileData: Buffer.from('test-image').toString('base64') };
const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

describe('Cloudinary upload configuration and validation', () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '20mb' }));
    app.use('/upload', uploadRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    keys.forEach(key => delete process.env[key]);
  });
  beforeEach(() => { keys.forEach(key => delete process.env[key]); });
  async function upload(body: unknown) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }

  it('reports missing configuration instead of failing inside the SDK', async () => {
    const response = await upload(file);
    expect(response.status).toBe(503);
    expect(response.body.message).toContain('Chưa cấu hình Cloudinary');
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  it('loads credentials at upload time even when imported before environment initialization', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = ' test-cloud ';
    process.env.CLOUDINARY_API_KEY = ' test-key ';
    process.env.CLOUDINARY_API_SECRET = ' test-secret ';
    (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/image.png' });
    const response = await upload(file);
    expect(response.status).toBe(201);
    expect(response.body.data.url).toBe('https://res.cloudinary.com/test/image.png');
    expect(cloudinary.config).toHaveBeenCalledWith({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: 'test-secret', secure: true });
  });

  it.each([{ ...file, fileData: 'data:image/png;base64,AAAA' }, { ...file, fileData: '!!!!' }, { ...file, fileType: 'text/html' }])(
    'rejects invalid file data or unsupported types', async body => {
      expect((await upload(body)).status).toBe(400);
      expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    }
  );

  it('rejects a file larger than five MB before uploading', async () => {
    expect((await upload({ ...file, fileData: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') })).status).toBe(400);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });
});
