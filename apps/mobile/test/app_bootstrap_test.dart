import 'package:flutter_test/flutter_test.dart';
import 'package:cupcake_mobile/app/cupcake_app.dart';

void main() {
  testWidgets('inicia no Login em português do Brasil', (tester) async {
    await tester.pumpWidget(const CupcakeApp());

    expect(find.text('Entrar'), findsOneWidget);
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
  });
}
