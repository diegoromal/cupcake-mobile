const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
const Bucket = process.env.S3_BUCKET;
const Prefix = 'staging-health/';
const Key = `${Prefix}${Date.now()}-${process.pid}-${require('node:crypto').randomBytes(8).toString('hex')}`;
const Body = Buffer.from('staging-check');
async function cleanOld() {
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token }));
    for (const item of page.Contents ?? []) {
      if (item.Key?.startsWith(Prefix) && item.LastModified && Date.now() - new Date(item.LastModified).getTime() >= 24 * 60 * 60 * 1000) {
        try { await client.send(new DeleteObjectCommand({ Bucket, Key: item.Key })); }
        catch { console.warn('storage: limpeza de objeto antigo falhou'); }
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}
(async () => {
  let error;
  try {
    await cleanOld();
    await client.send(new PutObjectCommand({ Bucket, Key, Body }));
    await client.send(new HeadObjectCommand({ Bucket, Key }));
    const response = await client.send(new GetObjectCommand({ Bucket, Key }));
    if (!Buffer.from(await response.Body.transformToByteArray()).equals(Body)) throw Error('get mismatch');
    await client.send(new ListObjectsV2Command({ Bucket, Prefix: Key }));
  } catch { error = Error('storage: check falhou'); }
  finally {
    // PUT may have succeeded even if its response was lost. DELETE is safe for a missing key.
    try { await client.send(new HeadObjectCommand({ Bucket, Key })); } catch { /* PUT may have failed or HEAD may be ambiguous. */ }
    try { await client.send(new DeleteObjectCommand({ Bucket, Key })); }
    catch { console.warn('storage: limpeza do objeto atual pendente'); }
    client.destroy();
  }
  if (error) throw error;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
