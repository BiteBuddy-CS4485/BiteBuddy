import React from 'react';
import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  latitude: number;
  longitude: number;
  style?: StyleProp<ViewStyle>;
};

export default function SessionMap({ latitude, longitude, style }: Props) {
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#666', textAlign: 'center' }}>
        Map preview is available on iOS/Android
      </Text>
      <Text style={{ color: '#999', marginTop: 4, fontSize: 12 }}>
        ({latitude.toFixed(4)}, {longitude.toFixed(4)})
      </Text>
    </View>
  );
}
