import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum _WalletFilter { all, earnings, payouts }

enum _TransactionType { earning, payout, bonus, adjustment }

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  static const _transactions = [
    _WalletTransaction(
      title: 'Airport ride to Lekki Phase 1',
      subtitle: 'Ride · Today, 8:42 AM',
      amount: '+₦8,400',
      status: 'Completed',
      icon: Icons.local_taxi_outlined,
      type: _TransactionType.earning,
    ),
    _WalletTransaction(
      title: 'Delivery payout from Victoria Island',
      subtitle: 'Delivery · Yesterday, 6:15 PM',
      amount: '+₦3,250',
      status: 'Paid',
      icon: Icons.inventory_2_outlined,
      type: _TransactionType.earning,
    ),
    _WalletTransaction(
      title: 'Withdrawal to GTBank',
      subtitle: 'Yesterday, 11:03 AM',
      amount: '-₦20,000',
      status: 'Successful',
      icon: Icons.account_balance_outlined,
      type: _TransactionType.payout,
    ),
    _WalletTransaction(
      title: 'Weekend surge bonus',
      subtitle: 'Monday, 6:15 PM',
      amount: '+₦1,050',
      status: 'Credited',
      icon: Icons.workspace_premium_outlined,
      type: _TransactionType.bonus,
    ),
    _WalletTransaction(
      title: 'Fare adjustment',
      subtitle: 'Monday, 4:20 PM',
      amount: '-₦450',
      status: 'Adjusted',
      icon: Icons.receipt_long_outlined,
      type: _TransactionType.adjustment,
    ),
  ];

  _WalletFilter _filter = _WalletFilter.all;
  bool _balanceIsVisible = true;

  List<_WalletTransaction> get _visibleTransactions {
    return _transactions.where((transaction) {
      return switch (_filter) {
        _WalletFilter.all => true,
        _WalletFilter.earnings => transaction.type != _TransactionType.payout,
        _WalletFilter.payouts => transaction.type == _TransactionType.payout,
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Wallet',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Transaction history',
                onPressed: () => setState(() => _filter = _WalletFilter.all),
                icon: const Icon(Icons.history_rounded),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.backgroundCard,
                  foregroundColor: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            children: [
              _buildBalanceCard(),
              const SizedBox(height: 12),
              _buildPayoutAccount(),
              const SizedBox(height: 22),
              _buildTransactionsHeader(),
              const SizedBox(height: 10),
              _buildFilters(),
              const SizedBox(height: 10),
              _buildTransactions(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: AppColors.earningsGradient,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Available balance',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: _balanceIsVisible ? 'Hide balance' : 'Show balance',
                onPressed: () => setState(
                  () => _balanceIsVisible = !_balanceIsVisible,
                ),
                icon: Icon(
                  _balanceIsVisible
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: Colors.white,
                  size: 19,
                ),
              ),
            ],
          ),
          Text(
            _balanceIsVisible ? '₦582,100' : '₦••••••',
            style: const TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Ride Deliva driver wallet',
            style: TextStyle(fontSize: 11, color: Colors.white70),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _BalanceAction(
                  label: 'Withdraw',
                  icon: Icons.south_west_rounded,
                  filled: true,
                  onPressed: () => _showMessage('Withdrawal'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BalanceAction(
                  label: 'Payout details',
                  icon: Icons.account_balance_outlined,
                  filled: false,
                  onPressed: () => _showMessage('Payout details'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPayoutAccount() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.primaryBlue.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.account_balance_outlined,
              color: AppColors.primaryBlue,
              size: 20,
            ),
          ),
          const SizedBox(width: 11),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Linked bank account',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'GTBank  •••• 4821',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Adebayo O. · Savings account',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Manage payout account',
            onPressed: () => _showMessage('Payout account settings'),
            icon: const Icon(Icons.chevron_right_rounded),
            color: AppColors.textSecondary,
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsHeader() {
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Recent transactions',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        Text(
          '${_visibleTransactions.length} records',
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildFilters() {
    const labels = {
      _WalletFilter.all: 'All',
      _WalletFilter.earnings: 'Earnings',
      _WalletFilter.payouts: 'Payouts',
    };

    return Row(
      children: _WalletFilter.values.map((filter) {
        final selected = _filter == filter;
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: ChoiceChip(
            key: ValueKey(filter),
            label: Text(labels[filter]!),
            selected: selected,
            showCheckmark: false,
            onSelected: (_) => setState(() => _filter = filter),
            backgroundColor: AppColors.backgroundCard,
            selectedColor: AppColors.primaryAccent.withValues(alpha: 0.16),
            side: BorderSide(
              color: selected ? AppColors.primaryAccent : AppColors.border,
            ),
            labelStyle: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color:
                  selected ? AppColors.primaryAccent : AppColors.textSecondary,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9),
            ),
            visualDensity: VisualDensity.compact,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTransactions() {
    final transactions = _visibleTransactions;
    if (transactions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            'No transactions in this category',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (var index = 0; index < transactions.length; index++) ...[
            _TransactionTile(transaction: transactions[index]),
            if (index < transactions.length - 1)
              const Divider(height: 1, indent: 58),
          ],
        ],
      ),
    );
  }

  void _showMessage(String action) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$action will be available soon'),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

class _BalanceAction extends StatelessWidget {
  const _BalanceAction({
    required this.label,
    required this.icon,
    required this.filled,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool filled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final foreground = filled ? AppColors.primaryDark : Colors.white;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        foregroundColor: foreground,
        backgroundColor: filled ? Colors.white : Colors.transparent,
        side: BorderSide(
          color: filled ? Colors.white : Colors.white.withValues(alpha: 0.45),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
        textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final _WalletTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final isCredit = transaction.amount.startsWith('+');
    final amountColor =
        isCredit ? AppColors.earningsGreen : AppColors.textPrimary;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              transaction.icon,
              color: AppColors.textSecondary,
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${transaction.subtitle} · ${transaction.status}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            transaction.amount,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _WalletTransaction {
  const _WalletTransaction({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.status,
    required this.icon,
    required this.type,
  });

  final String title;
  final String subtitle;
  final String amount;
  final String status;
  final IconData icon;
  final _TransactionType type;
}
