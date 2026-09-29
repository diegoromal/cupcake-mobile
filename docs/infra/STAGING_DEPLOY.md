# Staging — preparação e operação

Status: infraestrutura no repositório; primeiro deploy ainda não executado.

## Topologia

Internet → NPM (TLS) → `http://10.60.60.30:3001` → Admin Next → `http://api:3000` → PostgreSQL privado e MinIO externo. `api-staging.qosit.cloud` fica reservado, sem publicação. Uma tarefa futura deverá revisar DNS, NPM, CORS, rate limiting, endpoints públicos, uploads, JWT/RBAC, refresh, headers e firewall antes de ativá-lo.

## VM e rede

SSH: `deploy@45.231.133.145:30322`. Diretório: `/home/deploy/cupcake-staging`, owner `deploy`. Docker e `docker compose`, `flock` e Node 22 devem estar disponíveis ao usuário `deploy`, sem sudo irrestrito. Confirmar `uname -m`: `x86_64` → `linux/amd64`, `aarch64` → `linux/arm64`. Criar antes do deploy o volume externo `cupcake_staging_postgres_data`, a pasta operacional e `.env` com owner `deploy`, modo `0600`. Nunca executar `down -v`, `volume rm` ou prune agressivo.

Firewall: SSH TCP 30322 externo. NPM deve alcançar `10.60.60.30:3001`; permitir essa porta somente da origem real do NPM quando possível. Não expor 3000, 5432, console MinIO nem portas de debug. Validar Docker NAT e regras do host no primeiro deploy. Esperado no SSH: chave, `PasswordAuthentication no`, `PermitRootLogin no`, Fail2ban conforme padrão da cloud. Não modificar firewall ou sshd pelo pipeline.

## GitHub e GHCR

Criar Environment `staging` com URL `https://app-staging.qosit.cloud`. Variables: `STAGING_HOST=45.231.133.145`, `STAGING_SSH_PORT=30322`, `STAGING_USER=deploy`. Secrets: `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`. O known_hosts deve conter `[45.231.133.145]:30322` com fingerprint validada por canal administrativo. Não usar ssh-keyscan como verificação de identidade. Configurar proteção/aprovação do Environment conforme política da equipe. O job de build usa `GITHUB_TOKEN` com `packages: write`; a VPS precisa de credencial de pull distinta com `read:packages` via `docker login --password-stdin` feito administrativamente, sem token em histórico ou arquivo world-readable. Se pacotes forem públicos futuramente, revisar essa exigência.

O workflow manual aceita plataforma confirmada e SHA da `main`. Não acionar antes da preparação. PR executa CI da API e Admin; verificar o nome do required check na proteção de branch, pois workflows reutilizáveis podem exibir contexto composto. Nenhum deploy é disparado por PR ou push na `main`.

## Secrets e MinIO

Copiar `.env.staging.example` para `/home/deploy/cupcake-staging/.env` apenas na VM; preencher segredos de banco/JWT/S3, URL de banco com hostname Docker `postgres`, região S3 confirmada pelo administrador do MinIO, e `S3_FORCE_PATH_STYLE=true`. Não adivinhar a região. O exemplo mantém `S3_REGION` vazia enquanto ela for uma pendência operacional; o Compose permite validar localmente sua estrutura com esse campo vazio, mas o deploy rejeita `S3_REGION` não configurada antes de pull, migration ou checks de saúde. No primeiro deploy, definir um valor operacional válido antes do check de storage. Credenciais S3 ficam somente na VM. Verificar endpoint HTTPS, autenticação, bucket privado existente, put/head/get/list/delete com objeto temporário e limpeza. O check de storage usa a configuração real do container, sem imprimir credenciais. Não criar bucket automaticamente.

## NPM e origem

Proxy Host: domínio `app-staging.qosit.cloud`, scheme `http`, forward host `10.60.60.30`, port `3001`. Force SSL ON, HTTP/2 ON, Block Common Exploits ON inicialmente (validar formulários/upload), Websocket OFF, Cache Assets OFF. Certificado gerenciado no NPM. Todas as rotas, inclusive `/api/*`, vão ao Next. Caso o limite padrão de corpo seja insuficiente, configurar `client_max_body_size 11m`; a API limita o arquivo real a 10 MiB. `APP_PUBLIC_URL` fixa a origem permitida para mutações; cabeçalhos forwarded manipulados não ampliam a permissão. O salto NPM → Next em HTTP não remove `Secure` dos cookies em produção.

## Primeiro deploy

1. Confirmar DNS, TLS, rota NPM e conectividade privada, permissões da VM, arquitetura, Node.js 22 no host, volume externo cupcake_staging_postgres_data, .env, região/bucket MinIO e credencial GHCR.
   Validar na VPS:
   ```bash
   node --version
   docker volume inspect cupcake_staging_postgres_data
   ```
   Caso o volume ainda não exista no primeiro boot:
   ```bash
   docker volume create cupcake_staging_postgres_data
   ```
2. Revisar CI, executar workflow `Deploy staging manual` para o SHA completo pertencente à main, selecionando a plataforma correspondente. O workflow faz CI, build/push GHCR, transfere somente Compose/scripts/metadados de release e executa deploy por SSH.
3. O script obtém `flock`, rejeita sequência obsoleta, faz pull das três imagens por digest, confirma o ID efetivo de API/Admin, inicia PostgreSQL, faz backup `pg_dump -Fc`, executa `prisma migrate deploy` via imagem ops, atualiza API/Admin e testa DB, API, Admin, storage e URL pública. Só grava `deployed-sha` ao fim. Deploy normal do mesmo SHA retorna sem recriar containers; rollback explícito reaplica API/Admin mesmo quando o marker coincide.
4. Fazer smoke manual via HTTPS: login, cookie HttpOnly/Secure/SameSite=Lax/Path=/, refresh, retry, logout, redirects, CRUD e upload abaixo/acima do limite. Nenhuma URL interna deve aparecer no navegador. Recriar containers e confirmar persistência de dado de teste. Conferir usuário não-root, política de restart, logs e volume.

## Estrutura e operação

`releases/<sha>/` guarda Compose, scripts e metadados sem secrets. `.env` fica na raiz. `state/` guarda `deployed-sha`, `previous-sha`, `deployed-sequence`, `release.env`, `deployments.jsonl`, `deploy.lock` e, durante finalização, `deploy-transaction.json`. Backups `pg_dump -Fc` ficam em `backups/postgres/` sem remoção automática. Definir retenção e backup diário em operação separada. Ver SHA com `cat state/deployed-sha`, ver estado com `docker compose --env-file .env -f releases/<sha>/compose.staging.yaml ps`, logs com o mesmo prefixo mais `logs --tail=100`.

Rollback de aplicação: revisar migration/schema e comprovar compatibilidade reversa; depois executar `SCHEMA_COMPATIBLE=1 bash releases/<sha-anterior>/deploy/deploy-staging.sh <sha-anterior> --rollback`. O script nunca reverte migration e exige confirmação explícita. Usa os digests registrados na release (API, ops, Admin), reaplica os containers e compara os IDs efetivos com os digests locais; marker igual não comprova estado runtime. Falha de migration aborta antes de atualizar apps. Falha de DNS/NPM pede correção externa, sem rollback cego. Se schema incompatível, restaurar banco de backup apenas com procedimento humano coordenado.

## Diagnóstico

`/health` comprova apenas processo da API; o check interno também executa `SELECT 1` pelo Prisma dentro do container API, usando sua `DATABASE_URL`, além de verificar PostgreSQL e Admin. O check de storage usa a configuração S3 do próprio container, coleta somente objetos de `staging-health/` com pelo menos 24 horas e tenta excluir o objeto atual mesmo após PUT ambíguo. Falha de limpeza gera warning; conferir objetos pendentes no bucket. O check público valida TLS e `/login`. Em erro de pull, conferir `read:packages`; em erro de migration, inspecionar logs e backup antes de qualquer retry; em 403 nas mutações, conferir `APP_PUBLIC_URL`, Origin e `Sec-Fetch-Site`; em 413, limite NPM/Next; em conexão NPM, IP privado, firewall e NAT Docker. Não imprimir `.env`, headers Authorization ou cookies em logs.

## Transação de finalização e recovery

Com `deploy.lock` adquirido, o deploy reconcilia `state/deploy-transaction.json` antes de comparar SHA ou sequência. O journal contém ID, SHA candidato/anterior, sequências, fase, identidade/caminho/tamanho/SHA-256 de cada backup existente, ausência explícita dos demais, offset/hash do histórico e digests, sem credenciais. A preparação grava temporários e backups e verifica os bytes gravados antes de persistir o journal e publicar os arquivos. O commit publica Compose, release.env, sequência, previous-sha, a linha de histórico e por último deployed-sha. O script sincroniza arquivos e diretórios nas fases críticas; isso melhora a recuperação, mas não cria uma transação atômica entre arquivos.

Se o marker ainda aponta para o SHA anterior, o recovery valida os caminhos, tipos, tamanhos e SHA-256 de **todos** os backups antes da primeira restauração. Também valida o prefixo/sufixo do histórico; então restaura arquivos e remove o append parcial ou completo. Backup ausente ou corrompido aborta sem modificar markers ou limpar evidências: journal e backups permanecem para intervenção manual. Depois de validar o estado restaurado, persiste a fase `restored` antes de remover qualquer backup. Se o marker aponta para o SHA novo e todos os arquivos/histórico estão coerentes, persiste `committed` sem duplicar SUCCESS. Nessas duas fases, a limpeza é retomável: backups já removidos são aceitos, outros erros interrompem a limpeza, e o journal é removido por último. Uma falha de limpeza após commit confirmado gera warning e deixa o journal para a próxima execução.

Recovery manual: manter o lock, copiar `state/`, `deployments.jsonl`, journal e os backups citados no journal para local seguro; comparar marker, sequência, release.env, Compose e sufixo do histórico com o SHA candidato e anterior. Restaurar apenas a partir de backups verificados ou concluir um commit cujo conjunto inteiro seja coerente. Não remover journal/backups nem truncar histórico por tentativa. Depois de reconciliar, executar `flock -n /home/deploy/cupcake-staging/state/deploy.lock node /home/deploy/cupcake-staging/releases/<sha>/deploy/transaction-staging.mjs recover /home/deploy/cupcake-staging/state /home/deploy/cupcake-staging` e somente então repetir o deploy. Se os arquivos não permitirem decidir com segurança, interromper e investigar antes de tocar containers.

O workflow aborta quando uma tag SHA já existe ou a consulta ao GHCR não comprova ausência; depois do push, grava os três digests em `image-digests.json`. Tags são metadado, enquanto pull, migration e Compose usam referências `@sha256:`. A publicação concorrente entre consulta e push ainda depende de controle de permissão/imutabilidade do registry; confirmar a política GHCR antes de tratar tag SHA como exclusiva.
