import NetInfo from '@react-native-community/netinfo';
import { getPendingLogs, markAsSynced, purgeSyncedLogs } from './DatabaseService';

class SyncService {
  private isSyncing = false;
  private unsubscribe: (() => void) | null = null;
  private apiGatewayUrl = 'https://your-aws-api-gateway-url/attendance';

  /**
   * Initializes the network listener to trigger synchronization on connection recovery.
   */
  public startSyncListener() {
    if (this.unsubscribe) {
      return;
    }

    console.log('[SyncService] Starting connectivity sync listener.');
    this.unsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable !== false;
      console.log(`[SyncService] Connection state changed. Online: ${isOnline}`);
      
      if (isOnline) {
        this.syncPendingLogs().catch(err => {
          console.error('[SyncService] Automated background sync failed:', err);
        });
      }
    });
  }

  /**
   * Unregisters the network listener.
   */
  public stopSyncListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('[SyncService] Stopped connectivity sync listener.');
    }
  }

  /**
   * Pushes all local unsynced logs to AWS, then marks them synced and purges database.
   */
  public async syncPendingLogs(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      const pendingLogs = await getPendingLogs();
      if (pendingLogs.length === 0) {
        console.log('[SyncService] No pending attendance logs to sync.');
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncService] Found ${pendingLogs.length} pending logs. Pushing to AWS API Gateway...`);

      // POST to AWS API Gateway
      const response = await fetch(this.apiGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: pendingLogs }),
      });

      if (response.ok) {
        console.log('[SyncService] AWS API Gateway synced successfully. Updating SQLite records...');
        
        // Mark each synced log in SQLite database
        for (const log of pendingLogs) {
          if (log.id !== undefined) {
            await markAsSynced(log.id);
          }
        }

        // Purge the local logs that were successfully synced to AWS
        await purgeSyncedLogs();
        console.log('[SyncService] Local database purged of synced logs.');
      } else {
        console.warn(`[SyncService] AWS endpoint responded with error status: ${response.status}`);
      }
    } catch (error) {
      console.error('[SyncService] Synchronization error:', error);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();
