import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';
import { useAppTheme } from '../theme/theme';
import { enrollFace } from '../services/FaceRecognitionService';
import StatusBadge from '../components/StatusBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROLES = ['Employee', 'Administrator', 'Contractor'];

/**
 * EnrollScreen providing user inputs (name, role) and real camera capture
 * to securely record custom biometric face signatures offline.
 */
export const EnrollScreen: React.FC = () => {
  const { colors, spacing, borderRadius, fontSize } = useAppTheme();
  
  // Camera reference & permission states
  const cameraRef = useRef<any>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front'); // front-facing camera for enrollment
  
  // Form input states
  const [name, setName] = useState('');
  const [role, setRole] = useState('Employee');
  
  // Core processing states
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showSuccessCard, setShowSuccessCard] = useState(false);
  const [lastEnrolledUser, setLastEnrolledUser] = useState({ name: '', role: '' });

  // Subscribe to connection updates
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  // Request permissions on mount if missing
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  /**
   * Captures a real photo using Vision Camera,
   * reads file as base64 using react-native-fs,
   * runs TFLite inference to generate a 128D embedding,
   * encrypts it using native AES-256 keys, and registers inside SQLite.
   */
  const handleEnrollSubmit = async () => {
    // 1. Validation Checks
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter employee name before proceeding.');
      return;
    }

    if (!hasPermission) {
      Alert.alert(
        'Permission Blocked',
        'Camera permission is required to capture face signatures. Please enable it in Settings.'
      );
      return;
    }

    if (!cameraRef.current) {
      Alert.alert('Camera Error', 'Camera is not fully initialized. Please wait a moment.');
      return;
    }

    setIsEnrolling(true);
    
    try {
      console.log('[EnrollScreen] Capturing face signature photo...');
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      console.log(`[EnrollScreen] File captured at path: ${photo.path}`);

      // Read physical file from cache directory as Base64 string
      const base64 = await RNFS.readFile(photo.path, 'base64');

      console.log('[EnrollScreen] processing FaceNet and SQLite injection...');
      await enrollFace(name.trim(), role, base64);

      // Save credentials for the success card
      setLastEnrolledUser({ name: name.trim(), role });
      setShowSuccessCard(true);

      // Clean inputs
      setName('');
      setRole('Employee');

      // Asynchronously unlink captured temp photo to conserve user storage
      RNFS.unlink(photo.path).catch(err => {
        console.warn(`[EnrollScreen] Could not unlink temp photo at ${photo.path}:`, err);
      });

    } catch (error: any) {
      console.error('[EnrollScreen] Biometric enrollment failed:', error);
      Alert.alert(
        'Enrollment Exception',
        `Could not save facial signature: ${error.message || error}`
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Floating Network Badge */}
      <View style={styles.floatingHeader}>
        <StatusBadge status={isOnline ? 'synced' : 'offline'} />
      </View>

      <Text style={[styles.mainTitle, { color: colors.text, fontSize: fontSize.xl }]}>
        Biometric Registration
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.sm }]}>
        Securely enroll local facial signatures offline. Data is AES-256 encrypted before local SQLite storage.
      </Text>

      {/* Camera Viewfinder Preview with Circular Face Guide */}
      <View style={[styles.cameraPreviewContainer, { borderColor: colors.border, borderRadius: borderRadius.xl }]}>
        {hasPermission && device ? (
          <Camera
            {...({
              ref: cameraRef,
              style: StyleSheet.absoluteFill,
              device,
              isActive: !showSuccessCard && !isEnrolling,
              photo: true,
            } as any)}
          />
        ) : (
          <View style={styles.noCamera}>
            <Text style={[styles.noCameraText, { color: colors.textMuted, fontSize: fontSize.xs }]}>
              {hasPermission ? 'Loading Front Camera Viewfinder...' : 'Camera Access Blocked'}
            </Text>
            {!hasPermission && (
              <TouchableOpacity
                style={[styles.permissionBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.sm }]}
                onPress={requestPermission}
              >
                <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Futuristic Transparent Circular Alignment Guide */}
        <View style={styles.frameGuide} pointerEvents="none">
          <View style={[styles.circleMask, { borderColor: colors.primary }]} />
        </View>
      </View>

      {/* Enrollment Credentials Form */}
      <View style={[styles.formCard, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: fontSize.xs }]}>
          FULL EMPLOYEE NAME
        </Text>
        <TextInput
          style={[
            styles.inputField,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              fontSize: fontSize.md,
            },
          ]}
          placeholder="e.g. Jane Doe"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          editable={!isEnrolling}
        />

        <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.md }]}>
          ASSIGNED AUTHORIZATION ROLE
        </Text>
        
        {/* Segmented Select Role Picker Row */}
        <View style={styles.rolePickerRow}>
          {ROLES.map(r => {
            const isSelected = role === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rolePickerItem,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                onPress={() => setRole(r)}
                disabled={isEnrolling}
              >
                <Text
                  style={[
                    styles.rolePickerText,
                    {
                      color: isSelected ? '#FFF' : colors.textMuted,
                      fontSize: fontSize.sm,
                    },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isEnrolling ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textMuted, fontSize: fontSize.sm }]}>
              Extracting FaceNet Vectors...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleEnrollSubmit}
          >
            <Text style={[styles.submitButtonText, { fontSize: fontSize.md }]}>
              Register Facial Signature
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Successful Registration Capsule Modal */}
      {showSuccessCard && (
        <View style={[styles.successOverlay, { backgroundColor: colors.card, borderRadius: borderRadius.xl }]}>
          <Text style={[styles.successTitle, { color: colors.success }]}>✓ Registration Complete</Text>
          <Text style={[styles.successBody, { color: colors.text }]}>
            Successfully enrolled biometric face vectors for <Text style={styles.boldText}>{lastEnrolledUser.name}</Text> as an authorized <Text style={styles.boldText}>{lastEnrolledUser.role}</Text>.
          </Text>
          <TouchableOpacity
            style={[styles.successCloseBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => setShowSuccessCard(false)}
          >
            <Text style={styles.successCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 40,
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: 10,
  },
  mainTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 20,
  },
  cameraPreviewContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  noCamera: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noCameraText: {
    fontWeight: '500',
    marginBottom: 15,
    textAlign: 'center',
  },
  permissionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  permissionBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  frameGuide: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleMask: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: SCREEN_WIDTH * 0.225,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  formCard: {
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  fieldLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputField: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    fontWeight: '500',
  },
  rolePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  rolePickerItem: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  rolePickerText: {
    fontWeight: '700',
  },
  loaderContainer: {
    width: '100%',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginLeft: 10,
    fontWeight: 'bold',
  },
  submitButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  successOverlay: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: 'bold',
  },
  successCloseBtn: {
    width: '60%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCloseText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default EnrollScreen;
