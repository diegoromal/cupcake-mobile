# ADR-004 — Deploy de staging

Status: aprovado para implementação; primeiro deploy pendente.

O Admin será servido em `https://app-staging.qosit.cloud` pelo Nginx Proxy Manager (NPM) já existente. O NPM encaminhará HTTP para `10.60.60.30:3001`. O Compose não contém reverse proxy. Somente o Admin publica porta, vinculada ao IP privado. Next acessa NestJS em `http://api:3000` pela rede Docker. PostgreSQL não publica porta; MinIO é serviço externo em `https://api.s3.qosit.cloud`, bucket privado `cupcake-staging-images`.

As imagens são publicadas no GHCR por SHA Git completo: `cupcake-api:<sha>`, `cupcake-api:<sha>-ops` e `cupcake-admin:<sha>`. A VPS é gerenciada por `deploy@45.231.133.145:30322`; releases, estado e secrets ficam em `/home/deploy/cupcake-staging`. O workflow inicial usa apenas `workflow_dispatch`, com CI antes do push/deploy. Produção e publicação de `api-staging.qosit.cloud` ficam fora de escopo.

A origem das mutações Next é comparada com `APP_PUBLIC_URL` server-side porque, atrás do NPM, `request.nextUrl.origin` pode refletir a URL HTTP interna. Cookies continuam `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`.

Rollback de aplicação exige revisão humana de compatibilidade de schema. Migration não é revertida automaticamente. O Compose local com S3Mock permanece separado.
