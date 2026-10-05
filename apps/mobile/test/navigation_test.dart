import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'session_test_support.dart';

void main() {
  testWidgets('Login abre Cadastro e Entrar retorna à entrada', (tester) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();
    expect(find.text('Crie sua conta para começar.'), findsOneWidget);

    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
  });

  testWidgets('voltar do Cadastro retorna ao Login sem pilha extra', (
    tester,
  ) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Voltar para Entrar'));
    await tester.pumpAndSettle();

    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
    expect(
      tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
      isFalse,
    );
  });
}
