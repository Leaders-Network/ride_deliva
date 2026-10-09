// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:driver_app/main.dart';
import 'package:driver_app/presentation/screens/dashboard/dashboard_screen.dart';
import 'package:driver_app/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:driver_app/presentation/screens/trips/trips_screen.dart';
import 'package:driver_app/presentation/screens/wallet/wallet_screen.dart';
import 'package:driver_app/presentation/screens/activity/activity_screen.dart';
import 'package:driver_app/presentation/screens/profile/profile_screen.dart';
import 'package:driver_app/presentation/screens/document_verification/document_verification_screen.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const DriverApp());
    await tester.pump();
    // Basic smoke test: verify the app renders without crashing.
    expect(find.byType(DriverApp), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    expect(find.byType(OnboardingScreen), findsOneWidget);
  });

  testWidgets('Dashboard shows reference content and toggles availability', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: DashboardScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Good Afternoon, David'), findsOneWidget);
    expect(find.text('₦28,450'), findsOneWidget);
    expect(find.text('Acceptance Rate'), findsOneWidget);
    expect(find.text('Active Bonus'), findsOneWidget);
    expect(find.text('Recent Trips'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);

    await tester.ensureVisible(find.text('Offline'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Offline'));
    await tester.pumpAndSettle();

    final availability = tester.widget<SegmentedButton<bool>>(
      find.byType(SegmentedButton<bool>),
    );
    expect(availability.selected, {false});
  });

  testWidgets('Trips tab filters trips and returns to dashboard', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: DashboardScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Trips'));
    await tester.pumpAndSettle();

    expect(find.byType(TripsScreen), findsOneWidget);
    expect(find.text('RD-12048'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey(TripFilter.completed)));
    await tester.pumpAndSettle();
    expect(find.text('RD-12048'), findsNothing);
    expect(find.text('RD-12041'), findsOneWidget);

    await tester.tap(find.text('Dashboard'));
    await tester.pumpAndSettle();
    expect(find.text('Good Afternoon, David'), findsOneWidget);
  });

  testWidgets('Wallet tab shows balance and filters payout transactions', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: DashboardScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Wallet'));
    await tester.pumpAndSettle();

    expect(find.byType(WalletScreen), findsOneWidget);
    expect(find.text('₦582,100'), findsOneWidget);
    expect(find.text('GTBank  •••• 4821'), findsOneWidget);

    await tester.tap(find.byTooltip('Hide balance'));
    await tester.pumpAndSettle();
    expect(find.text('₦••••••'), findsOneWidget);

    await tester.tap(find.text('Payouts'));
    await tester.pumpAndSettle();
    expect(find.text('-₦20,000'), findsOneWidget);
    expect(find.text('+₦8,400'), findsNothing);

    await tester.tap(find.text('Dashboard'));
    await tester.pumpAndSettle();
    expect(find.text('Good Afternoon, David'), findsOneWidget);
  });

  testWidgets('Activity tab filters driver events',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: DashboardScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();

    expect(find.byType(ActivityScreen), findsOneWidget);
    expect(find.text('Ride completed'), findsNWidgets(2));
    expect(find.text('Payout sent to GTBank'), findsOneWidget);

    await tester.tap(find.text('Deliveries'));
    await tester.pumpAndSettle();
    expect(find.text('Delivery completed'), findsOneWidget);
    expect(find.text('Payout sent to GTBank'), findsNothing);

    await tester.tap(find.text('Dashboard'));
    await tester.pumpAndSettle();
    expect(find.text('Good Afternoon, David'), findsOneWidget);
  });

  testWidgets('Profile tab links to driver document verification', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: DashboardScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(find.byType(ProfileScreen), findsOneWidget);
    expect(find.text('David A.'), findsOneWidget);
    expect(find.text('Vehicle details'), findsOneWidget);
    expect(find.text('Driver documents'), findsOneWidget);

    await tester.tap(find.text('Driver documents'));
    await tester.pumpAndSettle();
    expect(find.byType(DocumentVerificationScreen), findsOneWidget);
  });
}
