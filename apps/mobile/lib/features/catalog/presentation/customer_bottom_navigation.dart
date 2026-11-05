import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';

class CustomerBottomNavigation extends StatelessWidget {
  const CustomerBottomNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const _items = <(IconData, String)>[
    (Icons.local_cafe_outlined, 'Cardápio'),
    (Icons.shopping_bag_outlined, 'Carrinho'),
    (Icons.receipt_long_outlined, 'Pedidos'),
    (Icons.person_outline, 'Perfil'),
  ];

  @override
  Widget build(BuildContext context) => Container(
    height: 58,
    decoration: const BoxDecoration(
      color: Color(0xFFFFFAF8),
      border: Border(top: BorderSide(color: AppTokens.border, width: 0.6)),
    ),
    child: Row(
      children: [
        for (var index = 0; index < _items.length; index++)
          _item(index, _items[index].$1, _items[index].$2),
      ],
    ),
  );

  Widget _item(int index, IconData icon, String label) {
    final selected = selectedIndex == index;
    final color = selected ? AppTokens.primaryStrong : AppTokens.text;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        child: InkWell(
          onTap: () => onSelected(index),
          child: SizedBox.expand(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 19, color: color),
                const SizedBox(height: 2),
                Text(
                  label,
                  maxLines: 1,
                  style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
