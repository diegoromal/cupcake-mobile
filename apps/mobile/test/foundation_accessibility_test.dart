import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'session_test_support.dart';

void main() {
  testWidgets('ações e títulos principais têm semântica identificável', (
    tester,
  ) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    expect(find.bySemanticsLabel('Criar conta'), findsOneWidget);
    expect(find.bySemanticsLabel('Entrar'), findsNWidgets(2));

    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Voltar para Entrar'), findsOneWidget);
    expect(find.bySemanticsLabel('Criar conta'), findsNWidgets(2));
  });

  testWidgets('Login se adapta às larguras móveis previstas', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    for (final width in [320.0, 390.0, 430.0]) {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
      await pumpUntilSessionReady(tester);
      expect(tester.takeException(), isNull, reason: 'largura $width dp');
    }
  });
}
