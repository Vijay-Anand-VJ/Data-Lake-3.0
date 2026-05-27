import { NativeModules } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { insertEnrolledFace, getAllEnrolledFaces, insertAttendanceLog } from './DatabaseService';

// Define the TS typing for the custom Kotlin native module
interface FaceRecognitionModuleType {
  getEmbedding(base64Image: string): Promise<number[]>;
  generateAESKey(): Promise<string>;
  encrypt(data: string, keyB64: string): Promise<string>;
  decrypt(encryptedB64: string, keyB64: string): Promise<string>;
}

const FaceRecognitionModule = NativeModules.FaceRecognitionModule as FaceRecognitionModuleType;

const AES_KEY_STORAGE_KEY = 'datalake_3_master_aes_key';

/**
 * Interface representing the result of a facial comparison match.
 */
export interface MatchResult {
  matched: boolean;
  name: string;
  role: string;
  similarity: number;
}

/**
 * Retrieves the offline master AES-256 key from EncryptedStorage.
 * If one does not exist, triggers native keygen and saves it.
 */
export const getOrCreateAESKey = async (): Promise<string> => {
  try {
    let key = await EncryptedStorage.getItem(AES_KEY_STORAGE_KEY);
    if (!key) {
      // Call Kotlin native module to generate a cryptographically secure 256-bit AES key
      key = await FaceRecognitionModule.generateAESKey();
      await EncryptedStorage.setItem(AES_KEY_STORAGE_KEY, key);
      console.log('[FaceRecognitionService] Created and stored new secure master AES-256 key.');
    }
    return key;
  } catch (error) {
    console.error('[FaceRecognitionService] Failed to retrieve or generate AES master key:', error);
    throw error;
  }
};

/**
 * Computes the cosine similarity between two 128D embedding vectors.
 * Returns a value in range [-1, 1], where 1 represents perfect similarity.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Enrolls a new user offline: extracts 128D face embedding, encrypts it with AES-256,
 * and saves employee credentials into the local SQLite database.
 */
export const enrollFace = async (name: string, role: string, base64: string): Promise<void> => {
  try {
    if (!name || !role || !base64) {
      throw new Error('Name, Role, and Image Base64 data are required for enrollment.');
    }

    // 1. Trigger TFLite inference via Native Module on background thread
    const embedding = await FaceRecognitionModule.getEmbedding(base64);

    // 2. Fetch master key and encrypt embedding JSON using native AES-256
    const key = await getOrCreateAESKey();
    const embeddingJson = JSON.stringify(embedding);
    const encryptedEmbedding = await FaceRecognitionModule.encrypt(embeddingJson, key);

    // 3. Save name, role, and encrypted embedding string to local SQLite
    await insertEnrolledFace(name, role, encryptedEmbedding);
    console.log(`[FaceRecognitionService] Enrollment complete for employee: ${name}`);
  } catch (error) {
    console.error('[FaceRecognitionService] Face enrollment failed:', error);
    throw error;
  }
};

/**
 * Matches a captured Base64 frame against all locally stored enrolled face signatures.
 * Performs real-time decryption, evaluates cosine similarity, logs matching swiping details,
 * and yields the most similar matched user above 0.6 similarity.
 */
export const matchFace = async (base64: string): Promise<MatchResult> => {
  try {
    // 1. Get embedding from native TFLite
    const currentEmbedding = await FaceRecognitionModule.getEmbedding(base64);

    // 2. Fetch all enrolled employee records from SQLite database
    const enrolledFaces = await getAllEnrolledFaces();
    if (enrolledFaces.length === 0) {
      return { matched: false, name: 'Unknown', role: '', similarity: 0 };
    }

    // 3. Retrieve master key to decrypt each record's embedding
    const key = await getOrCreateAESKey();
    let bestMatch: MatchResult = { matched: false, name: 'Unknown', role: '', similarity: 0 };
    let highestSimilarity = -1;
    let matchedUserId = -1;

    for (const face of enrolledFaces) {
      try {
        const decryptedJson = await FaceRecognitionModule.decrypt(face.embedding, key);
        const enrolledEmbedding: number[] = JSON.parse(decryptedJson);

        const similarity = cosineSimilarity(currentEmbedding, enrolledEmbedding);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          matchedUserId = face.id || -1;
          
          if (similarity >= 0.6) {
            bestMatch = {
              matched: true,
              name: face.name,
              role: face.role,
              similarity: similarity,
            };
          } else {
            bestMatch = {
              matched: false,
              name: 'Unknown',
              role: '',
              similarity: similarity,
            };
          }
        }
      } catch (err) {
        console.error(`[FaceRecognitionService] Decryption failed for enrolled face ID: ${face.id}`, err);
      }
    }

    // 4. Log the matched swipe locally in SQLite attendance history
    if (bestMatch.matched && matchedUserId !== -1) {
      await insertAttendanceLog(matchedUserId, bestMatch.name, bestMatch.similarity);
    }

    return bestMatch;
  } catch (error) {
    console.error('[FaceRecognitionService] Face matching process failed:', error);
    throw error;
  }
};
