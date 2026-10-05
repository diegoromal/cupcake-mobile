# D28 — Login e sessão Mobile — PLAN

Status: **READY FOR APPROVAL**, com limites de contrato explícitos. Este documento planeja D28; não registra implementação nem validação executada.

## 1. Contexto e fontes consultadas

D27 concluiu o cadastro funcional de CLIENTE por `POST /users`, com confirmação antes de voltar ao Login e sem criar sessão. D26 forneceu bootstrap, tema e Navigator. Branch observada: `task/D28-login-sessao`; árvore limpa antes deste plano.

Fontes lidas: `apps/mobile/lib/main.dart`, `app/cupcake_app.dart`, `app/navigation/app_navigation.dart`, `core/config/api_config.dart`, `core/design/`, `features/auth/`, `pubspec.yaml`, `android/app/build.gradle.kts`, `android/app/src/main/AndroidManifest.xml`, `ios/Runner/`, testes em `apps/mobile/test/`; `apps/api/src/auth/` (controller, service, DTOs, config, guards e testes), `apps/api/src/users/users.service.ts`, `apps/api/test/auth.e2e-spec.ts`, buscas nas rotas protegidas e no schema Prisma; `docs/authentication.md`, `docs/design/mobile/auth/customer-login.md`, `customer-sign-up.md`, `docs/design/{DESIGN_SYSTEM,SCREEN_STATES,NAVIGATION}.md`, `docs/domain/DOMAIN_MODEL.md`, `docs/adr/ADR-005-mobile-foundation.md`, `.ai/{ARCHITECTURE,RULES,QUALITY,DESIGN}.md`, `docs/CUPCAKE_MOBILE_BACKLOG.md`, `.github/workflows/ci.yml`, `scripts/task-checks.json` e `apps/mobile/README.md`. Para a opção de armazenamento, documentação oficial do pacote: [flutter_secure_storage no pub.dev](https://pub.dev/packages/flutter_secure_storage).

## 2. Estado atual, escopo e limite

- Mobile: Login é `StatelessWidget` estrutural com título e botão de Cadastro, sem campos nem HTTP. Cadastro usa `HttpClient` diretamente, `ApiConfig.usersUri`, timeout de 30 s e testes de contrato/erros. `MaterialApp.home` aponta para Login; Navigator/MaterialPageRoute gerencia Cadastro. Não existe estado de sessão, armazenamento de credenciais, cliente HTTP compartilhado ou área autenticada. Tema, tokens, rolagem e padrões acessíveis de D27 são reutilizáveis.
- `ApiConfig` aceita URL base HTTPS; HTTP somente loopback em debug. URL ausente/inválida não envia request. D28 precisa de URIs de auth com a mesma política, sem mudar `POST /users`.
- D28: formulário e login CLIENTE, tokens, restauração, refresh, expiração, logout local e transições de navegação. D27 continua responsável apenas por cadastro. Não incluir catálogo/vitrine D29, carrinho, social login, biometria, recuperação de senha, endpoints novos, nem fluxo ADMIN/ENTREGADOR.
- O backlog versionado ainda mostra D26/D27 como `[ ]`, embora o contexto fornecido informe D27 concluída. Corrigir rastreabilidade no processo próprio, sem alterar backlog neste PLAN.

## 3. Contrato real da API

| Operação | Código e testes | Consequência Mobile |
| --- | --- | --- |
| Login | `POST /auth/login`, JSON `{email, senha}`, 200 com **somente** `{accessToken, refreshToken}`. DTO exige e-mail válido e senha string não vazia; rejeita propriedades extras com 400. E-mail recebe `trim().toLowerCase()`; senha é comparada por Argon2id sem `trim`. | Validar presença/formato; normalizar e-mail; preservar senha literalmente; aceitar sucesso só com dois tokens estruturalmente válidos. Não esperar usuário/perfil no corpo. |
| Login rejeitado | Usuário ausente, senha errada e bloqueio retornam o mesmo `401 Credenciais inválidas.`. O quinto erro bloqueia por 15 min, mas 401 não informa bloqueio nem prazo. Falha interna pode retornar 500. | Mensagem neutra para 401; 400 para payload inválido; 403 não é resposta de login prevista; transporte/5xx como erro técnico. Não alegar bloqueio detectado nem travar localmente por duração inventada. |
| Perfis | O endpoint autentica CLIENTE, ADMIN e ENTREGADOR; perfil vem do banco. Tokens JWT HS256 contêm `sub` UUID, `perfil`, `type`, `iat`, `exp`. | Mobile de cliente só aceita `perfil=CLIENTE` após resposta de auth; rejeitar sessão de outro perfil sem expor tokens. JWT decodificado localmente fornece indícios, não verificação criptográfica. |
| Refresh | `POST /auth/refresh`, JSON `{refreshToken}`, 200 com **somente** novo `{accessToken}`; 400 para corpo inválido; 401 para assinatura/tipo/claims/expiração inválidos, usuário ausente ou perfil alterado. | Refresh usa token no corpo, sem Bearer/cookie. Manter refresh original no armazenamento; validar novo access antes de substituir. 401 encerra sessão; transporte/5xx conserva credenciais e indica falha temporária, sem afirmar expiração. |
| Access protegido | `Authorization: Bearer <accessToken>`; guard exige JWT access válido, usuário existente e perfil atual correspondente. Ausência/invalidez/expiração: 401. Role incompatível: 403. | Não usar refresh como access, nem tratar 403 como expiração. Hoje não há rota protegida de CLIENTE para consumir na D28. |
| Logout | Nenhuma rota `auth/logout`, blacklist, revogação ou sessão persistida no Backend foi encontrada. | Limpeza local encerra acesso neste dispositivo; o refresh permanece tecnicamente utilizável até expirar, a menos que usuário/perfil deixe de ser válido. Não prometer revogação remota. |

`apps/api/src/auth/auth.config.ts` fixa access em **15 min** e refresh em **7 dias**. Testes e2e confirmam TTLs de 900/604800 s, claims, 400/401, e refresh sem rotação. Documentação de auth corresponde ao contrato principal; a tela de design descreve estado de bloqueio distinguível, mas o Backend responde 401 genérico, então esse estado não pode ser exibido com certeza. `docs/design/NAVIGATION.md` aponta login → storefront, porém storefront é D29 e ainda não existe.

## 4. Decisões arquiteturais, segurança e dependência

1. Usar um controlador de sessão de escopo do app (por exemplo `ChangeNotifier`/`ValueNotifier` + composição explícita no `CupcakeApp`), com estados `restaurando`, `público`, `autenticado` e `falha temporária de restauração`. Login/refresh/logout centralizados nele; UI não lê armazenamento ou JWT. Navigator existente continua para Login/Cadastro; troca da raiz por estado autenticado deve remover rotas públicas da pilha. Sem Riverpod/Bloc/Provider: nenhuma dessas dependências existe e o fluxo atual não as exige.
2. Criar cliente de auth pequeno com `HttpClient` injetável e configuração existente. Reutilizar a política de URL e padrões úteis de tratamento de status da D27, sem fundir login ao `CustomerRegistrationApi` nem duplicar a semântica de cadastro indeterminado. Sem interceptor global ou retry genérico: a D28 não possui request protegido de CLIENTE. Access fica disponível ao futuro cliente protegido, que deverá aplicar Bearer apenas em rota protegida. Se uma rota protegida entrar no escopo posteriormente, 401 poderá iniciar **um** refresh compartilhado e **uma** repetição da operação original; nunca repetir refresh/login nem fazer loop, e mutação só pode ser repetida se sua semântica for segura. Essa política fica especificada, sem camada especulativa agora.
3. Persistir par access/refresh em **um registro** de armazenamento seguro, sem senha, perfil público ou expiração redundante. Manter cópia em memória durante a execução. Decodificar `exp`, `type` e `perfil` apenas como verificação de formato e temporização; nunca considerar payload decodificado prova de assinatura. HTTPS é obrigatório fora de loopback debug; não logar body, Authorization, tokens nem senha. Em logout/401 definitivo, limpar registro e memória; se limpeza falhar, não afirmar logout completo: ocultar a área, tentar limpar novamente e apresentar erro seguro.
4. Dependência proposta: `flutter_secure_storage` para Android Keystore e iOS Keychain. Resolve persistência de credenciais entre reinícios; preferência simples, arquivo local ou memória pura não oferecem simultaneamente proteção e restauração. Custo: plugin nativo, configuração/compatibilidade Android/iOS e mocks em testes. Avaliar versão compatível com SDK Flutter do projeto no EXEC e fixar via `pubspec.lock`; o pacote informa Android mínimo API 23 e recomenda excluir seus dados de backup Android para evitar restauração sem chave. Verificar `flutter.minSdkVersion` efetivo, configuração iOS e ciclo de backup antes de integrar; preferir Keychain acessível com dispositivo desbloqueado, sem biometria extra. Testes devem injetar armazenamento falso. Nenhuma outra dependência proposta.

## 5. Fluxos de sessão, restauração, refresh e expiração

| Evento | Transição planejada |
| --- | --- |
| Inicialização | Exibir estado `restaurando` sem área protegida e sem flicker de Login. Sem credenciais, ir ao Login. Registro parcial/corrompido ou refresh localmente expirado: limpar e ir ao Login. |
| Credenciais recuperáveis | Enviar refresh no início, mesmo se o access local ainda aparentar validade: não existe endpoint protegido de CLIENTE para confirmar usuário/perfil e o app não tem chave para validar assinatura JWT. Com 200 e access CLIENTE estruturalmente coerente, atualizar registro e entrar na área autenticada. O access anterior não é necessário para a chamada. |
| Falha no refresh inicial | 401/400 definitivo: limpar e Login, com aviso de sessão encerrada quando aplicável. Erro de transporte/5xx: manter registro, exibir estado seguro de restauração com ação explícita de tentar novamente ou sair; não mostrar área autenticada nem declarar sessão expirada. |
| Login | Campos idle/preenchidos; botão habilitado apenas quando formulário apto; loading impede envios simultâneos. 200 válido com perfil CLIENTE e persistência bem-sucedida → área autenticada. Corpo ausente/inválido ou falha de armazenamento → não autenticar; limpar eventual gravação parcial. 400/401/5xx/transporte permanecem no Login com mensagens adequadas. |
| Access prestes a expirar/expirado | Usar `exp` como indício local para renovar antes de qualquer uso protegido; refresh valida remotamente. Após o finding D28-QG-01, agendar uma verificação pontual enquanto a sessão estiver autenticada e o app em foreground, além da restauração e do retorno do app. Cancelar a verificação ao sair desse estado; sem polling. 401 de refresh → sessão encerrada; falha técnica → estado temporário sem afirmar invalidez. |
| Logout | Bloquear novas ações, descartar estado em memória, remover registro seguro e voltar ao Login sem pilha autenticada; mensagem não promete revogação. Operação idempotente; resposta tardia de login/refresh não pode restaurar sessão após logout. |

Evitar refresh simultâneo por uma `Future` em andamento compartilhada no controlador quando duas operações de sessão o solicitarem. Não há, no escopo D28, fan-out de requests protegidos nem replay de 401; não criar fila/interceptor para caso futuro. `401` após refresh é definitivo; `403` de eventual rota protegida significa autorização negada, não gatilho automático de logout. Não armazenar senha nem token em UI/test fixtures reais.

## 6. Navegação, design, acessibilidade e responsividade

Login é raiz pública; Cadastro continua como rota pública existente e seu sucesso volta à mesma instância do Login. Após login/restauração, mostrar uma **tela mínima de sessão de cliente** com estado autenticado e ação `Sair`, sem catálogo, produtos ou links futuros. É necessária para tornar login/logout/navegação verificáveis antes da D29. Após logout/expiração, raiz pública sem retorno por botão Voltar à área protegida. Refresh bem-sucedido não navega se a pessoa já está autenticada.

Login deve ter e-mail, senha, mostrar/ocultar, rótulos persistentes e erros associados; foco/semântica de loading, erro e saída; mensagem neutra para 401. Bloqueio específico fica fora enquanto API não o distinguir. Estados necessários: idle, preenchido, loading, credencial rejeitada, erro técnico, restauração, autenticado, sessão encerrada e logout. Validar 320/390/430 dp, teclado aberto, texto ampliado, loading e mensagens extensas. Aplicar contraste do Design System (4,5:1 texto comum, 3:1 grande) e alvos de pelo menos 44×44 dp. Não alegar teste em dispositivo físico nesta fase.

## 7. Testes e regressão previstos para EXEC/TEST

| Área | Casos objetivos |
| --- | --- |
| Login API/UI | POST exato, e-mail normalizado, senha preservada, dois tokens, perfil CLIENTE, 400, 401 genérico inclusive bloqueio, 5xx, transporte, corpo inválido, URL inválida, loading e toque duplo. 403 apenas como resposta inesperada segura; não presumir contrato de login 403. |
| Armazenamento/tokens | gravação e leitura do par, ausência, corrupção/parcial, falha de plugin, limpeza, claims `exp/type/perfil`, access expirado, refresh expirado; sem senha/token em logs ou UI. |
| Refresh/sessão | 200 só access mantendo refresh, 400/401 invalidando, expirado, transporte/5xx sem perda indevida, restauração após reinício, uma chamada compartilhada em concorrência, resposta tardia após logout, nenhuma tentativa em loop. Sem teste de replay de request protegido inexistente. |
| Navegação/a11y | Login → sessão, logout/expiração → Login sem back, reinício com/sem credenciais, Cadastro → Login inalterado; foco, semântica, larguras e teclado/texto ampliado. |

Preservar os testes existentes de bootstrap, navegação, cadastro HTTP/validação e acessibilidade D26/D27. Não alterar `POST /users`, sua semântica de sucesso/erro, nem a configuração de URL para cadastro. CI já executa `dart format`, `flutter analyze`, `flutter test`; `scripts/task-checks.json` lista os mesmos checks mobile mais `git diff --check`. Se o plugin exigir ajuste nativo, inspecionar compatibilidade Android/iOS no EXEC. A CI Linux não comprova runtime de Keychain/Keystore: validação em emuladores/dispositivos deve ser evidência separada na fase TEST, sem afirmar que ocorreu agora. Nenhum ajuste de CI planejado.

## 8. Arquivos previstos

- **Criar, se necessários no EXEC:** `apps/mobile/lib/features/auth/data/customer_auth_api.dart`; `apps/mobile/lib/features/auth/data/session_storage.dart`; `apps/mobile/lib/features/auth/session/customer_session.dart`; `apps/mobile/lib/features/auth/presentation/customer_session_page.dart`; testes correspondentes em `apps/mobile/test/`. Não criar interfaces/camadas vazias.
- **Alterar no EXEC:** `apps/mobile/lib/core/config/api_config.dart` (URIs auth), `apps/mobile/lib/features/auth/presentation/customer_login_page.dart`, `apps/mobile/lib/app/cupcake_app.dart`, `apps/mobile/lib/app/navigation/app_navigation.dart` apenas se necessário à troca de raiz; `apps/mobile/pubspec.yaml` e lockfile; configuração Android/iOS estritamente exigida pelo plugin; testes existentes afetados; documentação mobile/auth para refletir comportamento entregue.
- **Intocados:** implementação/contrato `apps/api/` (inclusive `POST /users`), `customer_registration_api.dart`, formulário/validação de cadastro salvo adaptação comprovadamente necessária, código de catálogo/carrinho D29+, Admin, migrations e CI. Este PLAN só cria `PLAN.md`.

## 9. Riscos, mitigação e lacunas

| Risco/lacuna real | Impacto | Mitigação/decisão |
| --- | --- | --- |
| Design prevê bloqueio distinguível; API usa 401 indistinguível | Mensagem específica seria falsa | Mostrar rejeição neutra; mudança de contrato Backend exige tarefa própria. |
| Tokens retornam sem perfil público; JWT local não tem assinatura verificável | Confiança indevida em claim local | Exigir resposta HTTPS, validar estrutura/CLIENTE e confirmar refresh na restauração; Backend segue autoridade de autorização. |
| Nenhuma rota protegida de CLIENTE agora | Não há request de negócio para demonstrar Bearer ou 401/replay | Conservar access na sessão; deferir interceptor e replay até existir consumidor real. Aceite D28 não exige chamada protegida inventada. |
| Sem revogação/logout servidor | Refresh ainda válido após limpeza local | Comunicar logout local; não prometer invalidação em outros dispositivos. Revogação remota depende de futuro contrato Backend. |
| Expiração/relógio do aparelho | `exp` local pode divergir | Usar margem pequena para decidir refresh; 401 Backend decide invalidez; não confiar só no relógio local. |
| Falha/reinstalação/backup no armazenamento seguro Android/iOS | Restauração ou limpeza pode falhar | Registro único, teste de falha/corrupção, revisão da configuração de backup e Keychain; falha segura sem entrar na área. |
| Refresh simultâneo e resposta tardia | Tokens/estado obsoletos podem sobrescrever logout | Uma Future compartilhada e geração da sessão para descartar resposta antiga. |
| URL API ausente/HTTP indevido | Envio inseguro ou Login inoperante | Herdar `ApiConfig`, erro controlado e documentação de `API_BASE_URL`. |
| Backlog D26/D27 desatualizado versus relato da tarefa | Rastreabilidade divergente | Registrar achado; atualizar apenas no fluxo de encerramento autorizado, sem mexer nesta PLAN. |

Não há lacuna bloqueante para planejar a D28. Ainda é necessária validação de versão/configuração nativa do plugin no EXEC; não fixa versão sem resolver compatibilidade no ambiente do projeto.

## 10. Critérios de aceite

1. Credenciais válidas de CLIENTE autenticam só após 200 com tokens válidos e persistência; inválidas/400/401/erro técnico não autenticam; loading impede concorrência; senha preservada e nunca persistida.
2. Tokens são armazenados de forma apropriada, não aparecem em logs/UI; refresh usa o token correto no corpo, emite novo access sem rotação, e 401/expiração definitivos limpam a sessão. Falha técnica de refresh não é descrita como credencial inválida.
3. Sessão restaura após reinício via refresh válido; sem credenciais ou com refresh inválido retorna ao Login; logout limpa estado local e não permite voltar por pilha. Não há loops nem retries de mutação.
4. Somente CLIENTE entra no destino autenticado mínimo; ADMIN/ENTREGADOR não entram no fluxo do cliente; 403 não é tratado como expiração.
5. Login/Cadastro, tema, acessibilidade, 320/390/430 dp e regressão D26/D27 permanecem íntegros; nenhuma função D29+ é criada.
6. Checks mobile de CI passam na fase adequada; limitações de validação nativa são reportadas honestamente.

## 11. Plano EXEC em etapas pequenas

1. Confirmar versão compatível do armazenamento seguro com Flutter/Android/iOS, ajustar somente a configuração nativa necessária e estabelecer armazenamento injetável com testes de falha/limpeza.
2. Acrescentar URIs auth à política existente e implementar cliente login/refresh com mapeamento de status, timeout e parsing rigoroso; testar contrato de rede.
3. Implementar controlador de sessão, persistência do par, restauração via refresh, expiração, deduplicação e proteção contra respostas tardias; testar transições.
4. Tornar Login funcional e acessível, conectar à raiz de navegação e criar tela autenticada mínima com logout; testar navegação/responsividade.
5. Atualizar documentação afetada; executar TEST, FIX se necessário, reteste, REVIEW e QUALITY GATE somente nas fases posteriores autorizadas. Verificar regressão e CI antes de qualquer encerramento de D28.

## 12. Evidências e handoff

As evidências de contrato são `auth.controller.ts`, `auth.service.ts`, `auth.config.ts`, DTOs/guards e `auth.e2e-spec.ts`; as de estado Mobile são `cupcake_app.dart`, `customer_login_page.dart`, `customer_registration_api.dart` e testes existentes. As diferenças entre design e API estão explicitadas acima. **Pronto para aprovação humana do PLAN e posterior EXEC.**
