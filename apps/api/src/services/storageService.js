const { CLOUDINARY_CLOUD_NAME, isProd } = require('../config/env');

let adapter = null;

function getAdapter() {
  if (adapter) return adapter;
  if (isProd() && CLOUDINARY_CLOUD_NAME) {
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
