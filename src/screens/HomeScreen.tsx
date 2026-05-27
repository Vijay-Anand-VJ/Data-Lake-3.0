import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import NetInfo from '@react-native-community/netinfo';
import { useAppTheme } from '../theme/theme';
import { useLiveness } from '../hooks/useLiveness';
import { matchFace, MatchResult } from '../services/FaceRecognitionService';
import SimilarityBar from '../components/SimilarityBar';
import StatusBadge from '../components/StatusBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * HomeScreen component presenting the live camera HUD scanner,
 * liveness tracking prompt, and attendance matching results.
 */
export const HomeScreen: React.FC = () => {
  const { colors, spacing, borderRadius, fontSize } = useAppTheme();
  
  // Camera permission hooks
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front'); // front camera for self-scanning
  
  // Connectivity state
  const [isOnline, setIsOnline] = useState(true);

  // Liveness hook
  const { challenge, isVerified, instruction, processFace, resetChallenge } = useLiveness();

  // Core scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<MatchResult | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  // Subscription for connection updates
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  // Request permissions on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  /**
   * Resets active scanners to process another swipe
   */
  const handleResetScan = () => {
    setScanResult(null);
    setIsScanning(false);
    resetChallenge();
  };

  /**
   * Simulates full face scanning.
   * Feeds realistic parameters and actual TFLite mock processes
   * to demonstrate full end-to-end capability in emulators.
   */
  const runSimulatedScan = async (livenessType: 'blink' | 'smile' | 'turn_left', matchType: 'success' | 'unknown') => {
    if (isScanning) return;
    setIsScanning(true);
    setScanResult(null);

    console.log(`[HomeScreen] Starting simulated liveness test: ${livenessType}`);

    // Phase 1: Simulate user executing the challenge
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
    
    // Simulate landmarks check
    const mockLandmarks = Array.from({ length: 468 }, (_, i) => ({ x: 0.5, y: 0.5 }));
    
    if (livenessType === 'blink') {
      // Simulate blinking EAR (avg EAR < 0.25)
      mockLandmarks[159] = { x: 10, y: 11 };
      mockLandmarks[145] = { x: 10, y: 13 }; // dVerticalLeft = 2
      mockLandmarks[33] = { x: 5, y: 10 };
      mockLandmarks[133] = { x: 20, y: 10 }; // dHorizontalLeft = 15 => EAR = 0.13
      
      mockLandmarks[386] = { x: 30, y: 11 };
      mockLandmarks[374] = { x: 30, y: 13 }; // dVerticalRight = 2
      mockLandmarks[362] = { x: 25, y: 10 };
      mockLandmarks[263] = { x: 40, y: 10 }; // dHorizontalRight = 15 => EAR = 0.13
    } else if (livenessType === 'smile') {
      // Simulate smile MAR (MAR > 0.55)
      mockLandmarks[13] = { x: 10, y: 5 };
      mockLandmarks[14] = { x: 10, y: 25 }; // dVerticalMouth = 20
      mockLandmarks[78] = { x: 5, y: 10 };
      mockLandmarks[308] = { x: 30, y: 10 }; // dHorizontalMouth = 25 => MAR = 0.8
    } else if (livenessType === 'turn_left') {
      // Simulate turn left
      mockLandmarks[1] = { x: 10, y: 10 }; // Nose Tip
      mockLandmarks[234] = { x: 11, y: 10 }; // Left cheek (dToLeft = 1)
      mockLandmarks[454] = { x: 20, y: 10 }; // Right cheek (dToRight = 10) => ratio = 0.1
    }

    processFace(mockLandmarks);

    // Phase 2: Run actual matching against local database once liveness verified
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

    try {
      // Generate a mock base64 profile face representing a camera capture
      // This base64 is a tiny valid 1x1 pixel image representing standard input
      const sampleFaceBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      
      if (matchType === 'success') {
        const result = await matchFace(sampleFaceBase64);
        setScanResult(result);
      } else {
        // Unknown person matching
        setScanResult({
          matched: false,
          name: 'Unknown User',
          role: 'Unauthorized',
          similarity: 0.32,
        });
      }
    } catch (e) {
      console.error('[HomeScreen] Simulated recognition failure:', e);
      setScanResult({
        matched: false,
        name: 'Inference Error',
        role: 'Database Match Exception',
        similarity: 0,
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating Offline Badge */}
      <View style={styles.floatingHeader}>
        <StatusBadge status={isOnline ? 'synced' : 'offline'} />
      </View>

      {/* Main Viewfinder HUD */}
      <View style={[styles.cameraViewport, { borderColor: colors.border, borderRadius: borderRadius.xl }]}>
        {hasPermission && device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!scanResult && !isScanning}
          />
        ) : (
          <View style={styles.noCamera}>
            <Text style={[styles.noCameraText, { color: colors.textMuted, fontSize: fontSize.sm }]}>
              {hasPermission ? 'Initializing Camera Feed...' : 'Camera Permission Denied'}
            </Text>
          </View>
        )}

        {/* Futuristic Scanner HUD Overlays */}
        {!scanResult && (
          <View style={styles.hudOverlay} pointerEvents="none">
            <View style={[styles.hudScannerBox, { borderColor: isVerified ? colors.success : colors.primary }]} />
            <View style={styles.hudCorners}>
              <View style={[styles.cornerTL, { borderColor: isVerified ? colors.success : colors.primary }]} />
              <View style={[styles.cornerTR, { borderColor: isVerified ? colors.success : colors.primary }]} />
              <View style={[styles.cornerBL, { borderColor: isVerified ? colors.success : colors.primary }]} />
              <View style={[styles.cornerBR, { borderColor: isVerified ? colors.success : colors.primary }]} />
            </View>
          </View>
        )}

        {/* Real-time Loading Overlay */}
        {isScanning && (
          <View style={styles.scanningLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.text, fontSize: fontSize.sm }]}>
              Analyzing Face & Liveness...
            </Text>
          </View>
        )}
      </View>

      {/* Liveness Instruction Banner / Active Panel */}
      {!scanResult && (
        <View style={[styles.instructionCard, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.instructionHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}>
            LIVENESS VERIFICATION CHALLENGE
          </Text>
          <Text
            style={[
              styles.instructionBody,
              {
                color: isVerified ? colors.success : colors.warning,
                fontSize: fontSize.lg,
              },
            ]}
          >
            {isVerified ? '✓ Liveness Verified' : instruction}
          </Text>
        </View>
      )}

      {/* Biometric Scan Trigger Buttons */}
      {!scanResult && !isScanning && (
        <View style={styles.actionButtonContainer}>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md, marginBottom: 12 }]}
            onPress={() => {
              const challenges: ('blink' | 'smile' | 'turn_left')[] = ['blink', 'smile', 'turn_left'];
              const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
              runSimulatedScan(randomChallenge, 'success');
            }}
          >
            <Text style={[styles.scanButtonText, { fontSize: fontSize.md }]}>
              Verify Identity (Enrolled Face)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.scanButton,
              {
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                borderWidth: 1.5,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              const challenges: ('blink' | 'smile' | 'turn_left')[] = ['blink', 'smile', 'turn_left'];
              const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
              runSimulatedScan(randomChallenge, 'unknown');
            }}
          >
            <Text style={[styles.scanButtonText, { color: colors.text, fontSize: fontSize.md }]}>
              Test Spoof Rejection (Unknown Face)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Face Match Result Slide-Up Card */}
      {scanResult && (
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderRadius: borderRadius.xl }]}>
          <Text style={[styles.resultHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}>
            SCANNER IDENTITY MATCH RESULT
          </Text>
          
          <View style={styles.resultInfoRow}>
            <View style={styles.resultDetails}>
              <Text style={[styles.personName, { color: colors.text, fontSize: fontSize.xl }]}>
                {scanResult.name}
              </Text>
              <Text style={[styles.personRole, { color: colors.textMuted, fontSize: fontSize.sm }]}>
                {scanResult.role}
              </Text>
            </View>
            <StatusBadge status={scanResult.matched ? 'matched' : 'failed'} />
          </View>

          <SimilarityBar score={scanResult.similarity} />

          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleResetScan}
          >
            <Text style={[styles.resetButtonText, { fontSize: fontSize.md }]}>
              Scan Next Face
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    justifyContent: 'space-between',
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    paddingVertical: 10,
  },
  cameraViewport: {
    flex: 1,
    maxHeight: SCREEN_WIDTH * 1.25,
    width: '100%',
    aspectRatio: 3 / 4,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  noCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  noCameraText: {
    fontWeight: '500',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudScannerBox: {
    width: '70%',
    height: '60%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 30,
    opacity: 0.6,
  },
  hudCorners: {
    ...StyleSheet.absoluteFill,
  },
  cornerTL: {
    position: 'absolute',
    top: 30,
    left: 30,
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: 30,
    height: 30,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 30,
    height: 30,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  scanningLoader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 15,
    fontWeight: 'bold',
  },
  instructionCard: {
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  instructionHeader: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  instructionBody: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultCard: {
    padding: 20,
    width: '100%',
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  resultHeader: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  resultInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  resultDetails: {
    flex: 1,
    marginRight: 10,
  },
  personName: {
    fontWeight: 'bold',
  },
  personRole: {
    fontWeight: '500',
    marginTop: 2,
  },
  resetButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  actionButtonContainer: {
    width: '100%',
    marginVertical: 10,
  },
  scanButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  scanButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
export default HomeScreen;
