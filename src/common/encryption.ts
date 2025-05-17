import * as crypto from 'crypto';

// Configuration constants
const ALGORITHM = 'aes-256-gcm'; // Encryption algorithm
const KEY_LENGTH = 32; // Key length in bytes (256 bits for AES-256)
const IV_LENGTH = 16; // Initialization Vector length in bytes (128 bits for AES)
const TAG_LENGTH = 16; // Authentication Tag length in bytes (for GCM)

/**
 * Converts a string key to a Buffer of the required KEY_LENGTH.
 *
 * @param keyString - The string to use as a key.
 * @returns A Buffer derived from the string, padded or truncated to KEY_LENGTH.
 * @throws Error if the derived key length after padding/truncation is not KEY_LENGTH.
 */
function stringKeyToBuffer(keyString: string): Buffer {
  // Convert the string to a buffer using UTF-8 encoding
  let keyBuffer = Buffer.from(keyString, 'utf8');

  // Pad or truncate the buffer to the required KEY_LENGTH
  if (keyBuffer.length < KEY_LENGTH) {
    // Pad with zeros if too short
    const padding = Buffer.alloc(KEY_LENGTH - keyBuffer.length, 0);
    keyBuffer = Buffer.concat([keyBuffer, padding]);
  } else if (keyBuffer.length > KEY_LENGTH) {
    // Truncate if too long
    keyBuffer = keyBuffer.slice(0, KEY_LENGTH);
  }

  // Double-check the final length
  if (keyBuffer.length !== KEY_LENGTH) {
    // This case should ideally not happen with the logic above, but as a safeguard
    throw new Error(`Failed to derive key buffer of correct length. Expected ${KEY_LENGTH} bytes.`);
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a string key.
 * The output includes the IV, ciphertext, and authentication tag, encoded in base64.
 *
 * @param plaintext - The string to encrypt.
 * @param keyString - The string to use as the encryption key.
 * @returns A base64 encoded string containing the IV, ciphertext, and tag.
 * @throws Error if key conversion fails.
 */
export function encrypt(plaintext: string, keyString: string): string {
  // Convert the string key to a Buffer
  const key = stringKeyToBuffer(keyString);

  // Generate a random Initialization Vector (IV)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create the cipher instance
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]); // final() also defaults to Buffer

  // Get the authentication tag (specific to GCM)
  const tag = cipher.getAuthTag();

  // Concatenate IV, ciphertext, and tag for storage/transmission
  const output = Buffer.concat([iv, encrypted, tag]);

  // Return the concatenated buffer as a base64 string
  return output.toString('base64');
}

/**
 * Decrypts a base64 encoded string using AES-256-GCM with a string key.
 * The input string is expected to contain the IV, ciphertext, and authentication tag.
 *
 * @param encryptedText - The base64 encoded string to decrypt.
 * @param keyString - The string to use as the decryption key (must be the same as encryption).
 * @returns The original plaintext string.
 * @throws Error if key conversion fails or decryption fails (e.g., wrong key, tampered data).
 */
export function decrypt(encryptedText: string, keyString: string): string {
  // Convert the string key to a Buffer
  const key = stringKeyToBuffer(keyString);

  // Decode the base64 input string
  const inputBuffer = Buffer.from(encryptedText, 'base64');

  // Extract IV, ciphertext, and tag from the input buffer
  // The input buffer structure is: IV (16 bytes) + Ciphertext + Tag (16 bytes)
  if (inputBuffer.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data format: too short');
  }

  const iv = inputBuffer.slice(0, IV_LENGTH);
  const tag = inputBuffer.slice(inputBuffer.length - TAG_LENGTH);
  const ciphertext = inputBuffer.slice(IV_LENGTH, inputBuffer.length - TAG_LENGTH);

  // Create the decipher instance
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  // Set the authentication tag before decrypting (specific to GCM)
  decipher.setAuthTag(tag);

  // Decrypt the ciphertext
  let decrypted = decipher.update(ciphertext); // Output is Buffer by default
  decrypted = Buffer.concat([decrypted, decipher.final()]); // Finalize decryption

  // Return the decrypted buffer as a utf8 string
  return decrypted.toString('utf8');
}
