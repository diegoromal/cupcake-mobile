import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'node:path';

export const JWT_ALGORITHM = 'HS256' as const;
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class AuthConfig {
  readonly accessSecret: string;
  readonly refreshSecret: string;

  constructor() {
    config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
    this.accessSecret = this.requiredSecret('JWT_ACCESS_SECRET');
    this.refreshSecret = this.requiredSecret('JWT_REFRESH_SECRET');
    if (this.accessSecret === this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser diferentes.');
    }
  }

  private requiredSecret(name: string): string {
    const value = process.env[name];
    if (!value?.trim()) {
      throw new Error(`${name} deve estar definida.`);
    }
    return value;
  }
}
