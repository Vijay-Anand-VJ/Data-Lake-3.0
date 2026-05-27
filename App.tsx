/**
 * Datalake 3.0 Offline Face Recognition Attendance App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import { initDatabase } from './src/services/DatabaseService';
import { syncService } from './src/services/SyncService';
import { useAppTheme } from './src/theme/theme';

/**
 * Main application wrapper providing global contexts.
 */
function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

/**
 * Primary App content controller managing local database initialization,
 * background network sync triggers, and custom screen transitions.
 */
function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, fontSize } = useAppTheme();
  
  // Custom navigation state between Home and Enroll
  const [activeTab, setActiveTab] = useState<'home' | 'enroll'>('home');

  // Initialize DB and Network Sync Service on app mount
  useEffect(() => {
    const startup = async () => {
      try {
        console.log('[App] Initializing local database...');
        await initDatabase();
        
        console.log('[App] Starting Sync Service connectivity listener...');
        syncService.startSyncListener();
      } catch (err) {
        console.error('[App] Failed during application startup routine:', err);
      }
    };
    
    startup();

    // Cleanup network state listener on unmount
    return () => {
      syncService.stopSyncListener();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? 0 : safeAreaInsets.top }]}>
      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>DATALAKE 3.0</Text>
          <Text style={[styles.headerSubtitle, { color: colors.primary, fontSize: fontSize.xs }]}>
            OFFLINE FACIAL ATTENDANCE SYSTEM
          </Text>
        </View>
        <View style={styles.liveIndicatorContainer}>
          <View style={styles.livePulseDot} />
          <Text style={[styles.liveText, { color: colors.textMuted, fontSize: fontSize.xs }]}>SECURE LOCAL</Text>
        </View>
      </View>

      {/* Dynamic Screen Mounting */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' ? <HomeScreen /> : <EnrollScreen />}
      </View>

      {/* Custom Bottom Tab Bar (Custom Native Navigator) */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(safeAreaInsets.bottom, 12),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'home' && { borderTopColor: colors.primary }]}
          onPress={() => setActiveTab('home')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'home' ? colors.primary : colors.textMuted,
                fontWeight: activeTab === 'home' ? '800' : '500',
                fontSize: fontSize.sm,
              },
            ]}
          >
            Scanner HUD
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'enroll' && { borderTopColor: colors.primary }]}
          onPress={() => setActiveTab('enroll')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'enroll' ? colors.primary : colors.textMuted,
                fontWeight: activeTab === 'enroll' ? '800' : '500',
                fontSize: fontSize.sm,
              },
            ]}
          >
            Enroll Face
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitles: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(24, 95, 165, 0.1)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#378ADD',
    marginRight: 6,
  },
  liveText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1.5,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  tabText: {
    letterSpacing: 0.5,
  },
});

export default App;
