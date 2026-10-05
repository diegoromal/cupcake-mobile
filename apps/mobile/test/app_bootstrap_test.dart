import 'package:flutter_test/flutter_test.dart';
import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'session_test_support.dart';

void main() {
  testWidgets('inicia no Login em português do Brasil', (tester) async {
    await tester.pumpWidget(CupcakeApp(session: createCustomerSession()));
    await pumpUntilSessionReady(tester);

    expect(find.text('Entrar'), findsNWidgets(2));
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
  });
}
