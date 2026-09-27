import { config } from 'dotenv';
import { resolve } from 'node:path';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function readS3StorageConfig(): S3StorageConfig {
  config({ path: resolve(process.cwd(), '../../.env') });
  const names = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
  for (const name of names) {
    if (!process.env[name]) throw new Error(`${name} deve estar definida para usar o storage.`);
  }
  const flag = process.env.S3_FORCE_PATH_STYLE;
  if (flag !== 'true' && flag !== 'false') throw new Error('S3_FORCE_PATH_STYLE deve ser true ou false.');
  const endpoint = new URL(process.env.S3_ENDPOINT!);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('S3_ENDPOINT inválido.');
  }
  return {
    endpoint: endpoint.toString(), region: process.env.S3_REGION!, bucket: process.env.S3_BUCKET!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    forcePathStyle: flag === 'true',
  };
}
