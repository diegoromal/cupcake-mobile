import 'dart:async';
import 'dart:ui' show Tristate;

import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_registration_api.dart';
import 'package:cupcake_mobile/features/auth/presentation/customer_sign_up_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'session_test_support.dart';

class _FakeApi extends CustomerRegistrationApi {
  _FakeApi() : super(config: ApiConfig(baseUrl: 'https://example.test'));

  final completer = Completer<RegistrationResult>();
  int calls = 0;
  String? sentPassword;
  String? sentEmail;

  @override
  Future<RegistrationResult> register({
    required String nome,
    required String email,
    required String telefone,
    required String senha,
  }) {
    calls++;
    sentPassword = senha;
    sentEmail = email;
    return completer.future;
  }
}

Future<void> _fill(WidgetTester tester) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(0), 'Ana');
  await tester.enterText(fields.at(1), 'ANA@example.com');
  await tester.enterText(fields.at(2), 'sem formato');
  await tester.enterText(fields.at(3), '  123456 ');
  await tester.testTextInput.receiveAction(TextInputAction.done);
  await tester.pump();
}

void main() {
  testWidgets('submissão inválida pelo CTA foca o resumo e não envia request', (
    tester,
  ) async {
    final api = _FakeApi();
    await tester.pumpWidget(
      MaterialApp(home: CustomerSignUpPage(registrationApi: api)),
    );

    final button = find.widgetWithText(FilledButton, 'Criar conta');
    expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
    await tester.tap(button);
    await tester.pumpAndSettle();

    const summary = 'Confira os campos indicados.';
    expect(api.calls, 0);
    expect(find.text(summary), findsOneWidget);
    expect(find.text('Informe seu nome.'), findsOneWidget);
    expect(find.text('Informe seu e-mail.'), findsOneWidget);
    expect(
      tester
          .getSemantics(find.text(summary))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isTrue,
    );
    expect(
      tester
          .getSemantics(find.text(summary))
          .getSemanticsData()
          .flagsCollection
          .isLiveRegion,
      isTrue,
    );
    final summaryRect = tester.getRect(find.text(summary));
    expect(
      summaryRect.overlaps(Offset.zero & tester.view.physicalSize),
      isTrue,
    );

    await tester.ensureVisible(find.byType(TextFormField).first);
    await tester.enterText(find.byType(TextFormField).first, 'Ana');
    await tester.pump();
    expect(
      tester
          .getSemantics(find.text(summary))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isFalse,
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'ana@example.com');
    await tester.enterText(find.byType(TextFormField).at(2), 'telefone');
    await tester.ensureVisible(find.byType(TextFormField).last);
    await tester.enterText(find.byType(TextFormField).last, '12345678');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    expect(api.calls, 1);
  });

  testWidgets('estado inicial, campos acessíveis e senha mostrar/ocultar', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: CustomerSignUpPage()));
    expect(find.text('Criar conta'), findsNWidgets(2));
    expect(find.text('Nome *'), findsOneWidget);
    expect(find.text('E-mail *'), findsOneWidget);
    expect(find.text('Telefone *'), findsOneWidget);
    expect(find.text('Senha *'), findsOneWidget);
    expect(find.text('Informe seu nome.'), findsNothing);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNotNull,
    );
    expect(find.byTooltip('Mostrar senha'), findsOneWidget);
    await tester.tap(find.byTooltip('Mostrar senha'));
    await tester.pump();
    expect(find.byTooltip('Ocultar senha'), findsOneWidget);
  });

  testWidgets(
    'bloqueia clique duplo enquanto envia e descarta senha no sucesso',
    (tester) async {
      final api = _FakeApi();
      await tester.pumpWidget(
        CupcakeApp(registrationApi: api, session: createCustomerSession()),
      );
      await pumpUntilSessionReady(tester);
      await tester.tap(find.text('Criar conta').first);
      await tester.pumpAndSettle();
      await _fill(tester);
      expect(api.calls, 1);
      expect(api.sentEmail, 'ana@example.com');
      expect(api.sentPassword, '  123456 ');
      expect(find.text('Criando conta…'), findsOneWidget);
      expect(find.text('Confira os campos indicados.'), findsNothing);
      expect(
        tester
            .getSemantics(find.text('Criando conta…'))
            .getSemanticsData()
            .flagsCollection
            .isLiveRegion,
        isTrue,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton).last).onPressed,
        isNull,
      );
      expect(
        find
            .byType(TextFormField)
            .evaluate()
            .map((element) => element.widget as TextFormField)
            .every((field) => !field.enabled),
        isTrue,
      );
      await tester.tap(find.byType(FilledButton).last, warnIfMissed: false);
      await tester.pump();
      expect(api.calls, 1);

      api.completer.complete(
        const RegistrationResult(RegistrationStatus.created),
      );
      await tester.pumpAndSettle();
      expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
      expect(
        find.text('Cadastro confirmado. Entre para continuar.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Criar conta').first);
      await tester.pumpAndSettle();
      expect(find.byType(CustomerSignUpPage), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).last)
            .controller!
            .text,
        isEmpty,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('erro recuperável mantém dados e permite Entrar', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(
      CupcakeApp(registrationApi: api, session: createCustomerSession()),
    );
    await pumpUntilSessionReady(tester);
    await tester.tap(find.text('Criar conta').first);
    await tester.pumpAndSettle();
    await _fill(tester);
    api.completer.complete(
      const RegistrationResult(RegistrationStatus.conflict),
    );
    await tester.pumpAndSettle();
    expect(find.text('E-mail já cadastrado.'), findsWidgets);
    expect(
      tester
          .widget<TextFormField>(find.byType(TextFormField).at(1))
          .controller!
          .text,
      'ANA@example.com',
    );
    await tester.ensureVisible(find.text('Entrar').last);
    await tester.tap(find.text('Entrar').last);
    await tester.pumpAndSettle();
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
  });

  testWidgets('400 associa erro reconhecido sem limpar o formulário', (
    tester,
  ) async {
    final api = _FakeApi();
    await tester.pumpWidget(
      CupcakeApp(registrationApi: api, session: createCustomerSession()),
    );
    await pumpUntilSessionReady(tester);
    await tester.tap(find.text('Criar conta').first);
    await tester.pumpAndSettle();
    await _fill(tester);
    api.completer.complete(
      const RegistrationResult(
        RegistrationStatus.validation,
        fieldErrors: {'email': 'Informe um e-mail válido.'},
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Informe um e-mail válido.'), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byType(TextFormField).at(1))
          .controller!
          .text,
      'ANA@example.com',
    );
    expect(find.text('Confira os campos indicados.'), findsOneWidget);
    expect(
      tester
          .getSemantics(find.text('Confira os campos indicados.'))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isTrue,
    );
  });

  testWidgets('senha curta submetida pelo teclado é rejeitada sem request', (
    tester,
  ) async {
    final api = _FakeApi();
    await tester.pumpWidget(
      MaterialApp(home: CustomerSignUpPage(registrationApi: api)),
    );
    await tester.enterText(find.byType(TextFormField).first, 'Ana');
    await tester.enterText(find.byType(TextFormField).at(1), 'ana@example.com');
    await tester.enterText(find.byType(TextFormField).at(2), 'telefone');
    await tester.ensureVisible(find.byType(TextFormField).last);
    await tester.enterText(find.byType(TextFormField).last, '1234567');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(api.calls, 0);
    expect(find.text('Confira os campos indicados.'), findsOneWidget);
    expect(
      tester
          .getSemantics(find.text('Confira os campos indicados.'))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isTrue,
    );
    expect(
      find.text('A senha deve ter pelo menos 8 caracteres.'),
      findsOneWidget,
    );
    await tester.enterText(find.byType(TextFormField).last, '12345678');
    await tester.pump();
    expect(
      tester
          .getSemantics(find.text('Confira os campos indicados.'))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isFalse,
    );
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(api.calls, 1);
  });

  testWidgets(
    'resultado indeterminado preserva formulário sem sugerir retry cego',
    (tester) async {
      final api = _FakeApi();
      await tester.pumpWidget(
        MaterialApp(home: CustomerSignUpPage(registrationApi: api)),
      );
      await _fill(tester);
      api.completer.complete(
        const RegistrationResult(RegistrationStatus.indeterminate),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Não foi possível confirmar se o cadastro foi concluído. Verifique sua conexão e, antes de tentar novamente, confirme se o e-mail já foi cadastrado.',
        ),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(0))
            .controller!
            .text,
        'Ana',
      );
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).last)
            .controller!
            .text,
        '  123456 ',
      );
      expect(api.calls, 1);
    },
  );

  testWidgets('resposta tardia após encerrar a tela não altera o contexto', (
    tester,
  ) async {
    final api = _FakeApi();
    await tester.pumpWidget(
      CupcakeApp(registrationApi: api, session: createCustomerSession()),
    );
    await pumpUntilSessionReady(tester);
    await tester.tap(find.text('Criar conta').first);
    await tester.pumpAndSettle();
    await _fill(tester);
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: Text('Tela substituta'))),
    );
    api.completer.complete(
      const RegistrationResult(RegistrationStatus.created),
    );
    await tester.pumpAndSettle();
    expect(find.text('Tela substituta'), findsOneWidget);
    expect(
      find.text('Cadastro confirmado. Entre para continuar.'),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('cadastro rola sem overflow nas larguras previstas', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final width in [320.0, 390.0, 430.0]) {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(const MaterialApp(home: CustomerSignUpPage()));
      await tester.pump();
      expect(tester.takeException(), isNull, reason: 'largura $width dp');
    }
  });

  testWidgets('texto ampliado e teclado aberto mantêm ações roláveis', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: const CustomerSignUpPage(),
      ),
    );
    await tester.pump();
    await tester.ensureVisible(find.text('Entrar').last);
    expect(tester.takeException(), isNull);
    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets(
    'loading acessível permanece rolável com texto ampliado em 320 dp',
    (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      final api = _FakeApi();
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: CustomerSignUpPage(registrationApi: api),
        ),
      );

      await tester.enterText(find.byType(TextFormField).at(0), 'Ana');
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'ana@example.com',
      );
      await tester.enterText(find.byType(TextFormField).at(2), 'telefone');
      await tester.enterText(find.byType(TextFormField).last, '12345678');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(api.calls, 1);
      expect(find.text('Criando conta…'), findsOneWidget);
      expect(
        tester
            .getSemantics(find.text('Criando conta…'))
            .getSemanticsData()
            .flagsCollection
            .isLiveRegion,
        isTrue,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton).last).onPressed,
        isNull,
      );
      await tester.tap(find.byType(FilledButton).last, warnIfMissed: false);
      await tester.pump();
      expect(api.calls, 1);

      await tester.ensureVisible(find.byType(FilledButton).last);
      expect(find.text('Criando conta…'), findsOneWidget);
      expect(
        tester
            .getRect(find.byType(FilledButton).last)
            .overlaps(Offset.zero & const Size(320, 640)),
        isTrue,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'mensagem de resultado indeterminado permanece visível com teclado e texto ampliado',
    (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      final api = _FakeApi();
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: CustomerSignUpPage(registrationApi: api),
        ),
      );
      await tester.enterText(find.byType(TextFormField).at(0), 'Ana');
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'ana@example.com',
      );
      await tester.enterText(find.byType(TextFormField).at(2), 'telefone');
      await tester.ensureVisible(find.byType(TextFormField).last);
      await tester.enterText(find.byType(TextFormField).last, '12345678');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      api.completer.complete(
        const RegistrationResult(RegistrationStatus.indeterminate),
      );
      await tester.pumpAndSettle();
      const message =
          'Não foi possível confirmar se o cadastro foi concluído. Verifique sua conexão e, antes de tentar novamente, confirme se o e-mail já foi cadastrado.';
      expect(find.text(message), findsOneWidget);
      expect(
        tester
            .getSemantics(find.text(message))
            .getSemanticsData()
            .flagsCollection
            .isFocused,
        Tristate.isTrue,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
