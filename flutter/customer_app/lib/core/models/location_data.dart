import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Location data model for the app
class LocationData {
  final String address;
  final String? subAddress;
  final double latitude;
  final double longitude;
  final String? placeId;
  final String? type;

  const LocationData({
    required this.address,
    this.subAddress,
    required this.latitude,
    required this.longitude,
    this.placeId,
    this.type,
  });

  /// Get LatLng for Google Maps
  LatLng get latLng => LatLng(latitude, longitude);

  factory LocationData.fromJson(Map<String, dynamic> json) {
    return LocationData(
      address: json['address'] ?? '',
      subAddress: json['subAddress'],
      latitude: (json['latitude'] ?? 0.0).toDouble(),
      longitude: (json['longitude'] ?? 0.0).toDouble(),
      placeId: json['placeId'],
      type: json['type'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'address': address,
      'subAddress': subAddress,
      'latitude': latitude,
      'longitude': longitude,
      'placeId': placeId,
      'type': type,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LocationData &&
        other.address == address &&
        other.subAddress == subAddress &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.placeId == placeId &&
        other.type == type;
  }

  @override
  int get hashCode {
    return address.hashCode ^
        subAddress.hashCode ^
        latitude.hashCode ^
        longitude.hashCode ^
        placeId.hashCode ^
        type.hashCode;
  }

  @override
  String toString() {
    return 'LocationData(address: $address, subAddress: $subAddress, lat: $latitude, lng: $longitude)';
  }

  LocationData copyWith({
    String? address,
    String? subAddress,
    double? latitude,
    double? longitude,
    String? placeId,
    String? type,
  }) {
    return LocationData(
      address: address ?? this.address,
      subAddress: subAddress ?? this.subAddress,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      placeId: placeId ?? this.placeId,
      type: type ?? this.type,
    );
  }
}
