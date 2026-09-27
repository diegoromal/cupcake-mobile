import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readS3StorageConfig, S3StorageConfig } from './s3-storage.config';

function isUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number }; cause?: unknown };
  if ((candidate.$metadata?.httpStatusCode ?? 0) >= 500) return true;
  const known = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
    'EAI_AGAIN', 'TimeoutError', 'NetworkingError', 'RequestTimeout', 'SlowDown', 'ServiceUnavailable']);
  return known.has(candidate.name ?? '') || known.has(candidate.code ?? '') ||
    (candidate.cause !== undefined && isUnavailable(candidate.cause));
}

@Injectable()
export class S3StorageService {
  private client?: S3Client;
  private config?: S3StorageConfig;

  private connection() {
    this.config ??= readS3StorageConfig();
    this.client ??= new S3Client({
      endpoint: this.config.endpoint, region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey },
    });
    return { client: this.client, bucket: this.config.bucket };
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (isUnavailable(error)) throw new ServiceUnavailableException('Storage indisponível.');
      throw error;
    }
  }

  async put(key: string, body: Buffer): Promise<void> {
    const { client, bucket } = this.connection();
    await this.run(() => client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/webp' })));
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.connection();
    await this.run(() => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
  }

  async get(key: string) {
    const { client, bucket } = this.connection();
    return this.run(() => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })));
  }

  async head(key: string) {
    const { client, bucket } = this.connection();
    return this.run(() => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })));
  }

  async list(prefix: string, continuationToken?: string) {
    const { client, bucket } = this.connection();
    return this.run(() => client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })));
  }
}
