package com.datalakeapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.concurrent.thread

/**
 * Native Module for high-performance offline Facial Recognition and secure AES-256 encryption.
 */
class FaceRecognitionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var tflite: Interpreter? = null

    init {
        // Load the TFLite model asynchronously in a background thread to prevent blocking startup
        thread {
            try {
                val options = Interpreter.Options()
                options.setNumThreads(4)
                tflite = Interpreter(loadModelFile(), options)
                Log.d("FaceRecognitionModule", "TFLite model loaded successfully from assets")
            } catch (e: Exception) {
                Log.e("FaceRecognitionModule", "Failed to load TFLite model from assets", e)
            }
        }
    }

    override fun getName(): String {
        return "FaceRecognitionModule"
    }

    /**
     * Helper to memory-map the TFLite file directly from the assets bundle.
     */
    private fun loadModelFile(): MappedByteBuffer {
        val assetFileDescriptor = reactApplicationContext.assets.openFd("models/facenet_dynamic.tflite")
        val inputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = assetFileDescriptor.startOffset
        val declaredLength = assetFileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    /**
     * Processes a Base64 encoded image, resizes it to 160x160, normalizes pixels to [-1, 1],
     * and runs FaceNet model to return the 128-dimensional embedding array.
     */
    @ReactMethod
    fun getEmbedding(base64Image: String, promise: Promise) {
        thread {
            try {
                val interpreter = tflite
                if (interpreter == null) {
                    promise.reject("MODEL_ERROR", "TFLite model is not loaded yet")
                    return@thread
                }

                // Clean standard Base64 data scheme prefixes if present
                val cleanedBase64 = if (base64Image.contains(",")) {
                    base64Image.substring(base64Image.indexOf(",") + 1)
                } else {
                    base64Image
                }

                // Decode base64 bytes to Bitmap
                val decodedBytes = Base64.decode(cleanedBase64, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
                if (bitmap == null) {
                    promise.reject("BITMAP_ERROR", "Failed to decode Base64 string to a Bitmap object")
                    return@thread
                }

                // Resize bitmap to 160x160 using bilinear interpolation for FaceNet input
                val resizedBitmap = Bitmap.createScaledBitmap(bitmap, 160, 160, true)
                
                // Get ARGB pixel array
                val intValues = IntArray(160 * 160)
                resizedBitmap.getPixels(intValues, 0, resizedBitmap.width, 0, 0, resizedBitmap.width, resizedBitmap.height)

                // Allocate ByteBuffer for TFLite (1 * 160 * 160 * 3 channels * 4 bytes per float32)
                val imgData = ByteBuffer.allocateDirect(1 * 160 * 160 * 3 * 4)
                imgData.order(ByteOrder.nativeOrder())
                imgData.rewind()

                // Normalize pixels from [0, 255] to [-1, 1] using (val - 127.5) / 127.5
                for (pixelValue in intValues) {
                    val r = (pixelValue ushr 16) and 0xFF
                    val g = (pixelValue ushr 8) and 0xFF
                    val b = pixelValue and 0xFF

                    imgData.putFloat((r.toFloat() - 127.5f) / 127.5f)
                    imgData.putFloat((g.toFloat() - 127.5f) / 127.5f)
                    imgData.putFloat((b.toFloat() - 127.5f) / 127.5f)
                }

                // Allocate output array for 128D embedding
                val output = Array(1) { FloatArray(128) }
                
                // Run synchronous TFLite inference (called inside background worker thread)
                interpreter.run(imgData, output)

                // Convert output float array to React Native WritableArray
                val result = Arguments.createArray()
                for (v in output[0]) {
                    result.pushDouble(v.toDouble())
                }
                promise.resolve(result)

            } catch (e: Exception) {
                Log.e("FaceRecognitionModule", "Inference error", e)
                promise.reject("INFERENCE_ERROR", "Error executing FaceNet model: ${e.message}", e)
            }
        }
    }

    /**
     * Generates a secure, random 256-bit AES key.
     */
    @ReactMethod
    fun generateAESKey(promise: Promise) {
        thread {
            try {
                val keyGen = KeyGenerator.getInstance("AES")
                keyGen.init(256)
                val secretKey = keyGen.generateKey()
                val keyB64 = Base64.encodeToString(secretKey.encoded, Base64.NO_WRAP)
                promise.resolve(keyB64)
            } catch (e: Exception) {
                Log.e("FaceRecognitionModule", "KeyGen error", e)
                promise.reject("KEYGEN_ERROR", "Error generating secure AES key: ${e.message}", e)
            }
        }
    }

    /**
     * Encrypts a plaintext string using AES-256-CBC with a random 16-byte IV.
     * The IV is prepended to the ciphertext, and the result is returned in Base64.
     */
    @ReactMethod
    fun encrypt(data: String, keyB64: String, promise: Promise) {
        thread {
            try {
                val keyBytes = Base64.decode(keyB64, Base64.DEFAULT)
                val secretKey = SecretKeySpec(keyBytes, "AES")
                val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
                
                val iv = ByteArray(16)
                SecureRandom().nextBytes(iv)
                val ivSpec = IvParameterSpec(iv)
                
                cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec)
                val encryptedBytes = cipher.doFinal(data.toByteArray(Charsets.UTF_8))
                
                // Combine IV and encrypted bytes into a single byte array [IV (16 bytes)][Ciphertext]
                val combined = ByteArray(iv.size + encryptedBytes.size)
                System.arraycopy(iv, 0, combined, 0, iv.size)
                System.arraycopy(encryptedBytes, 0, combined, iv.size, encryptedBytes.size)
                
                val encryptedB64 = Base64.encodeToString(combined, Base64.NO_WRAP)
                promise.resolve(encryptedB64)
            } catch (e: Exception) {
                Log.e("FaceRecognitionModule", "Encryption error", e)
                promise.reject("ENCRYPT_ERROR", "Error performing AES-256 encryption: ${e.message}", e)
            }
        }
    }

    /**
     * Decrypts a combined [IV (16 bytes)][Ciphertext] Base64 string using the provided AES key.
     */
    @ReactMethod
    fun decrypt(encryptedB64: String, keyB64: String, promise: Promise) {
        thread {
            try {
                val keyBytes = Base64.decode(keyB64, Base64.DEFAULT)
                val secretKey = SecretKeySpec(keyBytes, "AES")
                val combined = Base64.decode(encryptedB64, Base64.DEFAULT)
                
                if (combined.size < 16) {
                    promise.reject("DECRYPT_ERROR", "Invalid encrypted payload size")
                    return@thread
                }

                // Split IV and Ciphertext
                val iv = ByteArray(16)
                System.arraycopy(combined, 0, iv, 0, iv.size)
                
                val encryptedBytes = ByteArray(combined.size - iv.size)
                System.arraycopy(combined, iv.size, encryptedBytes, 0, encryptedBytes.size)
                
                val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
                val ivSpec = IvParameterSpec(iv)
                
                cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec)
                val decryptedBytes = cipher.doFinal(encryptedBytes)
                
                promise.resolve(String(decryptedBytes, Charsets.UTF_8))
            } catch (e: Exception) {
                Log.e("FaceRecognitionModule", "Decryption error", e)
                promise.reject("DECRYPT_ERROR", "Error performing AES-256 decryption: ${e.message}", e)
            }
        }
    }
}
