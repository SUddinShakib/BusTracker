import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/bus_models.dart';

enum WsConnectionState { disconnected, connecting, connected }

class RealtimeWsService {
  RealtimeWsService({required this.baseHttpUrl});

  final String baseHttpUrl;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  Timer? _pingTimer;

  String? _sessionId;
  String? _passengerId;
  bool _disposed = false;

  void Function(WsConnectionState state)? onConnectionState;
  void Function(SessionSnapshot snapshot)? onSnapshot;
  void Function(SessionEventItem event)? onEvent;

  Uri _buildWsUri() {
    final uri = Uri.parse(baseHttpUrl);
    final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return uri.replace(scheme: scheme, path: '/ws', query: null);
  }

  void connect({required String sessionId, required String passengerId}) {
    _sessionId = sessionId;
    _passengerId = passengerId;
    _disposed = false;
    _openSocket();
  }

  void _openSocket() {
    if (_disposed || _sessionId == null || _passengerId == null) return;
    _cleanupSocket();

    onConnectionState?.call(WsConnectionState.connecting);
    try {
      final channel = WebSocketChannel.connect(_buildWsUri());
      _channel = channel;
      onConnectionState?.call(WsConnectionState.connected);

      sendJson({
        'type': 'session:join',
        'sessionId': _sessionId,
        'passengerId': _passengerId,
      });

      _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) {
        sendJson({'type': 'ping'});
      });

      _subscription = channel.stream.listen(
        (raw) {
          try {
            final msg = jsonDecode(raw.toString()) as Map<String, dynamic>;
            final type = msg['type']?.toString();
            if (type == 'session:state' && msg['payload'] is Map<String, dynamic>) {
              final snap = SessionSnapshot.fromJson(
                msg['payload'] as Map<String, dynamic>,
              );
              onSnapshot?.call(snap);
            } else if (type == 'session:event') {
              final evt = msg['event']?.toString() ?? '';
              final name = msg['displayName']?.toString() ?? 'A rider';
              final ts = (msg['timestamp'] as num?)?.toInt() ??
                  DateTime.now().millisecondsSinceEpoch;
              final text = switch (evt) {
                'passenger_boarded' => '$name boarded and started sharing GPS',
                'passenger_waiting' => '$name is waiting at a stop',
                'passenger_reached' => '$name reached their destination',
                'sharing_paused' => '$name paused GPS sharing',
                'passenger_disconnected' => '$name lost connection',
                _ => '$name updated status',
              };
              onEvent?.call(
                SessionEventItem(
                  id: '${ts}_${msg['passengerId'] ?? ''}',
                  message: text,
                  timestamp: ts,
                ),
              );
            }
          } catch (_) {}
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    onConnectionState?.call(WsConnectionState.disconnected);
    _cleanupSocket();
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _openSocket);
  }

  void sendJson(Map<String, dynamic> payload) {
    try {
      _channel?.sink.add(jsonEncode(payload));
    } catch (_) {}
  }

  void sendStatusUpdate({
    required PassengerStatus status,
    required bool shareName,
  }) {
    if (_sessionId == null || _passengerId == null) return;
    sendJson({
      'type': 'status:update',
      'sessionId': _sessionId,
      'passengerId': _passengerId,
      'passengerStatus': status.wireValue,
      'shareName': shareName,
    });
  }

  void sendLocationUpdate({
    required double latitude,
    required double longitude,
    required double accuracy,
    double? heading,
    double? speed,
    required bool isSharing,
    int? timestamp,
  }) {
    if (_sessionId == null || _passengerId == null) return;
    sendJson({
      'type': 'location:update',
      'sessionId': _sessionId,
      'passengerId': _passengerId,
      'latitude': latitude,
      'longitude': longitude,
      'accuracy': accuracy,
      'heading': heading,
      'speed': speed,
      'isSharing': isSharing,
      'timestamp': timestamp ?? DateTime.now().millisecondsSinceEpoch,
    });
  }

  void _cleanupSocket() {
    _pingTimer?.cancel();
    _pingTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
  }

  void disconnect() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _cleanupSocket();
    onConnectionState?.call(WsConnectionState.disconnected);
  }
}
