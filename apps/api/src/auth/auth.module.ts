import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AdminEntregadoresController } from './admin-entregadores.controller';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController, AdminEntregadoresController],
  providers: [AuthConfig, AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, UsersModule, AuthConfig, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
