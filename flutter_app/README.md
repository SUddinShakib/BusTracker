# BusBridge Mobile (Flutter — Android & iOS)

Native Flutter client for **BusBridge**, connecting waiting commuters and onboard bus passengers in real time via WebSockets and multi-passenger GPS aggregation.

## Features
- **All 10 Screens**: Animated Splash, Welcome, Enter Name (with display-name privacy toggle), Location Permission, Join / Create Bus Session, Live Map Workspace (with Google Maps live traffic layer, dark commuter styling, custom bus/stop/passenger markers, and draggable status sheet), Waiting Status + Distance/ETA, Onboard Sharing Mode ("I Got Into the Bus – Start Sharing", Pause/Resume, "I've Reached"), Live Passenger Roster, and Settings.
- **Intelligent Aggregation Engine (`lib/services/location_aggregation.dart`)**: Filters stale or coarse GPS signals, guards against stationary waiting-at-stop outliers, performs MAD spatial outlier rejection, and computes inverse-variance + recency weighted centroids.
- **Platform Native Permissions & Maps**: Configured for Android (`AndroidManifest.xml`, `MainActivity.kt`) and iOS (`Info.plist`, `AppDelegate.swift`).

## Prerequisites
1. Install [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.22+).
2. For iOS builds, use macOS with Xcode 15+ and CocoaPods.
3. For Android builds, use Android Studio / Android SDK API 34+.
4. A Google Maps Platform API key enabled for **Maps SDK for Android** and **Maps SDK for iOS**.

## Setup & Install on Your Phone

1. Generate platform build runners (preserves `android/` and `ios/` manifests):
   ```bash
   cd flutter_app
   flutter create . --org com.busbridge.app --project-name busbridge
   flutter pub get
   ```

2. Configure your Google Maps API key (never commit real keys):
   - **Android**: Add `MAPS_API_KEY=YOUR_KEY` to `android/local.properties` (and read it in `android/app/build.gradle` `manifestPlaceholders = [MAPS_API_KEY: localProperties.getProperty("MAPS_API_KEY", "")]`).
   - **iOS**: Add `<key>GMSApiKey</key><string>$(MAPS_API_KEY)</string>` or configure `MAPS_API_KEY` in `ios/Flutter/Debug.xcconfig` & `Release.xcconfig`.

3. Run directly on a connected Android or iOS device:
   ```bash
   flutter run \
     --dart-define=API_BASE_URL=https://ais-pre-c7ugv464xfe3kpav4ryxro-193513859415.asia-east1.run.app
   ```

4. Build installable packages:
   ```bash
   # Android APK (sideload directly to Android phone)
   flutter build apk --release \
     --dart-define=API_BASE_URL=https://ais-pre-c7ugv464xfe3kpav4ryxro-193513859415.asia-east1.run.app

   # iOS IPA (install via Xcode / TestFlight)
   flutter build ipa --release \
     --dart-define=API_BASE_URL=https://ais-pre-c7ugv464xfe3kpav4ryxro-193513859415.asia-east1.run.app
   ```
