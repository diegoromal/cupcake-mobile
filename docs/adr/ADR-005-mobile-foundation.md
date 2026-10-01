# ADR-005 — Fundação Mobile

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto

A Fase 3 precisa de uma base Flutter para implementar progressivamente os
fluxos do aplicativo móvel.

## Decisões

- Usar Flutter conforme a stack definida.
- Organizar bootstrap, navegação, design e apresentação por feature em
  `apps/mobile/lib/`.
- Usar Navigator e MaterialPageRoute para o fluxo estrutural Login/Cadastro.
- Manter dependências mínimas, incluindo localização oficial do Flutter.
- Aplicar tema inicial com tokens semânticos do Design System.
- Não incluir sessão, rede ou persistência nesta fundação.

## Consequências

D27/D28 podem partir do bootstrap pt-BR, tema, testes e telas públicas
estruturais já organizados.

## Limites

A D26 não implementa autenticação, formulários funcionais, sessão, API,
armazenamento ou fluxos autenticados.
