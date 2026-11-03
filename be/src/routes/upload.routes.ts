import { Router, Request, Response } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { getCloudinary } from '../config/cloudinary';
import { AppError } from '../middlewares/error.middleware';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('Upload');
router.use(protect);

// POST /upload — handle file upload via base64
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, fileData, fileType } = req.body;

    if (typeof fileName !== 'string' || !fileName.trim() || typeof fileData !== 'string' || !fileData) {
      res.status(400).json({ success: false, message: 'fileName và fileData là bắt buộc' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (fileType && !allowedTypes.includes(fileType)) {
      res.status(400).json({ success: false, message: 'Loại file không được hỗ trợ' });
      return;
    }

    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileData) || fileData.length % 4 !== 0) {
      res.status(400).json({ success: false, message: 'Dữ liệu file base64 không hợp lệ' });
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      res.status(400).json({ success: false, message: 'File quá lớn (tối đa 5MB)' });
      return;
    }

    const resourceType = fileType === 'application/pdf' ? 'raw' : 'image';
    const dataUri = `data:${fileType || 'image/jpeg'};base64,${fileData}`;

    const result = await getCloudinary().uploader.upload(dataUri, {
      folder: 'preonic',
      resource_type: resourceType,
      use_filename: false,
      unique_filename: true,
    });

    res.status(201).json({
      success: true,
      data: {
        url: result.secure_url,
        originalName: fileName,
        size: buffer.length,
      },
    });
  } catch (err) {
    const error = err as { name?: string; http_code?: number };
    log.error('Cloudinary upload failed', { name: error?.name, code: error?.http_code });
    res.status(err instanceof AppError ? err.statusCode : 502).json({
      success: false,
      message: err instanceof AppError ? err.message : 'Không thể tải ảnh lên Cloudinary. Vui lòng kiểm tra cấu hình hoặc thử lại.',
    });
  }
});

export default router;
