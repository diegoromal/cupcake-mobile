# IHC — Categorias e personalizações no admin

Fluxos: login → lista → novo cadastro → detalhe → edição → exclusão. As três áreas do admin compartilham navegação e saída. As listas exibem estados de carregamento, vazio, erro e nova tentativa. O detalhe permite alterações parciais e exige nome exato para exclusão. Em conflito, a categoria informa vínculo com produtos; a personalização informa apenas que está em uso e permite alterar a disponibilidade.

O ajuste de valor é digitado com ponto decimal e exibido em reais. O campo vazio representa `null` e zero continua definido. Após validação inválida, o foco vai para o resumo focável e anunciável; os erros continuam associados aos campos por `aria-describedby`, e os controles inválidos mantêm `aria-invalid`. A confirmação recebe foco ao abrir e o botão anterior recupera foco ao cancelar. Todos os estados de mutação têm controles realmente desabilitados, mensagens textuais e papéis acessíveis.

## Capturas reais

Capturadas em 28/09/2026 no painel Next.js de produção em execução, com API NestJS, PostgreSQL isolado, ADMIN real e fixtures removidas após o smoke:

- [Lista de categorias](screenshots/admin-categorias-lista.png)
- [Formulário de categoria](screenshots/admin-categoria-formulario.png)
- [Lista de personalizações](screenshots/admin-personalizacoes-lista.png)
- [Formulário de personalização](screenshots/admin-personalizacao-formulario.png)
