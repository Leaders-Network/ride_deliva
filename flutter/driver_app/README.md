# Ride Deliva Driver

Android is the release platform. Chrome provides quick UI previews of the same
Flutter app; it does not emulate Android services or permissions.

Run from `flutter/driver_app`:

```powershell
flutter pub get
flutter run -d chrome
```

Chrome must be installed and listed by `flutter devices`. No Chrome Dart package
or ChromeDriver is required. If web support is disabled, run
`flutter config --enable-web`.

When opening the repository root in VS Code, the local launch configuration
includes **Driver app (Chrome preview)**. For Android, start an emulator or
connect a phone with USB debugging, select it in VS Code, and use
**Driver app (selected Android device)**. From the terminal:

```powershell
flutter devices
flutter run -d <android-device-id>
flutter build apk --debug
```

Validate changes with `flutter test` and `flutter build web`. Test native
location, notifications, background execution, and permissions on Android.

Android builds use a 2 GB Gradle heap and two workers to leave memory available
for the IDE and emulator on an 8 GB development machine.

The unused legacy `qr_code_scanner`, `file_picker`, `workmanager`, and
`flutter_local_notifications`
dependencies were removed because they were incompatible with the current
Android/Flutter toolchain. Add compatible packages when implementing those
features; do not patch files in the global Pub cache.

Poppins fonts are bundled from
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/poppins), with their
license in `assets/fonts/OFL.txt`.
