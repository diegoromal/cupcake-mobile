const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
async function db(wrong) {
  let disconnected = false;
  const processMock = { exitCode: 0, env: { DATABASE_URL: wrong ? 'wrong' : 'correct' }, exit: () => { throw Error('timeout'); } };
  class PrismaService {
    async $queryRawUnsafe(sql) { assert.equal(sql, 'SELECT 1'); if (processMock.env.DATABASE_URL === 'wrong') throw Error('credential secret'); }
    async $disconnect() { disconnected = true; }
  }
  const source = fs.readFileSync(path.join(root, 'apps/api/scripts/check-runtime-db.cjs'), 'utf8');
  vm.runInNewContext(source, { require: () => ({ PrismaService }), process: processMock, setTimeout, clearTimeout, console: { error: () => {} } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(disconnected, true);
  assert.equal(processMock.exitCode, wrong ? 1 : 0);
}
async function storage({ ambiguousPut = false, failDelete = false, old = false, seed } = {}) {
  const prefix = 'staging-health/';
  const objects = seed ?? new Map();
  const recent = `${prefix}recent`;
  const outside = 'products/image';
  objects.set(recent, new Date()); objects.set(outside, new Date(0));
  if (old) objects.set(`${prefix}old`, new Date(0));
  const deleted = [];
  const calls = [];
  const classes = {};
  for (const name of ['PutObjectCommand','HeadObjectCommand','GetObjectCommand','DeleteObjectCommand','ListObjectsV2Command']) classes[name] = class { constructor(input) { this.input = input; this.name = name; } };
  class S3Client {
    async send(command) {
      const { Key, Prefix } = command.input;
      calls.push(command.name);
      if (command.name === 'ListObjectsV2Command') return { Contents: [...objects].filter(([k]) => k.startsWith(Prefix)).map(([Key, LastModified]) => ({ Key, LastModified })) };
      if (command.name === 'PutObjectCommand') { objects.set(Key, new Date()); if (ambiguousPut) throw Error('lost response'); return {}; }
      if (command.name === 'HeadObjectCommand') { if (!objects.has(Key)) throw Error('missing'); return {}; }
      if (command.name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => Buffer.from('staging-check') } };
      if (command.name === 'DeleteObjectCommand') { if (failDelete && Key !== `${prefix}old`) throw Error('delete error'); objects.delete(Key); deleted.push(Key); return {}; }
    }
    destroy() {}
  }
  const processMock = { env: { S3_BUCKET: 'mock' }, pid: 3, exitCode: 0 };
  const source = fs.readFileSync(path.join(root, 'apps/api/scripts/check-storage.cjs'), 'utf8');
  vm.runInNewContext(source, { require: name => name === '@aws-sdk/client-s3' ? { S3Client, ...classes } : require(name), process: processMock, Buffer, Date, console: { warn: () => {}, error: () => {} } });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(objects.has(recent) && objects.has(outside));
  assert(!deleted.includes(recent) && !deleted.includes(outside));
  if (old) assert(!objects.has(`${prefix}old`));
  assert.equal(processMock.exitCode, ambiguousPut ? 1 : 0);
  assert(calls.includes('PutObjectCommand'));
  return { objects, deleted };
}
(async () => {
  await db(false); await db(true);
  await storage();
  await storage({ ambiguousPut: true });
  const failed = await storage({ failDelete: true, old: true });
  assert([...failed.objects.keys()].some(k => k.startsWith('staging-health/') && k !== 'staging-health/recent'));
  for (const key of failed.objects.keys()) if (key.startsWith('staging-health/') && key !== 'staging-health/recent') failed.objects.set(key, new Date(0));
  const recovered = await storage({ seed: failed.objects });
  assert([...recovered.objects.keys()].every(k => k === 'staging-health/recent' || !k.startsWith('staging-health/')));
  console.log('API DB correct/wrong and storage cleanup scenarios PASS');
})().catch(e => { console.error(e); process.exitCode = 1; });
