class CustomerSignUpValidation {
  const CustomerSignUpValidation._();

  static String? validateName(String value) =>
      value.trim().isEmpty ? 'Informe seu nome.' : null;

  static String? validatePhone(String value) =>
      value.trim().isEmpty ? 'Informe seu telefone.' : null;

  static String? normalizeEmail(String value) {
    final email = value.trim().toLowerCase();
    if (email.isEmpty) return null;
    final at = email.indexOf('@');
    if (at <= 0 || at != email.lastIndexOf('@') || at == email.length - 1) {
      return null;
    }
    final local = email.substring(0, at);
    final domain = email.substring(at + 1);
    // Match the installed class-validator/validator.js IsEmail length limits.
    if (email.length > 254 || local.length > 64) return null;
    // Product rule: conventional dot-atom local part and DNS-style domain.
    // Quoted local parts, whitespace, and malformed dot placement are rejected.
    final localPart = RegExp(
      r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$",
    );
    final labels = domain.split('.');
    final domainLabel = RegExp(r'^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$');
    if (!localPart.hasMatch(local) ||
        labels.length < 2 ||
        labels.any(
          (label) => label.length > 63 || !domainLabel.hasMatch(label),
        ) ||
        !RegExp(r'^[a-z]{2,}$').hasMatch(labels.last)) {
      return null;
    }
    return email;
  }

  static String? validateEmail(String value) {
    if (value.trim().isEmpty) return 'Informe seu e-mail.';
    return normalizeEmail(value) == null ? 'Informe um e-mail válido.' : null;
  }

  static String? validatePassword(String value) {
    if (value.isEmpty) return 'Informe sua senha.';
    // String.length counts UTF-16 code units, as JavaScript and class-validator do.
    if (value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    return null;
  }

  static String? validateForm({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) =>
      validateName(name) ??
      validateEmail(email) ??
      validatePhone(phone) ??
      validatePassword(password);
}
