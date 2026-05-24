import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface PluginToggleProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}

export const PluginToggle: React.FC<PluginToggleProps> = ({
  label,
  enabled,
  onToggle,
  accessibilityLabel,
}) => (
  <Pressable
    style={[styles.btn, enabled ? styles.active : styles.inactive]}
    onPress={onToggle}
    accessibilityRole="switch"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ selected: enabled }}
  >
    <Text style={styles.text}>
      {label} {enabled ? '(ON)' : '(OFF)'}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  active: {
    backgroundColor: '#04d361',
  },
  inactive: {
    backgroundColor: '#333',
  },
  text: {
    fontWeight: 'bold',
    color: '#fff',
  },
});