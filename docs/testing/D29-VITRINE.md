# D29 — validação da vitrine

## PostgreSQL integrado

O script `apps/api/test/d29-catalogo-postgres.ts` usa a API Nest, autenticação CLIENTE e Prisma ligados ao PostgreSQL real. Ele cria 120 produtos ordenáveis mais casos inativo, sem saldo, totalmente reservado e sem linha de estoque; compara todas as páginas com o conjunto elegível esperado e verifica ordem, limite, `hasMore`, perdas e IDs duplicados. Os dados levam um marcador aleatório e o `finally` apaga somente os IDs que o próprio script criou. O script PostgreSQL existente `catalogo-postgres.ts` continua reservado ao fluxo D25.

Pré-requisitos: PostgreSQL local em `localhost`/`127.0.0.1:5432`, banco dedicado `cupcake_d29`, schema `public`, migrations do projeto aplicadas, e usuário/senha com permissão de criar e remover registros nas tabelas usadas. O script recusa outros hosts/bancos e não cria nem apaga banco ou schema. Não reutilize uma base com dados de desenvolvimento.

Exemplo (substitua usuário/senha por credenciais locais não versionadas):

```sh
cd apps/api
D29_TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/cupcake_d29?schema=public' npm run test:catalogo:postgres
```

O valor é passado pelo ambiente, não gravado em `.env`, fixtures ou logs. O script verifica banco/schema e presença de migrations concluídas. Um PASS só existe se essa execução terminar e imprimir a linha `PASS D29 PostgreSQL`.

## Amostra controlada de API

No mesmo banco dedicado, `npm run test:catalogo:postgres -- --measure` imprime dez tempos de ida e volta HTTP para a primeira página, ambiente, tamanho da fixture, elegíveis, limite e quantidade/tamanho de imagens. A medição de API cobre resposta HTTP vista pelo processo Node de teste (inclui loopback); não é uma medição isolada do tempo interno do servidor.

O relatório desse comando marca os tempos Mobile, primeira apresentação útil e total como `null`, e o resultado de 3 s como `NOT_EVALUATED`, pois mede apenas a ida e volta HTTP da API. A avaliação Mobile integrada está registrada na seção "Evidência integrada no iPhone" abaixo.

## Medição de desempenho

O PLAN define um cenário integrado local com pelo menos 100 produtos, primeira página do Mobile utilizável em até 3 s e tempos separados para API, cliente, apresentação e imagens. O teste PostgreSQL acima comprova consulta/paginação, mas não mede a renderização Flutter nem a carga de imagens. Widget tests com API fake são apenas cobertura de estados e não evidência de latência.

O ambiente dispõe de iPhone físico e build Flutter Profile. A instrumentação opcional `D29_PERF` registra início da operação, retorno da primeira página, primeiro frame com nome e preço e conclusão dos downloads de bytes de imagens. Foram coletadas duas amostras integradas no aparelho, detalhadas abaixo. O frame é observado pelo callback pós-frame do Flutter; o marco não mede a rasterização na tela. Downloads de bytes não medem decodificação e pintura final das imagens.

O PIT não define perfil de rede. O alvo do PLAN é, portanto, limitado ao cenário local declarado; não representa SLA de staging ou rede externa.

## FIX após review (16/10/2026)

**Ambiente daquela FIX:** macOS 26.6.2 arm64; Flutter 3.47.6 / Dart 3.13.5; Xcode 27.0; iPhone físico iOS 27.2 (`Diego’s iPhone`). O banco dedicado era `cupcake_d29`; o IP LAN configurado era `172.25.0.17:3000`. A vitrine havia sido executada no iPhone físico. Naquela sessão, `pg_isready -h localhost -p 5432` não obteve resposta e a tentativa de `GET http://172.25.0.17:3000/health` expirou após 3 s. A integração não estava acessível naquela ocasião; a coleta posterior está registrada abaixo. Nenhuma operação foi feita em `cupcake_d25`.

**Contrato de HTTP local:** `localhost`, `127.0.0.1` e `::1` são os únicos hosts loopback aceitos diretamente. Os IPs LAN específicos `172.25.0.17` e `192.168.18.3` exigem build debug/profile e `--dart-define=ALLOW_LOCAL_HTTP_API=true`. Qualquer outro host HTTP é rejeitado, mesmo com essa autorização; hosts externos exigem HTTPS. O teste preexistente de rejeição a `http://example.com` foi preservado.

**Comando para reproduzir o cenário local medido:** com `cupcake_d29` migrado, API ativa no IP LAN e cliente autenticado, iniciar a partir de `apps/mobile`:

```sh
flutter run --profile -d 00008110-001E25C91A38401E --dart-define=API_BASE_URL=http://192.168.18.3:3000 --dart-define=ALLOW_LOCAL_HTTP_API=true --dart-define=D29_PERF=true
```

`start` é o início da carga da primeira página; `page_result` registra o retorno com quantidade de produtos e imagens; `first_useful_frame` registra o primeiro frame pós-build com nome e preço; `image_bytes` registra duração e tamanho de cada download iniciado por cartões montados. O `elapsed_ms` de `first_useful_frame` é o total observado da operação até esse marco. A fixture do harness de API possui 96 elegíveis, portanto não basta, por si só, para comprovar o cenário de ≥100 produtos elegíveis na vitrine; a coleta integrada usou a fixture persistente de 120 elegíveis descrita abaixo.

| Componente | Evidência integrada posterior | Limitação |
|---|---|---|
| Início e resposta | `page_result`: 43 ms e 35 ms, 20 itens em cada amostra | `page_result` inclui espera por auth/retry e transporte, não isola processamento da API |
| Primeira apresentação útil e total observado | `first_useful_frame`: 53 ms e 45 ms desde `start` | Não mede rasterização física da tela |
| Imagens | `images_available=0` em ambas as amostras; nenhum `image_bytes` exercitado | Não há evidência de latência de imagens nem de decodificação/pintura |

**RNF-HU03-1:** a avaliação vigente é **PASS no cenário local medido**, conforme as amostras profile integradas abaixo. O limite de 3 s não constitui SLA geral. A latência de imagens permanece sem evidência porque a fixture não possui imagens.

**Regressão daquela FIX:** `flutter test test/customer_registration_api_test.dart` PASS; `flutter test` PASS (92 testes); `flutter test --dart-define=ALLOW_LOCAL_HTTP_API=true test/api_config_local_http_test.dart` PASS; `flutter analyze` PASS; `git diff --check` PASS. O teste preexistente de rejeição a HTTP externo não foi removido nem flexibilizado. Não houve commit. A tentativa seguinte e a coleta integrada estão registradas abaixo.

## Nova tentativa EXEC/FIX (16/10/2026)

O PostgreSQL 16 local foi iniciado em `localhost:5432` com um banco dedicado `cupcake_d29`; as duas migrations foram aplicadas nele. O harness `D29_TEST_DATABASE_URL=postgresql://diego@localhost:5432/cupcake_d29?schema=public npm run test:catalogo:postgres -- --measure` passou com 124 registros próprios, 96 elegíveis e dez tempos HTTP de loopback de 1,39 a 1,76 ms. Esse harness apagou seus registros ao terminar. Em seguida, foi criada no mesmo banco uma fixture persistente de 120 produtos elegíveis em três categorias, preço `12.30`, estoque físico 5 e reservado 0, sem imagens (`D29-PROFILE-20261016`). A API iniciou na porta 3000; `/health` respondeu HTTP 200 em `127.0.0.1` e `192.168.18.3`. Login CLIENTE da fixture e primeira página de 20 produtos com `hasMore=true` foram confirmados por HTTP local. Nenhuma operação foi feita em `cupcake_d25`.

O Mac estava em `192.168.18.3` (Wi-Fi `en0`), sem o endereço `172.25.0.17`; `GET http://172.25.0.17:3000/health` expirou após 2 s. O app foi compilado em Profile com `API_BASE_URL=http://172.25.0.17:3000`, `ALLOW_LOCAL_HTTP_API=true` e `D29_PERF=true`, e instalado no iPhone físico. Naquela tentativa, a execução foi recusada pelo iOS com o alerta **Desenvolvedor Não Confiável** para a identidade Apple Development local; `devicectl device process launch` confirmou a recusa por perfil ainda não confiável. A abertura e a coleta ocorreram posteriormente, com o IP LAN `192.168.18.3`.

O intervalo HTTP do harness, isoladamente, não substitui o tempo da primeira apresentação útil no iPhone. A coleta integrada posterior resolveu essa pendência para o cenário local declarado abaixo.

**Validação desta tentativa:** `flutter test` PASS (92 testes); `flutter analyze` PASS; `npm test -- --runInBand` PASS (187 testes); `npm run test:e2e -- --runInBand` PASS (233 testes); `npm run build` PASS; harness PostgreSQL D29 PASS. Uma execução e2e simultânea ao `prisma generate` falhou por tipos gerados em atualização; repetida após o build, passou integralmente. O projeto Xcode, `analysis_options.yaml` e `pubspec.lock` foram restaurados ao estado da branch após alterações automáticas das ferramentas.

## Evidência integrada no iPhone (16/10/2026)

A fixture persistente `D29-PROFILE-20261016` tem 120 produtos elegíveis e zero imagens. A API estava acessível pelo iPhone em `192.168.18.3:3000`. O app foi executado em build Flutter Profile no iPhone físico, com `D29_PERF=true`. O console do Xcode confirmou os seguintes marcos da primeira página:

| Geração | `start` | `page_result` desde o início | `first_useful_frame` desde o início |
|---|---|---|---|
| 83 | Registrado | 43 ms; `status=success`; `items=20`; `images_available=0` | 53 ms |
| 84 | Registrado | 35 ms; `status=success`; `items=20`; `images_available=0` | 45 ms |

**RNF-HU03-1: PASS no cenário local medido.** A pior das duas amostras observadas chegou à primeira apresentação útil em 53 ms, abaixo do limite de 3 s. Esse limite foi avaliado para a fixture, o iPhone, o build Profile e a API na rede local declarados; não é um SLA geral. `page_result` representa o tempo observado pelo Mobile até o retorno da página, não uma medição isolada de processamento da API. `first_useful_frame` é o callback pós-frame com nome e preço, não uma medição de rasterização física.

Como a fixture tem zero imagens e ambas as páginas registraram `images_available=0`, o marco `image_bytes` não foi exercitado. Não há medição de latência de download, decodificação ou pintura de imagens nesta evidência.
