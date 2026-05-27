import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

// Enable SQLite promises for modern async/await syntax
SQLite.enablePromise(true);

/**
 * Interface representing an enrolled employee's facial signature record.
 */
export interface EnrolledFace {
  id?: number;
  name: string;
  role: string;
  embedding: string; // Base64 AES-256 encrypted JSON string of embedding array
  created_at?: string;
}

/**
 * Interface representing a locally logged attendance swipe.
 */
export interface AttendanceLog {
  id?: number;
  user_id: number;
  name: string;
  similarity: number;
  timestamp?: string;
  synced: number; // 0 for unsynced, 1 for synced
}

let dbInstance: SQLiteDatabase | null = null;

/**
 * Opens and caches the local SQLite database.
 */
export const getDBConnection = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }
  try {
    const db = await SQLite.openDatabase({
      name: 'datalake_attendance.db',
      location: 'default',
    });
    dbInstance = db;
    return db;
  } catch (error) {
    console.error('[DatabaseService] Failed to connect to SQLite database:', error);
    throw new Error('Database connection failed.');
  }
};

/**
 * Configures the tables and schema of the local SQLite database.
 */
export const initDatabase = async (): Promise<void> => {
  try {
    const db = await getDBConnection();
    
    // Create enrolled faces table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS enrolled_faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        embedding TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create attendance logs table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        similarity REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
    
    console.log('[DatabaseService] SQLite tables checked/created successfully.');
  } catch (error) {
    console.error('[DatabaseService] Database initialization failed:', error);
    throw error;
  }
};

/**
 * Inserts a new enrolled employee face signature.
 */
export const insertEnrolledFace = async (
  name: string,
  role: string,
  encryptedEmbedding: string
): Promise<number> => {
  try {
    const db = await getDBConnection();
    const [results] = await db.executeSql(
      'INSERT INTO enrolled_faces (name, role, embedding) VALUES (?, ?, ?);',
      [name, role, encryptedEmbedding]
    );
    console.log(`[DatabaseService] Successfully enrolled face for ${name} with ID: ${results.insertId}`);
    return results.insertId;
  } catch (error) {
    console.error('[DatabaseService] Failed to insert enrolled face:', error);
    throw error;
  }
};

/**
 * Fetches all enrolled employee facial records.
 */
export const getAllEnrolledFaces = async (): Promise<EnrolledFace[]> => {
  try {
    const db = await getDBConnection();
    const [results] = await db.executeSql('SELECT * FROM enrolled_faces ORDER BY id DESC;');
    
    const faces: EnrolledFace[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      faces.push(results.rows.item(i));
    }
    return faces;
  } catch (error) {
    console.error('[DatabaseService] Failed to fetch enrolled faces:', error);
    return [];
  }
};

/**
 * Inserts a new local attendance log entry.
 */
export const insertAttendanceLog = async (
  userId: number,
  name: string,
  similarity: number
): Promise<number> => {
  try {
    const db = await getDBConnection();
    const [results] = await db.executeSql(
      'INSERT INTO attendance_logs (user_id, name, similarity, synced) VALUES (?, ?, ?, 0);',
      [userId, name, similarity]
    );
    console.log(`[DatabaseService] Saved offline attendance log for ${name} (ID: ${results.insertId})`);
    return results.insertId;
  } catch (error) {
    console.error('[DatabaseService] Failed to insert attendance log:', error);
    throw error;
  }
};

/**
 * Retrieves all offline pending attendance logs that are yet to be synced to AWS.
 */
export const getPendingLogs = async (): Promise<AttendanceLog[]> => {
  try {
    const db = await getDBConnection();
    const [results] = await db.executeSql(
      'SELECT * FROM attendance_logs WHERE synced = 0 ORDER BY timestamp ASC;'
    );
    
    const logs: AttendanceLog[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      logs.push(results.rows.item(i));
    }
    return logs;
  } catch (error) {
    console.error('[DatabaseService] Failed to fetch pending attendance logs:', error);
    return [];
  }
};

/**
 * Marks a specific local attendance log as successfully synced.
 */
export const markAsSynced = async (id: number): Promise<void> => {
  try {
    const db = await getDBConnection();
    await db.executeSql('UPDATE attendance_logs SET synced = 1 WHERE id = ?;', [id]);
    console.log(`[DatabaseService] Log ID ${id} marked as synced.`);
  } catch (error) {
    console.error(`[DatabaseService] Failed to mark log ID ${id} as synced:`, error);
    throw error;
  }
};

/**
 * Purges (deletes) all local attendance logs that have already been pushed to AWS.
 */
export const purgeSyncedLogs = async (): Promise<void> => {
  try {
    const db = await getDBConnection();
    const [results] = await db.executeSql('DELETE FROM attendance_logs WHERE synced = 1;');
    console.log(`[DatabaseService] Purged synced attendance logs. Rows deleted: ${results.rowsAffected}`);
  } catch (error) {
    console.error('[DatabaseService] Failed to purge synced logs:', error);
    throw error;
  }
};
