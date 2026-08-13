const cloudinary = require('cloudinary');
const {
  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
} = require('../../config/env');

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

class CloudinaryAdapter {
  async upload(file, folder = 'shop') {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          quality: 'auto:good',
          fetch_format: 'auto',
          width: 1200,
          crop: 'limit',
        },
        (err, result) => {
          if (err) return reject(err);
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(file.buffer);
    });
  }

  async delete(publicId) {
    await cloudinary.uploader.destroy(publicId);
  }

  /**
   * Generate a short-lived signed URL for a private/restricted Cloudinary resource.
   * The URL expires in `ttlSeconds` (default 300s / 5 minutes).
   *
   * NOTE: For this to enforce access control, the Cloudinary resource must have
   * been uploaded with `type: 'authenticated'` (not the default 'upload').
   * Existing KYC documents uploaded as public `secure_url` are NOT protected by
   * signing alone — a one-time migration is required to change their delivery type
   * in Cloudinary. Until the migration is done, this method still generates a
   * signed URL which limits exposure to the token lifetime.
   *
   * @param {string} publicId        - Cloudinary public_id (without extension)
   * @param {object} [opts]
   * @param {number} [opts.ttlSeconds=300]       - signed URL lifetime in seconds
   * @param {string} [opts.resourceType='image'] - Cloudinary resource_type
   * @param {string} [opts.format]               - file extension (e.g. 'pdf', 'jpg', 'png').
   *                                               Inferred from publicId extension when omitted.
   */
  signedUrl(publicId, { ttlSeconds = 300, resourceType = 'image', format } = {}) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    // Infer format from the publicId extension if not explicitly provided.
    // Cloudinary requires the format to be part of the signed URL so the
    // signature covers the right resource; hardcoding 'jpg' for PDFs or PNGs
    // would generate a broken link.
    const resolvedFormat = format || publicId.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg';
    return cloudinary.utils.private_download_url(publicId, resolvedFormat, {
      resource_type: resourceType,
      expires_at: expiresAt,
      attachment: false,
    });
  }
}

module.exports = CloudinaryAdapter;
