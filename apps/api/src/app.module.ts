import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoriasModule } from './categorias/categorias.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [HealthModule, UsersModule, AuthModule, CategoriasModule],
})
export class AppModule {}
