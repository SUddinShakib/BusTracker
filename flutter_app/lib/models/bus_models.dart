enum PassengerStatus {
  waiting('waiting', 'Waiting'),
  onboardSharing('onboard_sharing', 'On Board – Sharing'),
  onboardNotSharing('onboard_not_sharing', 'On Board – Paused'),
  reachedDestination('reached_destination', 'Reached Destination'),
  disconnected('disconnected', 'Disconnected');

  const PassengerStatus(this.wireValue, this.label);
  final String wireValue;
  final String label;

  static PassengerStatus fromWire(String? value) {
    return PassengerStatus.values.firstWhere(
      (s) => s.wireValue == value,
      orElse: () => PassengerStatus.waiting,
    );
  }
}

enum ConfidenceLabel {
  multiSignal('multi_signal', 'Multi-Rider Verified'),
  singleSignal('single_signal', 'Single-Rider Signal'),
  lowConfidence('low_confidence', 'Low Confidence GPS'),
  noSignal('no_signal', 'Awaiting Onboard GPS');

  const ConfidenceLabel(this.wireValue, this.label);
  final String wireValue;
  final String label;

  static ConfidenceLabel fromWire(String? value) {
    return ConfidenceLabel.values.firstWhere(
      (s) => s.wireValue == value,
      orElse: () => ConfidenceLabel.noSignal,
    );
  }
}

class RouteStop {
  const RouteStop({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.order,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final int order;

  factory RouteStop.fromJson(Map<String, dynamic> json) {
    return RouteStop(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Stop',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );
  }
}

class BusSession {
  const BusSession({
    required this.id,
    required this.sessionCode,
    required this.sessionName,
    required this.routeName,
    required this.stops,
    required this.createdAt,
    required this.expiresAt,
    required this.status,
    this.waitingCount = 0,
    this.onboardCount = 0,
    this.sharingCount = 0,
  });

  final String id;
  final String sessionCode;
  final String sessionName;
  final String routeName;
  final List<RouteStop> stops;
  final int createdAt;
  final int expiresAt;
  final String status;
  final int waitingCount;
  final int onboardCount;
  final int sharingCount;

  factory BusSession.fromJson(Map<String, dynamic> json) {
    final stopsJson = json['stops'] as List<dynamic>? ?? const [];
    return BusSession(
      id: json['id']?.toString() ?? '',
      sessionCode: json['sessionCode']?.toString() ?? '',
      sessionName: json['sessionName']?.toString() ?? 'Bus Session',
      routeName: json['routeName']?.toString() ?? 'Route',
      stops: stopsJson
          .whereType<Map<String, dynamic>>()
          .map(RouteStop.fromJson)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order)),
      createdAt: (json['createdAt'] as num?)?.toInt() ?? 0,
      expiresAt: (json['expiresAt'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'active',
      waitingCount: (json['waitingCount'] as num?)?.toInt() ?? 0,
      onboardCount: (json['onboardCount'] as num?)?.toInt() ?? 0,
      sharingCount: (json['sharingCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class PassengerLocation {
  const PassengerLocation({
    required this.id,
    required this.passengerId,
    required this.sessionId,
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.heading,
    this.speed,
    required this.timestamp,
    required this.isSharing,
  });

  final String id;
  final String passengerId;
  final String sessionId;
  final double latitude;
  final double longitude;
  final double accuracy;
  final double? heading;
  final double? speed;
  final int timestamp;
  final bool isSharing;

  factory PassengerLocation.fromJson(Map<String, dynamic> json) {
    return PassengerLocation(
      id: json['id']?.toString() ?? '',
      passengerId: json['passengerId']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? '',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 20.0,
      heading: (json['heading'] as num?)?.toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
      isSharing: json['isSharing'] == true,
    );
  }
}

class Passenger {
  const Passenger({
    required this.id,
    required this.userId,
    required this.sessionId,
    required this.displayName,
    required this.shareName,
    required this.passengerStatus,
    required this.joinedAt,
    required this.updatedAt,
    this.location,
  });

  final String id;
  final String userId;
  final String sessionId;
  final String displayName;
  final bool shareName;
  final PassengerStatus passengerStatus;
  final int joinedAt;
  final int updatedAt;
  final PassengerLocation? location;

  Passenger copyWith({
    PassengerStatus? passengerStatus,
    bool? shareName,
    PassengerLocation? location,
  }) {
    return Passenger(
      id: id,
      userId: userId,
      sessionId: sessionId,
      displayName: displayName,
      shareName: shareName ?? this.shareName,
      passengerStatus: passengerStatus ?? this.passengerStatus,
      joinedAt: joinedAt,
      updatedAt: updatedAt,
      location: location ?? this.location,
    );
  }

  factory Passenger.fromJson(Map<String, dynamic> json) {
    final loc = json['location'];
    return Passenger(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Commuter',
      shareName: json['shareName'] != false,
      passengerStatus:
          PassengerStatus.fromWire(json['passengerStatus']?.toString()),
      joinedAt: (json['joinedAt'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updatedAt'] as num?)?.toInt() ?? 0,
      location:
          loc is Map<String, dynamic> ? PassengerLocation.fromJson(loc) : null,
    );
  }
}

class AggregatedBusLocation {
  const AggregatedBusLocation({
    required this.id,
    required this.sessionId,
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.heading,
    this.speed,
    required this.activeContributors,
    required this.outliersFiltered,
    required this.confidenceLabel,
    required this.isEstimated,
    required this.timestamp,
  });

  final String id;
  final String sessionId;
  final double latitude;
  final double longitude;
  final int accuracy;
  final double? heading;
  final double? speed;
  final int activeContributors;
  final int outliersFiltered;
  final ConfidenceLabel confidenceLabel;
  final bool isEstimated;
  final int timestamp;

  factory AggregatedBusLocation.fromJson(Map<String, dynamic> json) {
    return AggregatedBusLocation(
      id: json['id']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? '',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accuracy: (json['accuracy'] as num?)?.toInt() ?? 20,
      heading: (json['heading'] as num?)?.toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      activeContributors: (json['activeContributors'] as num?)?.toInt() ?? 0,
      outliersFiltered: (json['outliersFiltered'] as num?)?.toInt() ?? 0,
      confidenceLabel:
          ConfidenceLabel.fromWire(json['confidenceLabel']?.toString()),
      isEstimated: json['isEstimated'] == true,
      timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
    );
  }
}

class SessionSnapshot {
  const SessionSnapshot({
    required this.session,
    required this.passengers,
    this.aggregatedBus,
    required this.serverTime,
  });

  final BusSession session;
  final List<Passenger> passengers;
  final AggregatedBusLocation? aggregatedBus;
  final int serverTime;

  factory SessionSnapshot.fromJson(Map<String, dynamic> json) {
    final passengersList = json['passengers'] as List<dynamic>? ?? const [];
    final busJson = json['aggregatedBus'];
    return SessionSnapshot(
      session: BusSession.fromJson(
        json['session'] as Map<String, dynamic>,
      ),
      passengers: passengersList
          .whereType<Map<String, dynamic>>()
          .map(Passenger.fromJson)
          .toList(),
      aggregatedBus: busJson is Map<String, dynamic>
          ? AggregatedBusLocation.fromJson(busJson)
          : null,
      serverTime: (json['serverTime'] as num?)?.toInt() ?? 0,
    );
  }
}

class SessionEventItem {
  const SessionEventItem({
    required this.id,
    required this.message,
    required this.timestamp,
  });

  final String id;
  final String message;
  final int timestamp;
}
