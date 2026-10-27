# Detalhe da Entrega — Entregador

## Metadados

- **ID:** `mobile.courier.delivery-detail`
- **Versão:** `v1`
- **Status:** referência documentada
- **Perfil:** ENTREGADOR autenticado e responsável pelo pedido
- **HU relacionadas:** HU-19 e HU-20
- **Viewport-base:** 390 dp
- **Referência visual:** `delivery-detail.png`

## Objetivo

Apresentar os dados necessários para a entrega atribuída e permitir que o
entregador responsável confirme a conclusão quando o pedido estiver em
`SAIU_PARA_ENTREGA`.

## Conteúdo

O detalhe pode apresentar somente os campos efetivamente retornados pelo
contrato atual:

- identificador de negócio do pedido;
- nome e telefone do cliente;
- endereço de entrega (logradouro, número, bairro, cidade, CEP, complemento e
  referência, quando preenchidos);
- horário de saída para entrega, se disponível;
- status recebido/atualizado no fluxo;
- horário de confirmação da entrega, após resposta confirmada.

Não incluir itens, valores, localização, mapas ou dados pessoais adicionais.
Os dados concretos na imagem são demonstrativos.

## Confirmação

Quando o status é `SAIU_PARA_ENTREGA`, apresentar `Confirmar entrega`.
Exigir ação explícita, bloquear envio duplicado enquanto a chamada estiver em
andamento e só apresentar sucesso depois da confirmação do backend. Após
sucesso, apresentar `Entregue` e o horário retornado, se disponível.

Em conflito ou resultado indeterminado, não repetir automaticamente a mutação:
verificar o status e apresentar uma ação de verificação. Se continuar
`SAIU_PARA_ENTREGA`, a nova tentativa pode ser oferecida; se já estiver
`ENTREGUE`, confirmar o estado sem reenviar.

Não definir prova obrigatória (foto, assinatura, OTP, geolocalização ou
biometria), pois não há requisito correspondente.

## Estados

- **Loading:** indicar carregamento do detalhe.
- **Erro recuperável/configuração ausente:** explicar a falha e oferecer nova
  tentativa quando disponível.
- **Não encontrado:** informar que a entrega não foi encontrada.
- **Acesso negado (`403`):** informar que o entregador não tem acesso àquela
  entrega; não mostrar seus dados.
- **Sessão expirada (`401`):** encerrar sessão e retornar ao fluxo de login.
- **Confirmando:** indicar processamento e desabilitar nova submissão.
- **Resultado desconhecido/conflito:** informar que o estado está sendo
  verificado; não afirmar sucesso ou falha antes de consultar.
- **Entregue:** mostrar o estado confirmado e o horário retornado, quando
  houver; ocultar a ação de confirmação.

Mensagens devem ser textuais e anunciáveis; não comunicar status somente pela
cor.

## Navegação

`delivery-list` → `delivery-detail` → retorno à lista atualizada.

Voltar não altera o pedido. A confirmação só está disponível para o entregador
responsável e no estado elegível definido pelo domínio.
