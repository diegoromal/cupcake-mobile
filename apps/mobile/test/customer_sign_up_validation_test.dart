import 'package:cupcake_mobile/features/auth/presentation/customer_sign_up_validation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('validação do cadastro', () {
    test('nome e telefone validam somente presença após trim', () {
      expect(CustomerSignUpValidation.validateName(''), isNotNull);
      expect(CustomerSignUpValidation.validateName('  '), isNotNull);
      expect(CustomerSignUpValidation.validateName(' Ana '), isNull);
      expect(CustomerSignUpValidation.validateName('Ana'), isNull);
      expect(CustomerSignUpValidation.validatePhone(' '), isNotNull);
      expect(CustomerSignUpValidation.validatePhone(' (11) abc '), isNull);
    });

    test('matriz normativa de e-mail segue a regra de produto', () {
      const accepted = [
        'joao@gmail.com',
        'Joao.Silva@Gmail.com',
        'joao+teste@gmail.com',
        'joao.silva@empresa.com.br',
        'usuario@subdominio.empresa.com.br',
        'a.b+c@example.com',
      ];
      const rejected = [
        'joao@gmail',
        'joao@',
        '@gmail.com',
        'joao@@gmail.com',
        'joao silva@gmail.com',
        '"a@b"@example.com',
      ];
      final lengthCases = <(String, bool)>[
        ('${'a' * 64}@example.com', true),
        ('${'a' * 65}@example.com', false),
        ('usuario@${'a' * 63}.com', true),
        ('usuario@${'a' * 64}.com', false),
        ('${'a' * 64}@${'a' * 63}.${'a' * 63}.${'a' * 57}.com', true),
        ('${'a' * 64}@${'a' * 63}.${'a' * 63}.${'a' * 58}.com', false),
      ];
      for (final (email, valid) in lengthCases) {
        expect(
          CustomerSignUpValidation.validateEmail(email) == null,
          valid,
          reason: email,
        );
      }
      for (final email in accepted) {
        expect(
          CustomerSignUpValidation.validateEmail(email),
          isNull,
          reason: email,
        );
      }
      for (final email in rejected) {
        expect(
          CustomerSignUpValidation.validateEmail(email),
          isNotNull,
          reason: email,
        );
      }
      expect(CustomerSignUpValidation.validateEmail(' '), isNotNull);
      expect(
        CustomerSignUpValidation.validateEmail('obvio-invalido'),
        isNotNull,
      );
      expect(
        CustomerSignUpValidation.normalizeEmail('  Joao.Silva@Gmail.com  '),
        'joao.silva@gmail.com',
      );
      expect(
        CustomerSignUpValidation.validateEmail('"a@b"@example.com'),
        isNotNull,
      );
      expect(
        CustomerSignUpValidation.validateEmail('joao.silva@gmail.com '),
        isNull,
      );
      expect(
        CustomerSignUpValidation.validateEmail('joao silva@gmail.com'),
        isNotNull,
      );
    });

    test(
      'senha conta unidades UTF-16, preserva espaços e não exige composição',
      () {
        expect(CustomerSignUpValidation.validatePassword(''), isNotNull);
        expect(CustomerSignUpValidation.validatePassword('1234567'), isNotNull);
        expect(CustomerSignUpValidation.validatePassword('12345678'), isNull);
        expect(CustomerSignUpValidation.validatePassword('  senha '), isNull);
        expect(CustomerSignUpValidation.validatePassword('áááááááá'), isNull);
        expect(CustomerSignUpValidation.validatePassword('😀😀😀😀'), isNull);
      },
    );
  });
}
