import React from 'react';
import MapView, { Marker } from 'react-native-maps';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  latitude: number;
  longitude: number;
  style?: StyleProp<ViewStyle>;
};

export default function SessionMap({ latitude, longitude, style }: Props) {
  return (
    <MapView
      style={style}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      pointerEvents="none"
    >
      <Marker coordinate={{ latitude, longitude }} />
    </MapView>
  );
}
