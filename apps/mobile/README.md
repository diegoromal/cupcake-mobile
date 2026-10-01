# Cupcake Mobile

Fundação Flutter do aplicativo móvel de Cliente e Entregador.

## Executar

Com Flutter instalado, a partir deste diretório:

```bash
flutter pub get
flutter run
```

## Estrutura

- `lib/main.dart`: inicialização do Flutter.
- `lib/app/`: configuração do app e navegação.
- `lib/core/design/`: tokens e tema inicial.
- `lib/features/auth/presentation/`: telas estruturais de Login e Cadastro.
- `test/`: testes de bootstrap, navegação e acessibilidade básica.

## Validação

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

## Continuidade

`CupcakeApp` concentra tema, localização pt-BR e tela inicial. `AppNavigation`
mantém apenas o fluxo público inicial Login → Cadastro → Login, usando o
Navigator do Flutter. O tema usa tokens semânticos mínimos derivados do Design
System documentado.

## Limites da D26

Login e Cadastro são estruturais e não enviam dados. Não há formulário
funcional, autenticação, sessão, rede, persistência ou navegação autenticada.
Esses comportamentos pertencem às tarefas posteriores.
