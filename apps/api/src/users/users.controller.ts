import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  createClient(@Body() input: CreateClientDto) {
    return this.usersService.createClient(input);
  }
}
