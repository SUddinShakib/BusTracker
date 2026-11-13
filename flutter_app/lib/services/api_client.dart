import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/bus_models.dart';

class ApiClient {
  ApiClient({String? baseUrl})
      : baseUrl = (baseUrl ??
                const String.fromEnvironment(
                  'API_BASE_URL',
                  defaultValue:
                      'https://ais-pre-c7ugv464xfe3kpav4ryxro-193513859415.asia-east1.run.app',
                ))
            .replaceAll(RegExp(r'/+$'), '');

  final String baseUrl;

  Future<({String id, String name})> createOrUpdateUser({
    required String name,
    String? userId,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/users'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
        if (userId != null) 'userId': userId,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Failed to save profile (${res.statusCode})');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (
      id: data['id'].toString(),
      name: data['name'].toString(),
    );
  }

  Future<List<BusSession>> listSessions() async {
    final res = await http.get(Uri.parse('$baseUrl/api/sessions'));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Unable to fetch sessions (${res.statusCode})');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final list = data['sessions'] as List<dynamic>? ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(BusSession.fromJson)
        .toList();
  }

  Future<BusSession> createSession({
    required String sessionName,
    required String routeName,
    double? originLat,
    double? originLng,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/sessions'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'sessionName': sessionName,
        'routeName': routeName,
        if (originLat != null) 'originLat': originLat,
        if (originLng != null) 'originLng': originLng,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Failed to create bus session (${res.statusCode})');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return BusSession.fromJson(data['session'] as Map<String, dynamic>);
  }

  Future<({Passenger passenger, SessionSnapshot snapshot})> joinSession({
    required String codeOrId,
    required String userId,
    required bool shareName,
    PassengerStatus initialStatus = PassengerStatus.waiting,
  }) async {
    final encoded = Uri.encodeComponent(codeOrId.trim());
    final res = await http.post(
      Uri.parse('$baseUrl/api/sessions/$encoded/join'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'shareName': shareName,
        'initialStatus': initialStatus.wireValue,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      String message = 'Could not join bus session.';
      try {
        final err = jsonDecode(res.body) as Map<String, dynamic>;
        if (err['error'] != null) message = err['error'].toString();
      } catch (_) {}
      throw Exception(message);
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (
      passenger: Passenger.fromJson(data['passenger'] as Map<String, dynamic>),
      snapshot: SessionSnapshot.fromJson(
        data['snapshot'] as Map<String, dynamic>,
      ),
    );
  }
}
