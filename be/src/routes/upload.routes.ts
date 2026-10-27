import { Router, Request, Response } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { v2 as cloudinary } from 'cloudinary';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('Upload');
router.use(protect);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

// POST /upload — handle file upload via base64
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, fileData, fileType } = req.body;

    if (!fileName || !fileData) {
      res.status(400).json({ success: false, message: 'fileName và fileData là bắt buộc' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (fileType && !allowedTypes.includes(fileType)) {
      res.status(400).json({ success: false, message: 'Loại file không được hỗ trợ' });
      return;
    }

    const buffer = Buffer.from(fileData, 'base64');
    const maxSize = 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      res.status(400).json({ success: false, message: 'File quá lớn (tối đa 5MB)' });
      return;
    }

    const resourceType = fileType === 'application/pdf' ? 'raw' : 'image';
    const dataUri = `data:${fileType || 'image/jpeg'};base64,${fileData}`;

    const result = await cloudinary.uploader.upload(dataUri, {
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
    log.error('Cloudinary upload failed', err);
    res.status(500).json({
      success: false,
      message: 'Không thể tải ảnh lên bộ lưu trữ. Vui lòng kiểm tra cấu hình Cloudinary hoặc thử lại.',
    });
  }
});

export default router;
