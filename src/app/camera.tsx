import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useMutation } from '@tanstack/react-query';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { X, Camera, RotateCcw, Zap, ZapOff } from 'lucide-react-native';

import { usePuzzleStore } from '@/lib/state/puzzle-store';
import { extractPuzzleFromImage, GridSizeHint } from '@/lib/services/gemini';
import { solvePuzzle } from '@/lib/services/solver';
import { GridSizeHintModal } from '@/components/GridSizeHintModal';
import { useColorScheme } from '@/lib/useColorScheme';

interface ExtractionParams {
  imageUri: string;
  sizeHint?: GridSizeHint;
}

function IconButton({
  onPress,
  icon,
  size = 50,
  accessibilityLabel,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  size?: number;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [showSizeHint, setShowSizeHint] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const setPuzzle = usePuzzleStore((s) => s.setPuzzle);
  const setSolution = usePuzzleStore((s) => s.setSolution);
  const setLoading = usePuzzleStore((s) => s.setLoading);
  const setError = usePuzzleStore((s) => s.setError);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);

  // Extract puzzle mutation
  const extractMutation = useMutation({
    mutationFn: (params: ExtractionParams) =>
      extractPuzzleFromImage(params.imageUri, params.sizeHint),
    onMutate: () => {
      setLoading(true);
      setError(null);
    },
    onSuccess: (puzzleData) => {
      setPuzzle(puzzleData);
      const sol = solvePuzzle(puzzleData);
      setSolution(sol);
      if (!sol.isValid) {
        setError(sol.error || 'Could not solve puzzle');
      }
      setLoading(false);
      router.back();
    },
    onError: (err: Error) => {
      setError(err.message);
      setLoading(false);
      router.back();
    },
  });

  const { mutate: extractPuzzle, isPending } = extractMutation;

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isPending) return;

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });

    if (photo?.uri) {
      setCapturedUri(photo.uri);
      setImageUri(photo.uri);
      setShowSizeHint(true);
    }
  }, [isPending, setImageUri]);

  const handleSizeHintConfirm = useCallback(
    (cols: number, rows: number, dominoCount: number) => {
      if (capturedUri) {
        setShowSizeHint(false);
        extractPuzzle({ imageUri: capturedUri, sizeHint: { cols, rows, dominoCount } });
      }
    },
    [capturedUri, extractPuzzle]
  );

  const handleSizeHintSkip = useCallback(() => {
    if (capturedUri) {
      setShowSizeHint(false);
      extractPuzzle({ imageUri: capturedUri });
    }
  }, [capturedUri, extractPuzzle]);

  const handleSizeHintClose = useCallback(() => {
    setShowSizeHint(false);
    setCapturedUri(null);
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    setFlash((prev) => !prev);
  }, []);

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to capture puzzle screenshots
          </Text>
          <Pressable onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash ? 'on' : 'off'}
      >
        {/* Overlay UI */}
        <SafeAreaView style={styles.overlay}>
          {/* Top Bar */}
          <Animated.View entering={FadeIn} style={styles.topBar}>
            <IconButton
              onPress={() => router.back()}
              icon={<X size={24} color="#fff" />}
              accessibilityLabel="Close camera"
            />
            <Text style={styles.title}>Capture Puzzle</Text>
            <IconButton
              onPress={toggleFlash}
              icon={
                flash ? (
                  <Zap size={24} color="#FFD700" />
                ) : (
                  <ZapOff size={24} color="#fff" />
                )
              }
              accessibilityLabel={flash ? "Turn flash off" : "Turn flash on"}
            />
          </Animated.View>

          {/* Guide Frame */}
          <View style={styles.guideContainer}>
            <View style={styles.guideFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>
              Position the puzzle within the frame
            </Text>
          </View>

          {/* Bottom Bar */}
          <Animated.View entering={FadeIn.delay(100)} style={styles.bottomBar}>
            <IconButton
              onPress={toggleFacing}
              icon={<RotateCcw size={24} color="#fff" />}
              accessibilityLabel="Switch camera"
            />
            <Pressable
              onPress={handleCapture}
              disabled={isPending}
              style={[
                styles.captureButton,
                isPending && styles.captureButtonDisabled,
              ]}
              accessibilityLabel={isPending ? "Processing photo" : "Take photo"}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
            >
              <View style={styles.captureButtonInner}>
                {isPending ? (
                  <Text style={styles.processingText}>...</Text>
                ) : (
                  <Camera size={32} color="#000" />
                )}
              </View>
            </Pressable>
            <View style={{ width: 50 }} />
          </Animated.View>
        </SafeAreaView>
      </CameraView>

      {/* Grid Size Hint Modal */}
      <GridSizeHintModal
        visible={showSizeHint}
        onConfirm={handleSizeHintConfirm}
        onSkip={handleSizeHintSkip}
        onClose={handleSizeHintClose}
        isDark={isDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  guideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  guideText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  processingText: {
    fontSize: 24,
    color: '#000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
});
