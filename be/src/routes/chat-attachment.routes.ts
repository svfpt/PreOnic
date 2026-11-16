import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import path from 'path';
import { UploadApiResponse } from 'cloudinary';
import { AuthRequest } from '../types';
import { protect, requireCompleteProfile } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import { getCloudinary } from '../config/cloudinary';
import { Conversation } from '../models/Message.model';
import ChatAttachment from '../models/ChatAttachment.model';
import { deletePendingAttachment } from '../services/chat-attachment-cleanup';

const router = Router();
const maxSize = 5 * 1024 * 1024;
const types: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip', '.txt': 'text/plain',
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxSize, files: 1, fields: 0 } }).single('file');

router.use(protect);

router.delete('/attachments/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !await deletePendingAttachment(req.params.id, req.user!.id)) {
      throw new AppError('Tệp không tồn tại hoặc đã được gửi', 404);
    }
    res.json({ success: true });
  } catch (err) { next(err instanceof AppError ? err : new AppError('Không thể xóa tệp. Vui lòng thử lại.', 502)); }
});

router.post('/conversations/:id/attachments', requireCompleteProfile,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !await Conversation.exists({ _id: req.params.id, participants: req.user!.id })) {
        throw new AppError('Cuộc trò chuyện không tồn tại', 404);
      }
      // Check membership before buffering or uploading any bytes.
      upload(req, res, async (error) => {
        if (error) {
          res.status(400).json({ success: false, message: 'Chỉ chọn một tệp, tối đa 5 MB mỗi lần tải.' });
          return;
        }
        try {
          const file = req.file;
          if (!file || !file.size) throw new AppError('Vui lòng chọn tệp có nội dung', 400);
          const extension = path.extname(file.originalname).toLowerCase();
          const mimeType = types[extension];
          if (!mimeType) throw new AppError('Chỉ hỗ trợ JPG, PNG, WebP, PDF, Word, Excel, ZIP và TXT', 400);
          const bytes = file.buffer;
          const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
          const office = bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
          const valid = mimeType === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            : mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
            : mimeType === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
            : extension === '.pdf' ? bytes.toString('ascii', 0, 5) === '%PDF-'
            : ['.zip', '.docx', '.xlsx'].includes(extension) ? zip
            : ['.doc', '.xls'].includes(extension) ? office
            : !bytes.includes(0);
          if (!valid) throw new AppError('Nội dung tệp không khớp định dạng đã chọn', 400);
          const cloud = getCloudinary();
          const result = await new Promise<UploadApiResponse>((resolve, reject) => {
            cloud.uploader.upload_stream({ folder: 'preonic/chat', resource_type: 'raw', type: 'authenticated' },
              (err, uploaded) => err || !uploaded ? reject(err || new Error('Upload failed')) : resolve(uploaded))
              .end(bytes);
          });
          let attachment;
          try {
            attachment = await ChatAttachment.create({
              conversationId: req.params.id, uploadedBy: req.user!.id,
              originalName: path.basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'attachment',
              mimeType, size: file.size, publicId: result.public_id,
            });
          } catch (err) {
            await cloud.uploader.destroy(result.public_id, { resource_type: 'raw', type: 'authenticated' }).catch(() => undefined);
            throw err;
          }
          res.status(201).json({ success: true, data: {
            _id: attachment._id, originalName: attachment.originalName, mimeType, size: file.size,
          } });
        } catch (err) { next(err instanceof AppError ? err : new AppError('Không thể tải tệp lên. Vui lòng thử lại.', 502)); }
      });
    } catch (err) { next(err); }
  });

router.get('/attachments/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Không tìm thấy tệp', 404);
    const file = await ChatAttachment.findById(req.params.id).select('+publicId');
    if (!file || (!file.messageId && String(file.uploadedBy) !== req.user!.id)
      || !await Conversation.exists({ _id: file.conversationId, participants: req.user!.id })) {
      throw new AppError('Không tìm thấy tệp', 404);
    }
    const url = getCloudinary().url(file.publicId, { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true });
    const downloaded = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: maxSize });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/'/g, '%27')}`);
    res.send(Buffer.from(downloaded.data));
  } catch (err) { next(err instanceof AppError ? err : new AppError('Không thể tải tệp. Vui lòng thử lại.', 502)); }
});

export default router;
