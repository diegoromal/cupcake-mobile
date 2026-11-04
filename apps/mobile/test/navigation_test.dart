import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'session_test_support.dart';

void main() {
  testWidgets('Login abre Cadastro e Entrar retorna à entrada', (tester) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    await tester.ensureVisible(find.text('Criar conta'));
    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Preencha seus dados para criar sua conta e fazer pedidos no Cupcake Mobile.',
      ),
      findsOneWidget,
    );

    final enterButton = find.widgetWithText(TextButton, 'Entrar');
    await tester.ensureVisible(enterButton);
    await tester.pumpAndSettle();
    await tester.tap(enterButton);
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Acesse sua conta para continuar e fazer pedidos no Cupcake Mobile.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('voltar do Cadastro retorna ao Login sem pilha extra', (
    tester,
  ) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    await tester.ensureVisible(find.text('Criar conta'));
    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Voltar para Entrar'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Acesse sua conta para continuar e fazer pedidos no Cupcake Mobile.',
      ),
      findsOneWidget,
    );
    expect(
      tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
      isFalse,
    );
  });

  testWidgets('acesso do entregador continua abrindo o login ENTREGADOR', (
    tester,
  ) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    await tester.tap(find.text('Acesso do entregador'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(
      tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
      isTrue,
    );
  });
}
