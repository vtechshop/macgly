/**
 * The adapter must call the Cloudinary SDK through its v2 interface. Through
 * the package root (v1) upload_stream takes (callback, options), so the
 * adapter's callback was never invoked and uploads hung forever.
 */
const cloudinary = require('cloudinary');
const CloudinaryAdapter = require('../../adapters/storage/CloudinaryAdapter');

describe('CloudinaryAdapter.upload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves with the url and public id the SDK reports', async () => {
    const spy = jest.spyOn(cloudinary.v2.uploader, 'upload_stream').mockImplementation((options, callback) => {
      expect(typeof options).toBe('object');
      expect(typeof callback).toBe('function');
      return { end: () => callback(null, { secure_url: 'https://res.cloudinary.com/x/y.jpg', public_id: 'products/y' }) };
    });
    const result = await new CloudinaryAdapter().upload({ buffer: Buffer.from('x') }, 'products');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].folder).toBe('products');
    expect(result).toEqual({ url: 'https://res.cloudinary.com/x/y.jpg', publicId: 'products/y' });
  });

  it('rejects when the SDK reports an error', async () => {
    jest.spyOn(cloudinary.v2.uploader, 'upload_stream').mockImplementation((options, callback) => (
      { end: () => callback({ message: 'Invalid cloud_name', http_code: 401 }) }
    ));
    await expect(new CloudinaryAdapter().upload({ buffer: Buffer.from('x') }, 'products'))
      .rejects.toMatchObject({ message: 'Invalid cloud_name' });
  });
});
