import ChatAttachment from '../models/ChatAttachment.model';
import { getCloudinary } from '../config/cloudinary';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatAttachments');
export async function deletePendingAttachment(id: string, uploadedBy?: string): Promise<boolean> {
  const file = await ChatAttachment.findOneAndUpdate({ _id: id, messageId: null,
    $or: [{ deleting: { $ne: true } }, { updatedAt: { $lt: new Date(Date.now() - 10 * 60000) } }],
    ...(uploadedBy ? { uploadedBy } : {}),
  }, { $set: { deleting: true } }, { new: true }).select('+publicId');
  if (!file) return false;
  try {
    const result = await getCloudinary().uploader.destroy(file.publicId, { resource_type: 'raw', type: 'authenticated' });
    if (!['ok', 'not found'].includes(result.result)) throw new Error('Storage deletion failed');
    await ChatAttachment.deleteOne({ _id: file._id, messageId: null, deleting: true });
    return true;
  } catch (error) {
    await ChatAttachment.updateOne({ _id: id, messageId: null }, { $set: { deleting: false } });
    throw error;
  }
}

export async function cleanupPendingAttachments(): Promise<void> {
  // Session drafts may keep files for seven days; sent files are never selected.
  const files = await ChatAttachment.find({ messageId: null, createdAt: { $lt: new Date(Date.now() - 7 * 86400000) } }).select('_id').limit(100);
  for (const file of files) {
    try { await deletePendingAttachment(String(file._id)); }
    catch { log.warn('Could not remove an expired pending attachment'); }
  }
}

export function startChatAttachmentCleanup(): void {
  const run = () => cleanupPendingAttachments().catch(() => log.warn('Pending attachment cleanup failed'));
  void run();
  setInterval(run, 3600000).unref();
}
