import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-platform shadow that avoids "shadow*" deprecation warnings on web.
 * Usage: ...shadow(0, 1, 3, 0.06)
 */
export function shadow(
  x: number,
  y: number,
  blur: number,
  opacity: number,
  color = '#000',
  elevation = Math.round(blur / 2),
): ViewStyle {
  if (Platform.OS === 'web') {
    const r = parseInt(color.slice(1, 3) || '0', 16);
    const g = parseInt(color.slice(3, 5) || '0', 16);
    const b = parseInt(color.slice(5, 7) || '0', 16);
    return { boxShadow: `${x}px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity})` } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  };
}
