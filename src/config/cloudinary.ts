import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

export const isCloudinaryConfigured = (): boolean =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const uploadImage = async (file: Express.Multer.File, baseUrl: string): Promise<string> => {
  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bookhaven/covers' },
        (error, result) => {
          if (error || !result) return reject(error || new Error('Upload failed'));
          resolve(result.secure_url);
        }
      );
      stream.end(file.buffer);
    });
  }

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
  fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
  return `${baseUrl}/uploads/${fileName}`;
};