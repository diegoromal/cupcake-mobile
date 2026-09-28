# D22 — Administração de produtos

## Execução

Aplicação Next.js App Router em `apps/admin`, com React, TypeScript e `fetch` nativo. A API NestJS permanece responsável por autenticação, autorização, validação e regras de negócio. A URL `API_BASE_URL` é configurada apenas no servidor Next.js. O cliente chama somente `/api/session/*` e `/api/admin/*` no mesmo domínio.

O login envia credenciais à API e só cria sessão após `GET /admin/produtos` confirmar o perfil ADMIN. Cookies `admin_access` e `admin_refresh` são HttpOnly, SameSite=Lax, Path=/ e Secure em produção. O access dura 15 minutos e o refresh 7 dias. O logout apaga os cookies locais; o refresh da API é stateless e não há endpoint de revogação. Nas chamadas administrativas, access ausente ou 401 dispara um único refresh e uma única repetição; 403 não dispara refresh. Falha do refresh limpa a sessão.

O proxy aceita apenas combinações explícitas de método e rota dos contratos de Produtos, Imagem, Categorias e Personalizações consumidos pela D22. Rejeita query, segmento fora da allowlist e mutação sem Origin do mesmo domínio. Antes de ler o corpo, verifica a sessão e rejeita com 413 o upload cujo `Content-Length` numérico exceda 11 MiB. Esse teto é do request multipart no proxy e inclui 1 MiB de margem para o envelope; o limite real do arquivo na API D21 continua sendo 10 MiB. `Content-Length` ausente ou inválido não impede o fluxo: após a leitura, o proxy também compara o tamanho efetivo do corpo com 11 MiB, e a API valida o arquivo. O corpo segue em bytes com o Content-Type original, incluindo boundary, campo `imagem` e filename. Não há conversão em JSON/base64.

A lista mostra nome, categoria, preço, situação e presença de imagem. O formulário de criação envia categoria, nome, descrição, preço decimal em string e ativo; a edição envia PATCH com campos alterados. Imagem só é enviada após o Produto existir. `Produto.imagem` é key privada, sem URL de leitura. A prévia usa apenas `URL.createObjectURL` do arquivo local e revoga a URL. Personalizações são listadas, vinculadas e desvinculadas; indisponíveis permanecem identificadas. A exclusão pede digitação do nome e preserva a página em erro. O backend decide 409.

## Operação e verificação

Consulte o README para instalação. Execute `npm test`, `npm run lint` e `npm run build` em `apps/admin`. O teste do proxy inclui multipart real via `FormData` e compara bytes e metadados recebidos. A integração completa exige PostgreSQL, S3Mock, API e ADMIN provisionado. Capturas da aplicação executada estão documentadas em [IHC — Painel de Produtos](ihc/admin-produtos.md).

## Evidência da EXEC local

Em 27/09/2026, o smoke foi executado com API NestJS, PostgreSQL `cupcake_d22`, S3Mock e ADMIN provisionado. Um cliente HTTP enviou `FormData` ao Route Handler Next em `localhost:3001`; a API em `localhost:3100` recebeu e processou um PNG real, gravando a key privada no storage. Foram 22 verificações: login, lista, categorias, criação, upload, vínculo, lista vinculada, exclusão 409 com vínculo, edição, desativação, reativação, remoção da imagem, desvínculo, exclusão 204, logout e sessão 401. Fixtures de categoria e personalização foram removidas. O primeiro ensaio abortou por variável incorreta no script temporário após upload; seu produto e categoria residuais foram removidos antes da repetição bem-sucedida.

O conjunto de regressão da API passou com `--no-cache`: 201 testes E2E em 10 suites e 177 testes unitários em 14 suites. A primeira execução E2E sem `--no-cache` carregou cache Jest obsoleto e falhou com 404 em 27 testes de autenticação; a repetição sem cache passou integralmente. O script de smoke temporário não é parte da aplicação.

Após atualização para Next.js 16.3.6 e React 19.3.0, o smoke de 22 verificações foi repetido contra `next start` da build de produção e passou. `npm audit` reportou zero vulnerabilidades para a instalação do painel.

Antes do fix da REVIEW, a evidência validada do painel era de 31 testes em 7 suítes. Após os três testes de regressão do proxy, a suíte passou com 34 testes em 7 suítes. Lint sem avisos, build Next.js 16.3.6 e `git diff --check` sem erro. Foram produzidas quatro capturas reais com `next start`, API NestJS e dados temporários removidos ao final; um upload multipart pelo Route Handler Next retornou 200 e foi processado pela API.

Para o smoke, a API foi iniciada pelo `node dist/main.js` após compilação. O comando `nest start --watch` neste workspace selecionou um artefato antigo em `dist/src` que expunha apenas `/health`; esse artefato não foi alterado nesta D22. A execução de produção do painel usou `API_BASE_URL=http://localhost:3100` e `next start` na porta 3001.
