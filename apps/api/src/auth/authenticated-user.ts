import { PerfilUsuario } from '../generated/prisma/enums';

export type AuthenticatedUser = {
  id: string;
  perfil: PerfilUsuario;
};

export type AuthenticatedRequest = {
  headers: { authorization?: string | string[] };
  rawHeaders?: string[];
  user?: AuthenticatedUser;
};
