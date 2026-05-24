import React, { useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

interface ToastState {
  message: string | null;
}

export interface ToastControls {
  showMessage: (msg: string, ms?: number) => void;
  ToastComponent: React.FC;
}

export function useToast(): ToastControls {
  const [state, setState] = useState<ToastState>({ message: null });
  const opacity = useRef(new Animated.Value(0)).current;

  const showMessage = useCallback((msg: string, ms = 2000) => {
    setState({ message: msg });
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(ms - 300),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setState({ message: null }));
  }, [opacity]);

  const ToastComponent: React.FC = () => {
    if (!state.message) return null;
    return (
      <Animated.View style={[styles.toast, { opacity }]}>
        <Text style={styles.toastText}>{state.message}</Text>
      </Animated.View>
    );
  };

  return { showMessage, ToastComponent };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toastText: {
    color: '#ffd700',
    fontWeight: '700',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
