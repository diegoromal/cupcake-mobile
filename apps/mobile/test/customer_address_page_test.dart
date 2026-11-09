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
  AddressStatus? updateStatus;
  AddressStatus? deleteStatus;
  Map<String, Object?>? updatedBody;
  int updateCalls = 0, deleteCalls = 0;
  int listCalls = 0;
  Completer<AddressResult<CustomerAddress>>? createGate;
  Completer<AddressResult<CepData>>? lookupGate;
  CepData lookupData = const CepData('Rua A', 'Centro', 'Curitiba', 'PR');
  int createCalls = 0, geoCalls = 0;
  @override
  Future<AddressResult<List<CustomerAddress>>> list(String token) async {
    listCalls++;
    return listStatus == null
        ? AddressResult(AddressStatus.success, value: addresses)
        : AddressResult(listStatus!);
  }

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
  Future<AddressResult<CustomerAddress>> update(
    String token,
    String id,
    Map<String, Object?> body,
  ) async {
    updateCalls++;
    updatedBody = body;
    if (updateStatus != null) return AddressResult(updateStatus!);
    final previous = addresses.single;
    final searchChanged =
        body['rua'] != previous.street ||
        body['numero'] != previous.number ||
        body['bairro'] != previous.neighborhood ||
        body['cidade'] != previous.city ||
        (body['cep'] as String).replaceAll('-', '') != previous.cep;
    addresses = [
      CustomerAddress(
        id: address.id,
        street: body['rua'] as String,
        number: body['numero'] as String,
        neighborhood: body['bairro'] as String,
        city: body['cidade'] as String,
        cep: (body['cep'] as String).replaceAll('-', ''),
        complement: body['complemento'] as String?,
        reference: body['referencia'] as String?,
        located: previous.located && !searchChanged,
      ),
    ];
    return AddressResult(AddressStatus.success, value: addresses.single);
  }

  @override
  Future<AddressResult<void>> delete(String token, String id) async {
    deleteCalls++;
    if (deleteStatus != null) return AddressResult(deleteStatus!);
    addresses = [];
    return const AddressResult(AddressStatus.success);
  }

  @override
  Future<AddressResult<void>> geocode(String token, String id) async {
    geoCalls++;
    if (geoStatus != null && geoStatus != AddressStatus.success) {
      final previous = addresses.single;
      final state = switch (geoStatus!) {
        AddressStatus.notLocated => AddressLocationStatus.notLocated,
        AddressStatus.ambiguous => AddressLocationStatus.ambiguous,
        _ => AddressLocationStatus.temporary,
      };
      addresses = [
        CustomerAddress(
          id: previous.id,
          street: previous.street,
          number: previous.number,
          neighborhood: previous.neighborhood,
          city: previous.city,
          cep: previous.cep,
          complement: previous.complement,
          reference: previous.reference,
          located: false,
          locationStatus: state,
        ),
      ];
      return AddressResult(geoStatus!);
    }
    final previous = addresses.single;
    addresses = [
      CustomerAddress(
        id: previous.id,
        street: previous.street,
        number: previous.number,
        neighborhood: previous.neighborhood,
        city: previous.city,
        cep: previous.cep,
        complement: previous.complement,
        reference: previous.reference,
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
      expect(api.geoCalls, 1);
      if (listFails) {
        expect(
          find.textContaining(
            'Endereço salvo, mas a lista não foi atualizada.',
          ),
          findsOneWidget,
        );
        expect(find.text('Endereço salvo. Localização pronta.'), findsNothing);
        expect(find.text('Nenhum endereço cadastrado.'), findsOneWidget);
        api.listStatus = null;
        await tester.tap(find.text('Atualizar lista'));
        await tester.pumpAndSettle();
        expect(find.text('Rua A, 12'), findsOneWidget);
      } else {
        expect(
          find.text('Endereço salvo. Localização pronta.'),
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
      expect(find.text('Falha temporária de localização'), findsOneWidget);
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
    'editar preenche dados, salva a busca e relocaliza sem trocar o ID',
    (tester) async {
      final api = FakeAddressApi()..addresses = [address];
      await showPage(tester, api);
      await tester.tap(find.text('Editar'));
      await tester.pump();
      expect(
        tester
            .widget<TextFormField>(find.widgetWithText(TextFormField, 'Rua *'))
            .controller!
            .text,
        'Rua A',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Rua *'),
        'Rua B',
      );
      await tester.ensureVisible(find.text('Salvar alterações'));
      await tester.tap(find.text('Salvar alterações'));
      await tester.pumpAndSettle();
      expect(api.updateCalls, 1);
      expect(api.updatedBody?['rua'], 'Rua B');
      expect(api.geoCalls, 1);
      expect(api.addresses.single.id, address.id);
      expect(find.text('Rua B, 12'), findsOneWidget);
      expect(find.text('Localização pronta'), findsOneWidget);
    },
  );

  testWidgets('erro ao localizar após criar mantém endereço e permite retry', (
    tester,
  ) async {
    final api = FakeAddressApi()..geoStatus = AddressStatus.notLocated;
    await showPage(tester, api);
    await fillAddress(tester);
    await tester.tap(find.text('Salvar endereço'));
    await tester.pumpAndSettle();
    expect(api.createCalls, 1);
    expect(api.geoCalls, 1);
    expect(
      api.addresses.single.locationStatus,
      AddressLocationStatus.notLocated,
    );
    expect(
      find.textContaining('Endereço salvo. Endereço não localizado.'),
      findsOneWidget,
    );
    api.geoStatus = null;
    await tester.tap(find.text('Localizar endereço'));
    await tester.pumpAndSettle();
    expect(api.geoCalls, 2);
    expect(find.text('Localização pronta'), findsOneWidget);
  });

  testWidgets(
    'editar só complemento preserva localização e não chama provider',
    (tester) async {
      final api = FakeAddressApi()
        ..addresses = [
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
      await showPage(tester, api);
      await tester.tap(find.text('Editar'));
      await tester.pump();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Complemento'),
        'A',
      );
      await tester.ensureVisible(find.text('Salvar alterações'));
      await tester.tap(find.text('Salvar alterações'));
      await tester.pumpAndSettle();
      expect(api.updateCalls, 1);
      expect(api.geoCalls, 0);
      expect(api.addresses.single.located, true);
    },
  );

  testWidgets('cancelar edição preserva endereço e não envia PATCH', (
    tester,
  ) async {
    final api = FakeAddressApi()..addresses = [address];
    await showPage(tester, api);
    await tester.tap(find.text('Editar'));
    await tester.pump();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Rua *'),
      'Rua B',
    );
    await tester.ensureVisible(find.text('Cancelar edição'));
    await tester.tap(find.text('Cancelar edição'));
    await tester.pumpAndSettle();
    expect(api.updateCalls, 0);
    expect(api.addresses.single.street, 'Rua A');
    expect(find.text('Cadastrar endereço'), findsOneWidget);
  });

  testWidgets('falha de geocodificação após editar mantém PATCH salvo', (
    tester,
  ) async {
    final api = FakeAddressApi()
      ..addresses = [address]
      ..geoStatus = AddressStatus.ambiguous;
    await showPage(tester, api);
    await tester.tap(find.text('Editar'));
    await tester.pump();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Rua *'),
      'Rua B',
    );
    await tester.ensureVisible(find.text('Salvar alterações'));
    await tester.tap(find.text('Salvar alterações'));
    await tester.pumpAndSettle();
    expect(api.updateCalls, 1);
    expect(api.geoCalls, 1);
    expect(api.addresses.single.street, 'Rua B');
    expect(
      api.addresses.single.locationStatus,
      AddressLocationStatus.ambiguous,
    );
    expect(
      find.textContaining('Endereço salvo. Localização ambígua.'),
      findsOneWidget,
    );
  });

  testWidgets('409 stale recarrega lista e não informa localização ambígua', (
    tester,
  ) async {
    final api = FakeAddressApi()
      ..addresses = [address]
      ..geoStatus = AddressStatus.stale;
    await showPage(tester, api);
    expect(api.listCalls, 1);
    await tester.tap(find.text('Localizar endereço'));
    await tester.pumpAndSettle();
    expect(api.listCalls, 2);
    expect(
      find.textContaining('Endereço alterado durante a localização.'),
      findsOneWidget,
    );
    expect(find.textContaining('Localização ambígua.'), findsNothing);
  });

  testWidgets('exclusão exige confirmação e cancelar preserva endereço', (
    tester,
  ) async {
    final api = FakeAddressApi()..addresses = [address];
    await showPage(tester, api);
    await tester.tap(find.text('Excluir endereço'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.deleteCalls, 0);
    expect(find.text('Rua A, 12'), findsOneWidget);
    await tester.tap(find.text('Excluir endereço'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Excluir'));
    await tester.pumpAndSettle();
    expect(api.deleteCalls, 1);
    expect(find.text('Nenhum endereço cadastrado.'), findsOneWidget);
  });

  for (final pair in [
    (AddressLocationStatus.pending, 'Localização pendente'),
    (AddressLocationStatus.notLocated, 'Endereço não localizado'),
    (AddressLocationStatus.temporary, 'Falha temporária de localização'),
    (AddressLocationStatus.ambiguous, 'Localização ambígua'),
    (AddressLocationStatus.located, 'Localização pronta'),
  ]) {
    testWidgets('mostra estado persistido ${pair.$1}', (tester) async {
      final original = address;
      final api = FakeAddressApi()
        ..addresses = [
          CustomerAddress(
            id: original.id,
            street: original.street,
            number: original.number,
            neighborhood: original.neighborhood,
            city: original.city,
            cep: original.cep,
            complement: null,
            reference: null,
            located: pair.$1 == AddressLocationStatus.located,
            locationStatus: pair.$1,
          ),
        ];
      await showPage(tester, api);
      expect(find.text(pair.$2), findsOneWidget);
    });
  }

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
