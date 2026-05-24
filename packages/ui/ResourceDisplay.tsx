import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ResourceDisplayProps {
  label: string;
  value: number;
  perSecond?: number;
  color?: string;
}

export const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  label,
  value,
  perSecond,
  color = '#fff',
}) => (
  <View style={styles.container}>
    <Text style={[styles.value, { color }]}>
      {value.toFixed(2)}
    </Text>
    <Text style={styles.label}>{label}</Text>
    {perSecond !== undefined && (
      <Text style={styles.rate}>{perSecond.toFixed(1)}/sec</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  label: {
    color: '#8f8f9d',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rate: {
    color: '#b3b3b8',
    fontSize: 13,
    marginTop: 2,
  },
});