import 'dart:async';

import 'package:cupcake_mobile/features/address/data/customer_address_api.dart';
import 'package:cupcake_mobile/features/address/presentation/customer_address_page.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const address = CustomerAddress(
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  street: 'Rua A',
  number: '12',
  neighborhood: 'Centro',
  city: 'Curitiba',
  cep: '80000000',
  complement: null,
  reference: null,
  located: false,
);

class FakeSession extends CustomerSession {
  FakeSession()
    : super(
        authApi: createCustomerSession().authApi,
        storage: MemorySessionStorage(),
      );
  @override
  bool get isAuthenticated => true;
  @override
  String? get accessToken => 'token';
  @override
  Future<void> refreshIfNeeded() async {}
  @override
  Future<String?> refreshAfterUnauthorized(String rejectedAccessToken) async {
    refreshCalls++;
    return 'new-token';
  }

  int refreshCalls = 0;
}

class FakeAddressApi extends CustomerAddressApi {
  List<CustomerAddress> addresses = [];
  AddressStatus? createStatus;
  AddressStatus? geoStatus;
  AddressStatus? listStatus;
  Completer<AddressResult<CustomerAddress>>? createGate;
  Completer<AddressResult<CepData>>? lookupGate;
  CepData lookupData = const CepData('Rua A', 'Centro', 'Curitiba', 'PR');
  int createCalls = 0, geoCalls = 0;
  @override
  Future<AddressResult<List<CustomerAddress>>> list(String token) async =>
      listStatus == null
      ? AddressResult(AddressStatus.success, value: addresses)
      : AddressResult(listStatus!);
  @override
  Future<AddressResult<CepData>> lookupCep(String token, String cep) async {
    lookedUpCep = cep;
    if (lookupGate != null) return lookupGate!.future;
    return AddressResult(AddressStatus.success, value: lookupData);
  }

  String? lookedUpCep;
  @override
  Future<AddressResult<CustomerAddress>> create(
    String token,
    Map<String, Object?> body,
  ) async {
    createCalls++;
    if (createGate != null) return createGate!.future;
    if (createStatus != null && createStatus != AddressStatus.success) {
      return AddressResult(createStatus!);
    }
    addresses = [address];
    return const AddressResult(AddressStatus.success, value: address);
  }

  @override
  Future<AddressResult<void>> geocode(String token, String id) async {
    geoCalls++;
    if (geoStatus != null && geoStatus != AddressStatus.success) {
      return AddressResult(geoStatus!);
    }
    addresses = [
      const CustomerAddress(
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        street: 'Rua A',
        number: '12',
        neighborhood: 'Centro',
        city: 'Curitiba',
        cep: '80000000',
        complement: null,
        reference: null,
        located: true,
      ),
    ];
    return const AddressResult(AddressStatus.success);
  }
}

Future<void> showPage(
  WidgetTester tester,
  FakeAddressApi api, {
  Size size = const Size(390, 844),
  double scale = 1,
  FakeSession? session,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.view.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(() => tester.view.resetPhysicalSize());
  addTearDown(() => tester.view.resetDevicePixelRatio());
  addTearDown(
    () => tester.view.platformDispatcher.clearTextScaleFactorTestValue(),
  );
  await tester.pumpWidget(
    MaterialApp(
      home: CustomerAddressPage(session: session ?? FakeSession(), api: api),
    ),
  );
  await tester.pump();
}

Future<void> fillAddress(WidgetTester tester) async {
  for (final entry in [
    ('CEP *', '80000-000'),
    ('Rua *', 'Rua A'),
    ('Número *', '12'),
    ('Bairro *', 'Centro'),
    ('Cidade *', 'Curitiba'),
  ]) {
    await tester.enterText(
      find.widgetWithText(TextFormField, entry.$1),
      entry.$2,
    );
  }
  await tester.ensureVisible(find.text('Salvar endereço'));
}

void main() {
  testWidgets(
    'descarta resposta de CEP antigo e aceita consulta correspondente',
    (tester) async {
      final api = FakeAddressApi()
        ..lookupGate = Completer<AddressResult<CepData>>();
      await showPage(tester, api);
      final cepField = find.widgetWithText(TextFormField, 'CEP *');
      await tester.enterText(cepField, '80000-000');
      await tester.tap(find.text('Consultar CEP'));
      await tester.pump();
      expect(api.lookedUpCep, '80000000');
      await tester.enterText(cepField, '81000-000');
      api.lookupGate!.complete(
        const AddressResult(
          AddressStatus.success,
          value: CepData('Rua A', 'Bairro A', 'Cidade A', 'PR'),
        ),
      );
      await tester.pump();
      for (final label in ['Rua *', 'Bairro *', 'Cidade *']) {
        expect(
          tester
              .widget<TextFormField>(find.widgetWithText(TextFormField, label))
              .controller!
              .text,
          isEmpty,
        );
      }
      expect(
        find.text('CEP consultado. Confira e complete o endereço.'),
        findsNothing,
      );
      api.lookupGate = null;
      api.lookupData = const CepData('Rua B', 'Bairro B', 'Cidade B', 'PR');
      await tester.tap(find.text('Consultar CEP'));
      await tester.pump();
      expect(api.lookedUpCep, '81000000');
      expect(
        tester
            .widget<TextFormField>(find.widgetWithText(TextFormField, 'Rua *'))
            .controller!
            .text,
        'Rua B',
      );
      expect(
        find.text('CEP consultado. Confira e complete o endereço.'),
        findsOneWidget,
      );
    },
  );

  for (final listFails in [false, true]) {
    testWidgets('salvar OK + GET ${listFails ? 'falha' : 'OK'}', (
      tester,
    ) async {
      final api = FakeAddressApi();
      await showPage(tester, api);
      await fillAddress(tester);
      if (listFails) api.listStatus = AddressStatus.unavailable;
      await tester.tap(find.text('Salvar endereço'));
      await tester.pumpAndSettle();
      expect(api.createCalls, 1);
      if (listFails) {
        expect(
          find.textContaining(
            'Endereço salvo, mas a lista não foi atualizada.',
          ),
          findsOneWidget,
        );
        expect(
          find.text('Endereço salvo. Localização pendente.'),
          findsNothing,
        );
        expect(find.text('Nenhum endereço cadastrado.'), findsOneWidget);
        api.listStatus = null;
        await tester.tap(find.text('Atualizar lista'));
        await tester.pumpAndSettle();
        expect(find.text('Rua A, 12'), findsOneWidget);
      } else {
        expect(
          find.text('Endereço salvo. Localização pendente.'),
          findsOneWidget,
        );
        expect(find.text('Rua A, 12'), findsOneWidget);
      }
    });

    testWidgets('geocodificar OK + GET ${listFails ? 'falha' : 'OK'}', (
      tester,
    ) async {
      final api = FakeAddressApi()..addresses = [address];
      await showPage(tester, api);
      if (listFails) api.listStatus = AddressStatus.unavailable;
      await tester.tap(find.text('Localizar endereço'));
      await tester.pumpAndSettle();
      expect(api.geoCalls, 1);
      if (listFails) {
        expect(
          find.textContaining(
            'Localização salva, mas a lista não foi atualizada.',
          ),
          findsOneWidget,
        );
        expect(find.text('Localização pronta.'), findsNothing);
        expect(find.text('Localização pendente'), findsOneWidget);
        api.listStatus = null;
        await tester.tap(find.text('Atualizar lista'));
        await tester.pumpAndSettle();
        expect(find.text('Localização pronta'), findsOneWidget);
      } else {
        expect(find.text('Localização pronta.'), findsOneWidget);
        expect(find.text('Localização pronta'), findsOneWidget);
      }
    });
  }

  testWidgets('401 renova uma vez e 403 não renova no cadastro', (
    tester,
  ) async {
    final session = FakeSession();
    final api = FakeAddressApi()..createStatus = AddressStatus.unauthorized;
    await showPage(tester, api, session: session);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'CEP *'),
      '80000-000',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Rua *'),
      'Rua A',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Número *'),
      '12',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Bairro *'),
      'Centro',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Cidade *'),
      'Curitiba',
    );
    await tester.ensureVisible(find.text('Salvar endereço'));
    await tester.tap(find.text('Salvar endereço'));
    await tester.pump();
    expect(api.createCalls, 2);
    expect(session.refreshCalls, 1);
    expect(find.text('Sessão expirada. Entre novamente.'), findsOneWidget);
    api.createStatus = AddressStatus.forbidden;
    await tester.ensureVisible(find.text('Salvar endereço'));
    await tester.tap(find.text('Salvar endereço'));
    await tester.pump();
    expect(api.createCalls, 3);
    expect(session.refreshCalls, 1);
    expect(
      find.text('Sua conta não tem acesso a esta operação.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'falha de geocodificação mantém endereço e permite retry manual',
    (tester) async {
      final api = FakeAddressApi()
        ..addresses = [address]
        ..geoStatus = AddressStatus.unavailable;
      await showPage(tester, api);
      await tester.tap(find.text('Localizar endereço'));
      await tester.pump();
      expect(find.text('Localização pendente'), findsOneWidget);
      expect(
        find.text('Serviço indisponível. Tente novamente mais tarde.'),
        findsOneWidget,
      );
      api.geoStatus = AddressStatus.success;
      await tester.tap(find.text('Localizar endereço'));
      await tester.pumpAndSettle();
      expect(api.geoCalls, 2);
      expect(find.text('Localização pronta'), findsOneWidget);
    },
  );

  testWidgets(
    'valida, consulta CEP, salva e geocodifica sem enviar duas vezes',
    (tester) async {
      final api = FakeAddressApi();
      await showPage(tester, api);
      expect(find.text('Nenhum endereço cadastrado.'), findsOneWidget);
      await tester.ensureVisible(find.text('Salvar endereço'));
      await tester.tap(find.text('Salvar endereço'));
      await tester.pump();
      expect(find.text('Informe um CEP com oito dígitos.'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'CEP *'),
        '80000-000',
      );
      await tester.ensureVisible(find.text('Consultar CEP'));
      await tester.tap(find.text('Consultar CEP'));
      await tester.pump();
      expect(find.widgetWithText(TextFormField, 'Rua *'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Número *'),
        '12',
      );
      await tester.ensureVisible(find.text('Salvar endereço'));
      api.createGate = Completer<AddressResult<CustomerAddress>>();
      await tester.tap(find.text('Salvar endereço'));
      await tester.pump();
      expect(api.createCalls, 1);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Salvando…'),
            )
            .onPressed,
        isNull,
      );
      api.addresses = [address];
      api.createGate!.complete(
        const AddressResult(AddressStatus.success, value: address),
      );
      await tester.pumpAndSettle();
      expect(find.text('Localização pendente'), findsOneWidget);
      await tester.ensureVisible(find.text('Localizar endereço'));
      await tester.tap(find.text('Localizar endereço'));
      await tester.pumpAndSettle();
      expect(api.geoCalls, 1);
      expect(find.text('Localização pronta'), findsOneWidget);
    },
  );

  for (final size in [
    const Size(320, 700),
    const Size(390, 844),
    const Size(430, 900),
  ]) {
    testWidgets('formulário responsivo em ${size.width} dp', (tester) async {
      await showPage(tester, FakeAddressApi(), size: size, scale: 2);
      await tester.ensureVisible(find.text('Salvar endereço'));
      expect(tester.takeException(), isNull);
    });
  }
}
