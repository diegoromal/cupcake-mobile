import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';

class AuthBrandMark extends StatelessWidget {
  const AuthBrandMark({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Marca Cupcake',
    child: Container(
      width: 24,
      height: 24,
      decoration: const BoxDecoration(
        color: AppTokens.surfaceSoft,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.cake_outlined,
        size: 16,
        color: AppTokens.primaryStrong,
      ),
    ),
  );
}
