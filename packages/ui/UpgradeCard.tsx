import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ProgressBar } from './ProgressBar';

interface UpgradeCardProps {
  title: string;
  description?: string;
  cost: number;
  currentGold: number;
  canAfford: boolean;
  onPress: () => void;
  buttonLabel: string;
  disabledLabel?: string;
  accessibilityLabel: string;
}

export const UpgradeCard: React.FC<UpgradeCardProps> = ({
  title,
  description,
  cost,
  currentGold,
  canAfford,
  onPress,
  buttonLabel,
  disabledLabel,
  accessibilityLabel,
}) => {
  const need = Math.max(0, cost - currentGold);
  const affordanceText = canAfford
    ? `${cost} compute (affordable)`
    : `${cost} compute (need ${need.toFixed(1)} more)`;

  return (
    <View style={styles.card}>
      <Text style={styles.label} accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text style={styles.small}>{description}</Text> : null}
      <ProgressBar current={currentGold} max={Math.max(currentGold, cost)} />
      <Text style={styles.value} accessibilityLabel={`Cost: ${cost} compute`}>
        {cost} compute
      </Text>
      <Text style={[styles.affordance, canAfford && styles.affordable]}>
        {affordanceText}
      </Text>
      <Pressable
        style={[styles.button, !canAfford && styles.buttonDisabled]}
        onPress={onPress}
        disabled={!canAfford}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !canAfford }}
      >
        <Text style={styles.buttonText}>
          {canAfford ? buttonLabel : (disabledLabel || 'Need more compute')}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1d1d22',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    marginTop: 10,
  },
  label: {
    color: '#8f8f9d',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  small: {
    color: '#b3b3b8',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  value: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginVertical: 6,
  },
  button: {
    backgroundColor: '#8257e5',
    padding: 15,
    borderRadius: 8,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  affordance: {
    color: '#8f8f9d',
    fontSize: 11,
  },
  affordable: {
    color: '#04d361',
  },
});