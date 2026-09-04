const multer = require('multer');
const path = require('path');

// Memory storage, not disk: files are forwarded to Supabase Storage (see
// utils/storage.js) rather than written to the local filesystem, which is
// ephemeral/read-only on Vercel. req.file.buffer holds the upload.
function makeUploader(allowedExt) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExt.includes(ext)) {
        return cb(new Error(`Only ${allowedExt.join(', ')} files are allowed`));
      }
      cb(null, true);
    }
  });
}

const uploadLogo = makeUploader(['.png', '.jpg', '.jpeg', '.svg', '.webp']);
const uploadPhoto = makeUploader(['.png', '.jpg', '.jpeg', '.webp']);
const uploadImport = makeUploader(['.csv', '.xlsx', '.xls']);
const uploadGallery = makeUploader(['.png', '.jpg', '.jpeg', '.webp']);

module.exports = { uploadLogo, uploadPhoto, uploadImport, uploadGallery };
