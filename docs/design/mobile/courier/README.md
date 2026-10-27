# Entregador — Referências de UX/UI

## Metadados

- **Perfil:** ENTREGADOR
- **Relação com HU:** HU-19 e HU-20
- **Viewport-base:** 390 dp
- **Escopo:** lista de entregas atribuídas, detalhe e confirmação de entrega
- **Base funcional:** fluxo Flutter em `apps/mobile/lib/features/courier/`

## Referências

| ID | Arquivo | Função |
|---|---|---|
| `mobile.courier.delivery-list` | [`delivery-list.md`](delivery-list.md) + [`delivery-list.png`](delivery-list.png) | Lista de entregas atribuídas |
| `mobile.courier.delivery-detail` | [`delivery-detail.md`](delivery-detail.md) + [`delivery-detail.png`](delivery-detail.png) | Dados mínimos e confirmação de uma entrega |

Os identificadores, nome, telefone, endereço e horários mostrados nos PNGs são
dados demonstrativos. O Markdown define o conteúdo permitido e os estados; os
valores visuais não são dados reais nem regras de domínio.

## Fluxo

```text
Login ENTREGADOR
→ delivery-list
→ delivery-detail
→ confirmação explícita de entrega
→ retorno à lista e atualização
```

A lista contém pedidos atribuídos ao entregador autenticado conforme a resposta
do backend. Somente o entregador responsável pode confirmar `ENTREGUE`, e a
ação só é exibida enquanto o status é `SAIU_PARA_ENTREGA`.

## Limites

As referências não adicionam marketplace de corridas, aceite/rejeição,
roteirização, mapa, localização em background, ganhos, ranking, chat, prova por
foto/assinatura/OTP/biometria ou novos estados de pedido. Dados pessoais devem
se limitar ao necessário para a entrega.

## Design

- Aplicar `../../DESIGN_SYSTEM.md` e os estados de `../../SCREEN_STATES.md`.
- Base mobile de 390 dp; considerar 320 e 430 dp e texto ampliado.
- Manter status compreensível sem depender apenas de cor e alvos de toque de
  pelo menos 44×44 dp.
- A referência visual não autoriza comportamento ausente no contrato ou no app.
