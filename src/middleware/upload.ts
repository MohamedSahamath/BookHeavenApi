import multer from 'multer';
import { ApiError } from '../utils/apiError';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPG, PNG or WEBP images are allowed'));
    }
  },
}).single('coverImage');