# IHC — Painel de Produtos

Fluxos: login → lista → novo produto → detalhe → editar, imagem, personalizações e exclusão. A lista preserva produtos quando categorias falham e permite nova tentativa. O formulário exige categoria disponível e apresenta erros por campo. Preço é digitado como decimal com ponto, sem arredondamento. Após criar, o detalhe permite configurar imagem e personalizações. Falha posterior no upload mantém o produto criado.

A imagem existente é indicada por texto “Com imagem”. Apenas o arquivo escolhido nesta sessão tem prévia local. Upload informa “Enviando...”, sem percentual. Associações indisponíveis continuam visíveis. A exclusão exige o nome exato do produto e orienta desativação quando a API impede exclusão.

Controles possuem labels, foco visível, mensagens com `role=status` ou `role=alert`, texto além de cor e estado desabilitado durante mutações. A disposição adapta tabela e ações a telas pequenas.

## Capturas da aplicação executada

As capturas abaixo foram feitas no painel Next.js em execução com a API NestJS e registros temporários removidos após a sessão:

- [Login](screenshots/admin-login.png): acesso administrativo com e-mail e senha.
- [Lista de produtos](screenshots/admin-produtos-lista.png): produto, categoria, preço, situação, imagem e ação de abertura.
- [Novo produto](screenshots/admin-produto-novo.png): formulário de criação com categoria disponível.
- [Detalhe e edição](screenshots/admin-produto-detalhe.png): formulário preenchido, imagem, personalização vinculada e exclusão.
