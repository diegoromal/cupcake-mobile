# Configuração de entrega

## Metadados

- **ID:** `admin.delivery.configuration`
- **Versão:** `v1`
- **Status:** referência D94
- **Perfil:** ADMIN
- **Rota atual:** `/configuracao-loja-entrega`
- **Origem funcional:** Configuração da Loja/Entrega no modelo de domínio e tela implementada no Admin
- **Viewport-base:** 1440 px
- **Referência visual:** `delivery-configuration.png`

## Objetivo

Permitir que o administrador consulte e atualize a localização da loja, o raio
máximo de atendimento e os parâmetros utilizados no cálculo do frete.

## Campos

A tela contém os campos definidos pelo formulário administrativo:

- Latitude da loja;
- Longitude da loja;
- Raio máximo (km);
- Taxa base (R$);
- Valor por km (R$).

Os valores demonstrados no PNG são ilustrativos e não representam a configuração
real da loja. O formulário envia os valores aceitos pelo contrato vigente; a
referência não define novos limites, precisão ou regras de validação.

## Regra de frete

Para entrega dentro da cobertura configurada, o frete segue a regra vigente:

`taxa base + (distância em km × valor por km)`

Retirada na loja possui frete zero. O raio define a cobertura máxima. A
referência não acrescenta estimativa de distância, mapa, geocodificação ou
qualquer comportamento de cálculo no painel.

## Estados

Além do formulário carregado representado no PNG, a tela contempla os estados
observáveis da implementação:

- **Carregando:** consulta da configuração em andamento;
- **Sem configuração cadastrada:** consulta retorna ausência; campos iniciam vazios;
- **Erro:** falha de consulta ou salvamento, com mensagem e possibilidade de correção/tentativa;
- **Salvando:** ação de salvar e campos ficam bloqueados contra submissão concorrente;
- **Recarregando:** consulta novamente a configuração; os campos ficam temporariamente substituídos pelos valores retornados;
- **Salvo:** confirmação somente após resposta válida da API.

Falha de consulta não deve ser apresentada como ausência de configuração. Dados
editados devem permanecer disponíveis quando o salvamento falhar. A ação
`Recarregar` consulta novamente a API e substitui os valores do formulário pela
resposta recebida.

## Acessibilidade e responsividade

- Manter labels persistentes associados aos cinco campos;
- permitir navegação por teclado e foco visível;
- associar mensagens de erro à região de feedback e anunciá-las;
- distinguir erro e sucesso por texto, além de cor;
- em telas estreitas, empilhar os campos e manter a ação de salvar acessível;
- referência desktop em 1280–1440 px; validar 768 px e 320 px quando aplicável.

## Navegação

A tela é acessada pelo item `Configuração de entrega` da navegação lateral.
Após salvar, permanece na própria página. A ordem e os demais destinos estão em
[`../NAVIGATION.md`](../NAVIGATION.md).

## Referências

- [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)
- [`../NAVIGATION.md`](../NAVIGATION.md)
- [`../SCREEN_STATES.md`](../SCREEN_STATES.md)
- [Modelo de domínio — Configuração da Loja/Entrega](../../domain/DOMAIN_MODEL.md)
