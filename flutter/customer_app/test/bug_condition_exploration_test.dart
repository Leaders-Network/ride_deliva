// ignore_for_file: avoid_print, unused_import
import 'package:flutter_test/flutter_test.dart';
import 'dart:io';
import 'dart:convert';

/// Bug Condition Exploration Property Test
/// 
/// **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
/// **GOAL**: Surface counterexamples that demonstrate Flutter compilation errors exist
/// **Requirements**: 1.1, 1.2, 1.3, 1.4, 1.5
///
/// This test encodes the expected behavior - it will validate the fix when it passes after implementation.
/// When this test FAILS, it proves the bug exists and provides counterexamples.
/// When this test PASSES (after fixes), it confirms the expected behavior is satisfied.
void main() {
  group('Flutter Compilation Error Detection Tests', () {
    late String projectRoot;
    late String customerAppPath;

    setUpAll(() {
      // Get the project root directory 
      projectRoot = Directory.current.path;
      // Assuming we're running from customer_app directory
      customerAppPath = projectRoot;
      
      print('Testing compilation errors in: $customerAppPath');
    });

    test('Property 1: Bug Condition - Flutter analyze should detect compilation errors', () async {
      print('\n=== Bug Condition Exploration Test ===');
      print('EXPECTED OUTCOME: This test should FAIL on unfixed code');
      print('This failure proves the bug exists and provides counterexamples\n');

      // Run flutter analyze to detect compilation errors
      final analyzeResult = await Process.run(
        'flutter', 
        ['analyze', '--no-fatal-infos'],
        workingDirectory: customerAppPath,
      );

      print('Flutter analyze exit code: ${analyzeResult.exitCode}');
      print('Flutter analyze stdout:\n${analyzeResult.stdout}');
      print('Flutter analyze stderr:\n${analyzeResult.stderr}');

      // Parse the output to count errors
      final output = analyzeResult.stdout.toString();
      final errorCount = _countAnalysisErrors(output);
      
      print('\nAnalysis Results:');
      print('- Total compilation errors found: $errorCount');
      
      // This test encodes the expected behavior: NO compilation errors
      // When unfixed, this will FAIL and show counterexamples (the actual errors)
      expect(errorCount, equals(0), 
        reason: 'Expected no compilation errors, but found $errorCount errors. '
               'Counterexamples (proving bug exists):\n$output');
    });

    test('Property 1.1: Missing Flutter Material imports should be resolved', () async {
      // Test specific files that should have proper Flutter imports
      final problematicFiles = [
        'lib/presentation/screens/ride/ride_tracking_screen.dart',
        'lib/presentation/screens/ride/vehicle_selection_screen.dart',
        'lib/presentation/screens/ride/ride_confirmation_screen.dart',
      ];

      for (final filePath in problematicFiles) {
        final file = File('$customerAppPath/$filePath');
        
        if (await file.exists()) {
          final content = await file.readAsString();
          
          print('Checking imports in: $filePath');
          
          // Check if Flutter material is imported when Flutter classes are used
          final hasFlutterClasses = _hasFlutterClasses(content);
          final hasMaterialImport = content.contains("import 'package:flutter/material.dart';");
          
          if (hasFlutterClasses) {
            print('- Uses Flutter classes: $hasFlutterClasses');
            print('- Has material import: $hasMaterialImport');
            
            // Expected behavior: files using Flutter classes should have material import
            expect(hasMaterialImport, isTrue, 
              reason: 'File $filePath uses Flutter classes but missing material import. '
                     'Counterexample: Found Flutter class usage without import');
          }
        }
      }
    });

    test('Property 1.2: Class inheritance should be properly defined', () async {
      // Check ride_tracking_screen.dart for proper class structure
      final file = File('$customerAppPath/lib/presentation/screens/ride/ride_tracking_screen.dart');
      
      if (await file.exists()) {
        final content = await file.readAsString();
        
        print('Checking class structure in ride_tracking_screen.dart');
        
        // Check for proper StatefulWidget extension
        final hasStatefulWidget = content.contains('extends StatefulWidget');
        final hasStateClass = content.contains('extends State<RideTrackingScreen>');
        
        print('- Extends StatefulWidget: $hasStatefulWidget');  
        print('- Has proper State class: $hasStateClass');
        
        // Expected behavior: proper class hierarchy
        expect(hasStatefulWidget, isTrue,
          reason: 'RideTrackingScreen should extend StatefulWidget. '
                 'Counterexample: Class inheritance is broken');
                 
        expect(hasStateClass, isTrue,
          reason: 'State class should extend State<RideTrackingScreen>. '
                 'Counterexample: State class inheritance is broken');
      }
    });

    test('Property 1.3: Map controller variables should be declared', () async {
      // Check ride_booking_screen.dart for map controller declaration
      final file = File('$customerAppPath/lib/presentation/screens/ride/ride_booking_screen.dart');
      
      if (await file.exists()) {
        final content = await file.readAsString();
        
        print('Checking map controller declarations in ride_booking_screen.dart');
        
        // Look for _mapController usage and declaration
        final usesMapController = content.contains('_mapController');
        final declaresMapController = content.contains('GoogleMapController') && 
                                    content.contains('_mapController');
        
        print('- Uses _mapController: $usesMapController');
        print('- Declares _mapController properly: $declaresMapController');
        
        if (usesMapController) {
          // Expected behavior: if _mapController is used, it should be declared
          expect(declaresMapController, isTrue,
            reason: 'File uses _mapController but it is not properly declared. '
                   'Counterexample: Undefined identifier _mapController');
        }
      }
    });

    test('Property 1.4: Navigation type safety should be maintained', () async {
      // Check ride_confirmation_screen.dart for proper navigation types
      final file = File('$customerAppPath/lib/presentation/screens/ride/ride_confirmation_screen.dart');
      
      if (await file.exists()) {
        final content = await file.readAsString();
        
        print('Checking navigation type safety in ride_confirmation_screen.dart');
        
        // Look for MaterialPageRoute usage
        final hasMaterialPageRoute = content.contains('MaterialPageRoute');
        final hasNavigatorUsage = content.contains('Navigator.of(context)');
        
        print('- Uses MaterialPageRoute: $hasMaterialPageRoute');
        print('- Uses Navigator: $hasNavigatorUsage');
        
        // If navigation is used, types should be compatible
        // This is harder to test statically, but we can check for common patterns
        if (hasMaterialPageRoute && hasNavigatorUsage) {
          // Expected behavior: navigation should be type-safe
          // We'll rely on flutter analyze to catch type mismatches
          print('- Navigation patterns detected, relying on flutter analyze for type safety');
        }
      }
    });

    test('Property 1.5: Flutter animate methods should be resolvable', () async {
      // Check files using .animate() method for proper imports
      final animationFiles = [
        'lib/presentation/screens/ride/ride_tracking_screen.dart',
        'lib/presentation/screens/ride/vehicle_selection_screen.dart',
      ];

      for (final filePath in animationFiles) {
        final file = File('$customerAppPath/$filePath');
        
        if (await file.exists()) {
          final content = await file.readAsString();
          
          print('Checking animation imports in: $filePath');
          
          // Check for .animate() usage and proper import
          final usesAnimate = content.contains('.animate()') || content.contains('.ms');
          final hasAnimateImport = content.contains("import 'package:flutter_animate/flutter_animate.dart';");
          
          print('- Uses animation methods: $usesAnimate');
          print('- Has animate import: $hasAnimateImport');
          
          if (usesAnimate) {
            // Expected behavior: files using animate methods should have the import
            expect(hasAnimateImport, isTrue,
              reason: 'File $filePath uses .animate() or .ms but missing flutter_animate import. '
                     'Counterexample: Animation methods are unresolved');
          }
        }
      }
    });

    test('Property 1: Complete flutter run should succeed without errors', () async {
      print('\n=== Complete Build Test ===');
      print('Testing that flutter run can execute without compilation errors');
      
      // Try to run flutter run --dry-run which checks compilation without actually running
      final runResult = await Process.run(
        'flutter', 
        ['run', '--dry-run'],
        workingDirectory: customerAppPath,
      );

      print('Flutter run --dry-run exit code: ${runResult.exitCode}');
      print('Flutter run stdout:\n${runResult.stdout}');
      if (runResult.stderr.isNotEmpty) {
        print('Flutter run stderr:\n${runResult.stderr}');
      }

      // Expected behavior: flutter run should succeed (exit code 0)
      expect(runResult.exitCode, equals(0),
        reason: 'Flutter run --dry-run failed with exit code ${runResult.exitCode}. '
               'Counterexamples (compilation errors):\n'
               'STDOUT: ${runResult.stdout}\n'
               'STDERR: ${runResult.stderr}');
    });
  });
}

/// Helper function to count analysis errors from flutter analyze output
int _countAnalysisErrors(String output) {
  // Count lines that indicate errors
  final lines = output.split('\n');
  int errorCount = 0;
  
  for (final line in lines) {
    // Look for error patterns in flutter analyze output
    if (line.contains('error •') || 
        line.contains('• error') ||
        line.contains('Error:') ||
        (line.contains('•') && line.toLowerCase().contains('error'))) {
      errorCount++;
    }
  }
  
  // Also try to extract number from summary line like "123 issues found"
  final summaryRegex = RegExp(r'(\d+)\s+issues?\s+found');
  final match = summaryRegex.firstMatch(output);
  if (match != null) {
    final issueCount = int.tryParse(match.group(1) ?? '0') ?? 0;
    // Use the higher count (individual error lines vs summary)
    errorCount = errorCount > issueCount ? errorCount : issueCount;
  }
  
  return errorCount;
}

/// Helper function to detect if file content uses Flutter classes
bool _hasFlutterClasses(String content) {
  final flutterClasses = [
    'StatefulWidget', 'StatelessWidget', 'State<', 'BuildContext',
    'Widget', 'Scaffold', 'AppBar', 'Column', 'Row', 'Container',
    'MaterialPageRoute', 'Navigator', 'FloatingActionButton',
    'AnimationController', 'TickerProviderStateMixin'
  ];
  
  return flutterClasses.any((className) => content.contains(className));
}