import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function isConventionalEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  const localPart = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  const labels = domain.split('.');
  const domainLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  return (
    localPart.test(local) &&
    labels.length >= 2 &&
    labels.every((label) => domainLabel.test(label)) &&
    /^[a-z]{2,}$/.test(labels.at(-1) ?? '')
  );
}

function IsConventionalEmail(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isConventionalEmail',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: isConventionalEmail,
        defaultMessage: () => 'email must use a conventional email format',
      },
    });
  };
}

export class CreateClientDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsConventionalEmail()
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  telefone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  senha!: string;
}
