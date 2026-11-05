import {
	createCipheriv,
	createDecipheriv,
	createSecretKey,
	getRandomValues,
} from "node:crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/** All binary fields are hex-encoded. */
export interface EncryptedIntegrationKey {
	ciphertext: string;
	iv: string;
	authTag: string;
}

interface KeyContext {
	userId: string;
	provider: string;
}

// createCipheriv rejects keys that are not 32 bytes
const getEncryptionKey = () =>
	createSecretKey(config.integrationKeysEncryptionKey, "base64");

const hexToBytes = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
const bytesToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

/**
 * Additional authenticated data: not encrypted, but covered by the auth tag.
 * Binds a ciphertext to its user and provider, so a row copied to another
 * user fails to decrypt.
 */
const buildAad = ({ userId, provider }: KeyContext) =>
	new TextEncoder().encode(`${userId}:${provider}`);

export function encryptIntegrationKey(
	plaintext: string,
	context: KeyContext,
): EncryptedIntegrationKey {
	const iv = getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
	const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
		authTagLength: AUTH_TAG_LENGTH_BYTES,
	});
	cipher.setAAD(buildAad(context));

	const ciphertext =
		cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");

	return {
		ciphertext,
		iv: bytesToHex(iv),
		authTag: cipher.getAuthTag().toString("hex"),
	};
}

/**
 * Throws if the ciphertext, IV, auth tag, user or provider were tampered
 * with, or if the wrong encryption key is configured.
 */
export function decryptIntegrationKey(
	{ ciphertext, iv, authTag }: EncryptedIntegrationKey,
	context: KeyContext,
): string {
	const decipher = createDecipheriv(
		ALGORITHM,
		getEncryptionKey(),
		hexToBytes(iv),
		// Pinning the tag length rejects truncated (easier to forge) tags.
		{ authTagLength: AUTH_TAG_LENGTH_BYTES },
	);
	decipher.setAAD(buildAad(context));
	decipher.setAuthTag(hexToBytes(authTag));

	return decipher.update(ciphertext, "hex", "utf8") + decipher.final("utf8");
}
