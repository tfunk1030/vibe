/**
 * Toast Notification System - Obsidian Arcade
 *
 * Slide-in notifications with glass effect styling.
 */

import React, { useEffect, createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, AlertCircle, Info, X } from 'lucide-react-native';
import { BodyText, Caption } from './Typography';
import { obsidianDark, radius, springs, timing } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==========================================
// Types
// ==========================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  hideToast: (id: string) => void;
}

// ==========================================
// Context
// ==========================================

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ==========================================
// Toast Item Component
// ==========================================

const toastConfig: Record<ToastType, { icon: typeof Check; color: string; bgColor: string }> = {
  success: {
    icon: Check,
    color: obsidianDark.accent.success,
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
  error: {
    icon: X,
    color: obsidianDark.accent.danger,
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
  warning: {
    icon: AlertCircle,
    color: obsidianDark.accent.warning,
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  info: {
    icon: Info,
    color: obsidianDark.accent.cyan,
    bgColor: 'rgba(6, 182, 212, 0.15)',
  },
};

interface ToastItemProps {
  toast: ToastData;
  onHide: (id: string) => void;
}

function ToastItem({ toast, onHide }: ToastItemProps) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const config = toastConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    // Animate in
    translateY.value = withSpring(0, springs.smooth);
    opacity.value = withTiming(1, { duration: timing.fast });

    // Haptic feedback
    if (toast.type === 'success') {
      hapticPatterns.success();
    } else if (toast.type === 'error') {
      hapticPatterns.error();
    } else {
      hapticPatterns.lightTap();
    }

    // Auto dismiss
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      translateY.value = withSpring(-100, springs.smooth);
      opacity.value = withTiming(0, { duration: timing.fast }, () => {
        runOnJS(onHide)(toast.id);
      });
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.toastContainer, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: config.bgColor }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.toastContent}>
          <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
            <Icon size={16} color="#fff" strokeWidth={2.5} />
          </View>

          <View style={styles.textContainer}>
            <BodyText style={{ color: obsidianDark.text.primary, fontWeight: '600' }}>
              {toast.title}
            </BodyText>
            {toast.message && (
              <Caption style={{ color: obsidianDark.text.secondary, marginTop: 2 }}>
                {toast.message}
              </Caption>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ==========================================
// Toast Provider
// ==========================================

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}

      {/* Toast Container */}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onHide={hideToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    width: '100%',
    maxWidth: SCREEN_WIDTH - 32,
    marginBottom: 8,
  },
  toast: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
});

// ==========================================
// Helper function for quick toasts
// ==========================================

export const toast = {
  success: (title: string, message?: string) => ({
    type: 'success' as const,
    title,
    message,
  }),
  error: (title: string, message?: string) => ({
    type: 'error' as const,
    title,
    message,
  }),
  warning: (title: string, message?: string) => ({
    type: 'warning' as const,
    title,
    message,
  }),
  info: (title: string, message?: string) => ({
    type: 'info' as const,
    title,
    message,
  }),
};
