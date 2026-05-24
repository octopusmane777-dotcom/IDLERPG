import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ProgressBarProps {
  current: number;
  max: number;
  color?: string;
  bgColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  max,
  color = '#8257e5',
  bgColor = '#333',
}) => {
  const pct = max > 0 ? Math.min(current / max, 1) : 0;
  return (
    <View style={[styles.bar, { backgroundColor: bgColor }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${(pct * 100).toFixed(0)}%` as any,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 4,
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
});