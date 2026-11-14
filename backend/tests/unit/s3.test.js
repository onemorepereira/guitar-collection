process.env.S3_BUCKET_IMAGES = 'test-bucket';
process.env.CLOUDFRONT_DOMAIN = 'images.example.com';
process.env.AWS_REGION = 'us-east-1';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}));

const { mockClient } = require('aws-sdk-client-mock');
const {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Mock = mockClient(S3Client);
const s3 = require('../../src/lib/s3');

// A minimal valid JPEG magic-number header (FF D8 FF E0 ...), 12 bytes.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

beforeEach(() => {
  s3Mock.reset();
  getSignedUrl.mockClear();
});

describe('s3 wrapper (v3)', () => {
  test('generateUploadUrl returns a presigned URL and a user-scoped key', async () => {
    const { uploadUrl, key } = await s3.generateUploadUrl('user-a', 'photo.jpg', 'image/jpeg');
    expect(uploadUrl).toBe('https://signed.example/upload');
    expect(key).toMatch(/^uploads\/user-a\/[0-9a-f-]+\.jpg$/);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  test('moveUploadedFile validates the signature, copies to images/, deletes source', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'image/jpeg', ContentLength: 2048 });
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => JPEG_BYTES },
    });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const dest = await s3.moveUploadedFile('uploads/user-a/file.jpg', 'user-a');

    expect(dest).toBe('images/user-a/file.jpg');
    const copy = s3Mock.commandCalls(CopyObjectCommand)[0].args[0].input;
    expect(copy.Key).toBe('images/user-a/file.jpg');
    expect(copy.CopySource).toBe('test-bucket/uploads/user-a/file.jpg');
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
  });

  describe('moveUploadedFile size limit', () => {
    const { IMAGE_CONSTRAINTS } = require('../../src/config/constants');
    const MAX = IMAGE_CONSTRAINTS.MAX_SIZE_BYTES;

    function stubValidJpeg(contentLength) {
      s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'image/jpeg', ContentLength: contentLength });
      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToByteArray: async () => JPEG_BYTES },
      });
      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});
    }

    test('rejects an object larger than the limit, deletes it, and never copies it', async () => {
      stubValidJpeg(MAX + 1);

      await expect(s3.moveUploadedFile('uploads/user-a/big.jpg', 'user-a'))
        .rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });

      expect(s3Mock.commandCalls(CopyObjectCommand)).toHaveLength(0);
      const deletes = s3Mock.commandCalls(DeleteObjectCommand);
      expect(deletes).toHaveLength(1);
      expect(deletes[0].args[0].input.Key).toBe('uploads/user-a/big.jpg');
    });

    test('accepts an object exactly at the limit', async () => {
      stubValidJpeg(MAX);
      await expect(s3.moveUploadedFile('uploads/user-a/ok.jpg', 'user-a'))
        .resolves.toBe('images/user-a/ok.jpg');
    });

    test('fails closed when S3 reports no size', async () => {
      stubValidJpeg(undefined);
      await expect(s3.moveUploadedFile('uploads/user-a/unknown.jpg', 'user-a'))
        .rejects.toMatchObject({ name: 'ValidationError' });
      expect(s3Mock.commandCalls(CopyObjectCommand)).toHaveLength(0);
    });

    test('does not read the object body when it is oversized', async () => {
      stubValidJpeg(MAX + 1);
      await expect(s3.moveUploadedFile('uploads/user-a/big.jpg', 'user-a')).rejects.toThrow();
      expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
    });
  });

  test('objectExists returns false when HeadObject 404s (v3 error.name NotFound)', async () => {
    s3Mock.on(HeadObjectCommand).rejects(Object.assign(new Error('NotFound'), { name: 'NotFound' }));
    expect(await s3.objectExists('images/user-a/missing.jpg')).toBe(false);
  });

  test('objectExists returns true when HeadObject succeeds', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'image/jpeg' });
    expect(await s3.objectExists('images/user-a/x.jpg')).toBe(true);
  });

  test('deleteImages sends a single DeleteObjectsCommand with all keys', async () => {
    s3Mock.on(DeleteObjectsCommand).resolves({});
    await s3.deleteImages(['images/user-a/a.jpg', 'images/user-a/b.jpg']);
    const input = s3Mock.commandCalls(DeleteObjectsCommand)[0].args[0].input;
    expect(input.Delete.Objects).toEqual([
      { Key: 'images/user-a/a.jpg' },
      { Key: 'images/user-a/b.jpg' },
    ]);
  });

  test('getImageUrl uses the CloudFront domain', () => {
    expect(s3.getImageUrl('images/user-a/x.jpg')).toBe('https://images.example.com/images/user-a/x.jpg');
  });
});
