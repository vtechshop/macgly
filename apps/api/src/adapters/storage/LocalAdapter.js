const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

class LocalAdapter {
  async upload(file, folder = 'general') {
    const dir = path.join(UPLOAD_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const dest = path.join(dir, filename);

    fs.writeFileSync(dest, file.buffer);

    return {
      url: `/uploads/${folder}/${filename}`,
      publicId: `${folder}/${filename}`,
    };
  }

  async delete(publicId) {
    const filePath = path.join(UPLOAD_DIR, publicId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = LocalAdapter;
