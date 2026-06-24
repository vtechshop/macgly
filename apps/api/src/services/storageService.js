const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = require('../config/env');

let adapter = null;

function getAdapter() {
  if (adapter) return adapter;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    const CloudinaryAdapter = require('../adapters/storage/CloudinaryAdapter');
    adapter = new CloudinaryAdapter();
  } else {
    const LocalAdapter = require('../adapters/storage/LocalAdapter');
    adapter = new LocalAdapter();
  }
  return adapter;
}

async function uploadFile(file, folder = 'general') {
  return getAdapter().upload(file, folder);
}

async function deleteFile(publicId) {
  return getAdapter().delete(publicId);
}

module.exports = { uploadFile, deleteFile };
