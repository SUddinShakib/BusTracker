import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/bus_models.dart';
import '../services/api_client.dart';
import '../services/location_aggregation.dart';
import '../services/location_service.dart';
import '../services/realtime_ws_service.dart';

enum AppRouteScreen {
  splash,
  welcome,
  enterName,
  locationPermission,
  joinBus,
  tracking,
  passengers,
  settings,
}

class BusTrackerController extends ChangeNotifier {
  BusTrackerController({
    ApiClient? apiClient,
    LocationService? locationService,
  })  : _api = apiClient ?? ApiClient(),
        _location = locationService ?? LocationService() {
    _ws = RealtimeWsService(baseHttpUrl: _api.baseUrl)
      ..onConnectionState = _onWsState
      ..onSnapshot = _onSnapshot
      ..onEvent = _onSessionEvent;
    _loadPrefs();
  }

  final ApiClient _api;
  final LocationService _location;
  late final RealtimeWsService _ws;

  AppRouteScreen _screen = AppRouteScreen.splash;
  AppRouteScreen get screen => _screen;

  ThemeMode _themeMode = ThemeMode.light;
  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  String? _userId;
  String? get userId => _userId;
  String _userName = '';
  String get userName => _userName;
  bool _shareName = true;
  bool get shareName => _shareName;

  int _updateIntervalMs = 3000;
  int get updateIntervalMs => _updateIntervalMs;
  bool _trafficLayerEnabled = true;
  bool get trafficLayerEnabled => _trafficLayerEnabled;
  bool _arrivalAlertsEnabled = true;
  bool get arrivalAlertsEnabled => _arrivalAlertsEnabled;

  bool _hasLocationPermission = false;
  bool get hasLocationPermission => _hasLocationPermission;
  GpsSample? _myLocation;
  GpsSample? get myLocation => _myLocation;
  String? _locationError;
  String? get locationError => _locationError;

  List<BusSession> _availableSessions = [];
  List<BusSession> get availableSessions => _availableSessions;
  bool _loadingSessions = false;
  bool get loadingSessions => _loadingSessions;

  SessionSnapshot? _snapshot;
  SessionSnapshot? get snapshot => _snapshot;
  Passenger? _currentPassenger;
  Passenger? get currentPassenger => _currentPassenger;

  WsConnectionState _wsState = WsConnectionState.disconnected;
  WsConnectionState get wsState => _wsState;

  final List<SessionEventItem> _recentEvents = [];
  List<SessionEventItem> get recentEvents => List.unmodifiable(_recentEvents);

  bool _busApproachingAlert = false;
  bool get busApproachingAlert => _busApproachingAlert;

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _userId = prefs.getString('busbridge_user_id');
    _userName = prefs.getString('busbridge_user_name') ?? '';
    _shareName = prefs.getBool('busbridge_share_name') ?? true;
    _updateIntervalMs = prefs.getInt('busbridge_interval_ms') ?? 3000;
    _trafficLayerEnabled = prefs.getBool('busbridge_traffic') ?? true;
    _arrivalAlertsEnabled = prefs.getBool('busbridge_alerts') ?? true;
    final dark = prefs.getBool('busbridge_dark') ?? false;
    _themeMode = dark ? ThemeMode.dark : ThemeMode.light;
    _hasLocationPermission = await _location.hasPermission();
    notifyListeners();
  }

  void completeSplash() {
    if (_userId != null && _userName.isNotEmpty) {
      _screen = _hasLocationPermission
          ? AppRouteScreen.joinBus
          : AppRouteScreen.locationPermission;
      if (_screen == AppRouteScreen.joinBus) {
        refreshSessions();
      }
    } else {
      _screen = AppRouteScreen.welcome;
    }
    notifyListeners();
  }

  void navigateTo(AppRouteScreen next) {
    _screen = next;
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _themeMode =
        _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('busbridge_dark', _themeMode == ThemeMode.dark);
    notifyListeners();
  }

  Future<void> updateSettings({
    bool? shareName,
    int? updateIntervalMs,
    bool? trafficLayerEnabled,
    bool? arrivalAlertsEnabled,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (shareName != null) {
      _shareName = shareName;
      await prefs.setBool('busbridge_share_name', shareName);
      if (_currentPassenger != null) {
        _ws.sendStatusUpdate(
          status: _currentPassenger!.passengerStatus,
          shareName: shareName,
        );
      }
    }
    if (updateIntervalMs != null) {
      _updateIntervalMs = updateIntervalMs;
      await prefs.setInt('busbridge_interval_ms', updateIntervalMs);
      if (_currentPassenger?.passengerStatus ==
          PassengerStatus.onboardSharing) {
        _startOnboardGpsWatch();
      }
    }
    if (trafficLayerEnabled != null) {
      _trafficLayerEnabled = trafficLayerEnabled;
      await prefs.setBool('busbridge_traffic', trafficLayerEnabled);
    }
    if (arrivalAlertsEnabled != null) {
      _arrivalAlertsEnabled = arrivalAlertsEnabled;
      await prefs.setBool('busbridge_alerts', arrivalAlertsEnabled);
    }
    notifyListeners();
  }

  Future<void> saveProfile(String name, {bool? shareName}) async {
    final saved = await _api.createOrUpdateUser(name: name.trim(), userId: _userId);
    _userId = saved.id;
    _userName = saved.name;
    if (shareName != null) _shareName = shareName;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('busbridge_user_id', saved.id);
    await prefs.setString('busbridge_user_name', saved.name);
    await prefs.setBool('busbridge_share_name', _shareName);
    notifyListeners();
  }

  Future<bool> requestLocationAccess() async {
    _locationError = null;
    final granted = await _location.requestPermission();
    _hasLocationPermission = granted;
    if (granted) {
      try {
        _myLocation = await _location.getCurrentPosition();
      } catch (e) {
        _locationError = e.toString();
      }
    } else {
      _locationError =
          'Location permission is required for live GPS sharing and distance estimates.';
    }
    notifyListeners();
    return granted;
  }

  Future<void> refreshCurrentLocation() async {
    try {
      final sample = await _location.getCurrentPosition();
      if (sample != null) {
        _myLocation = sample;
        _locationError = null;
        if (_currentPassenger != null &&
            (_currentPassenger!.passengerStatus == PassengerStatus.waiting ||
                _currentPassenger!.passengerStatus ==
                    PassengerStatus.onboardSharing)) {
          _ws.sendLocationUpdate(
            latitude: sample.latitude,
            longitude: sample.longitude,
            accuracy: sample.accuracy,
            heading: sample.heading,
            speed: sample.speed,
            isSharing: true,
            timestamp: sample.timestamp,
          );
        }
        notifyListeners();
      }
    } catch (e) {
      _locationError = e.toString();
      notifyListeners();
    }
  }

  void setManualWaitingPin(double lat, double lng) {
    _myLocation = GpsSample(
      latitude: lat,
      longitude: lng,
      accuracy: 15.0,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );
    if (_currentPassenger?.passengerStatus == PassengerStatus.waiting) {
      _ws.sendLocationUpdate(
        latitude: lat,
        longitude: lng,
        accuracy: 15.0,
        isSharing: true,
      );
    }
    notifyListeners();
  }

  Future<void> refreshSessions() async {
    _loadingSessions = true;
    notifyListeners();
    try {
      _availableSessions = await _api.listSessions();
    } finally {
      _loadingSessions = false;
      notifyListeners();
    }
  }

  Future<void> joinBusSession(String codeOrId) async {
    if (_userId == null) throw Exception('Please enter your name first.');
    final joined = await _api.joinSession(
      codeOrId: codeOrId,
      userId: _userId!,
      shareName: _shareName,
    );
    _currentPassenger = joined.passenger;
    _snapshot = joined.snapshot;
    _recentEvents.clear();
    _busApproachingAlert = false;
    _screen = AppRouteScreen.tracking;
    _ws.connect(
      sessionId: joined.snapshot.session.id,
      passengerId: joined.passenger.id,
    );
    if (_myLocation != null) {
      _ws.sendLocationUpdate(
        latitude: _myLocation!.latitude,
        longitude: _myLocation!.longitude,
        accuracy: _myLocation!.accuracy,
        heading: _myLocation!.heading,
        speed: _myLocation!.speed,
        isSharing: true,
        timestamp: _myLocation!.timestamp,
      );
    }
    notifyListeners();
  }

  Future<void> createAndJoinSession({
    required String sessionName,
    required String routeName,
  }) async {
    final created = await _api.createSession(
      sessionName: sessionName,
      routeName: routeName,
      originLat: _myLocation?.latitude,
      originLng: _myLocation?.longitude,
    );
    await joinBusSession(created.id);
  }

  Future<void> boardBusAndStartSharing() async {
    if (_currentPassenger == null) return;
    if (!_hasLocationPermission) {
      await requestLocationAccess();
    }
    _currentPassenger = _currentPassenger!.copyWith(
      passengerStatus: PassengerStatus.onboardSharing,
    );
    _ws.sendStatusUpdate(
      status: PassengerStatus.onboardSharing,
      shareName: _shareName,
    );

    final sample = await _location.getCurrentPosition();
    if (sample != null) {
      _myLocation = sample;
      _ws.sendLocationUpdate(
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: sample.accuracy,
        heading: sample.heading,
        speed: sample.speed,
        isSharing: true,
        timestamp: sample.timestamp,
      );
    }
    _startOnboardGpsWatch();
    notifyListeners();
  }

  void pauseSharing() {
    _location.stopWatching();
    if (_currentPassenger == null) return;
    _currentPassenger = _currentPassenger!.copyWith(
      passengerStatus: PassengerStatus.onboardNotSharing,
    );
    _ws.sendStatusUpdate(
      status: PassengerStatus.onboardNotSharing,
      shareName: _shareName,
    );
    notifyListeners();
  }

  void resumeSharing() {
    if (_currentPassenger == null) return;
    _currentPassenger = _currentPassenger!.copyWith(
      passengerStatus: PassengerStatus.onboardSharing,
    );
    _ws.sendStatusUpdate(
      status: PassengerStatus.onboardSharing,
      shareName: _shareName,
    );
    _startOnboardGpsWatch();
    notifyListeners();
  }

  void markReachedDestination() {
    _location.stopWatching();
    if (_currentPassenger == null) return;
    _currentPassenger = _currentPassenger!.copyWith(
      passengerStatus: PassengerStatus.reachedDestination,
    );
    _ws.sendStatusUpdate(
      status: PassengerStatus.reachedDestination,
      shareName: _shareName,
    );
    notifyListeners();
  }

  void returnToWaiting() {
    _location.stopWatching();
    if (_currentPassenger == null) return;
    _currentPassenger = _currentPassenger!.copyWith(
      passengerStatus: PassengerStatus.waiting,
    );
    _ws.sendStatusUpdate(
      status: PassengerStatus.waiting,
      shareName: _shareName,
    );
    notifyListeners();
  }

  void leaveSession() {
    _location.stopWatching();
    if (_currentPassenger != null) {
      _ws.sendStatusUpdate(
        status: PassengerStatus.reachedDestination,
        shareName: _shareName,
      );
    }
    _ws.disconnect();
    _currentPassenger = null;
    _snapshot = null;
    _busApproachingAlert = false;
    _screen = AppRouteScreen.joinBus;
    refreshSessions();
    notifyListeners();
  }

  void _startOnboardGpsWatch() {
    _location.startWatching(
      intervalMs: _updateIntervalMs,
      onSample: (sample) {
        _myLocation = sample;
        _ws.sendLocationUpdate(
          latitude: sample.latitude,
          longitude: sample.longitude,
          accuracy: sample.accuracy,
          heading: sample.heading,
          speed: sample.speed,
          isSharing: true,
          timestamp: sample.timestamp,
        );
        notifyListeners();
      },
      onError: (err) {
        _locationError = err;
        notifyListeners();
      },
    );
  }

  void _onWsState(WsConnectionState state) {
    _wsState = state;
    notifyListeners();
  }

  void _onSnapshot(SessionSnapshot snap) {
    _snapshot = snap;
    if (_currentPassenger != null) {
      for (final p in snap.passengers) {
        if (p.id == _currentPassenger!.id) {
          _currentPassenger = p;
          break;
        }
      }
    }

    // Evaluate 500m approaching alert for waiting passengers
    final bus = snap.aggregatedBus;
    final myLat = _myLocation?.latitude ?? _currentPassenger?.location?.latitude;
    final myLng = _myLocation?.longitude ?? _currentPassenger?.location?.longitude;
    if (_arrivalAlertsEnabled &&
        _currentPassenger?.passengerStatus == PassengerStatus.waiting &&
        bus != null &&
        myLat != null &&
        myLng != null) {
      final dist = haversineMeters(bus.latitude, bus.longitude, myLat, myLng);
      _busApproachingAlert = dist <= 500.0;
    } else {
      _busApproachingAlert = false;
    }

    notifyListeners();
  }

  void _onSessionEvent(SessionEventItem evt) {
    _recentEvents.insert(0, evt);
    if (_recentEvents.length > 6) {
      _recentEvents.removeLast();
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _location.stopWatching();
    _ws.disconnect();
    super.dispose();
  }
}
