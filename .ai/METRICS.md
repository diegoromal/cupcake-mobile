# Métricas de Engenharia Assistida por IA

Use métricas para melhorar o processo, não para premiar volume.

  Métrica                            Interpretação
  ---------------------------------- ------------------------------------------
  First-pass success                 tarefa aceita sem retrabalho substancial
  Defeitos pós-merge                 qualidade após integração
  Regressões                         estabilidade
  Retrabalho por requisito ambíguo   qualidade da especificação
  Retrabalho causado pela IA         eficácia do copiloto
  Tokens por tarefa                  eficiência de contexto/prompt
  Tempo requisito -\> aceite         fluxo de entrega
  Achados relevantes no review       qualidade antes do merge

## Leitura conjunta

Economia de tokens só representa melhoria se não aumentar defeitos,
regressões ou retrabalho.

## Revisão periódica

A cada marco: 1. identificar falhas repetidas; 2. eliminar
regras/prompts redundantes; 3. promover lições recorrentes para
RULES/QUALITY/testes; 4. remover contexto que não altera decisões; 5.
comparar tokens, retrabalho e defeitos.
