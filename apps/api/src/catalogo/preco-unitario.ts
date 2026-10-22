import { Prisma } from '../generated/prisma/client';

export function somarPrecoUnitario(
  precoAtual: Prisma.Decimal,
  ajustes: readonly (Prisma.Decimal | null)[],
): Prisma.Decimal {
  return ajustes.reduce<Prisma.Decimal>(
    (soma, ajuste) => soma.plus(ajuste ?? new Prisma.Decimal(0)),
    precoAtual,
  );
}
