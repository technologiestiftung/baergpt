#!/usr/bin/env node

const crypto = require("crypto");

/**
 * Generate a random alphanumeric string of EXACT specified length
 */
function generateRandomString(length) {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	const randomBytes = crypto.randomBytes(length);

	for (let i = 0; i < length; i++) {
		result += chars[randomBytes[i] % chars.length];
	}

	return result;
}

/**
 * Generate a secure random password (64 characters)
 */
function generatePassword(length = 64) {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*";
	let password = "";
	const randomBytes = crypto.randomBytes(length);

	for (let i = 0; i < length; i++) {
		password += chars[randomBytes[i] % chars.length];
	}

	return password;
}

/**
 * Generate JWT token for Supabase
 */
function generateJWT(secret, payload) {
	// Header
	const header = {
		alg: "HS256",
		typ: "JWT",
	};

	const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
		"base64url",
	);

	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);

	// Create signature
	const signature = crypto
		.createHmac("sha256", secret)
		.update(`${encodedHeader}.${encodedPayload}`)
		.digest("base64url");

	return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generate all Supabase environment variables
 */
function generateSupabaseEnv() {
	// Generate JWT secret (at least 32 characters)
	const jwtSecret = generateRandomString(64);

	// Current timestamp
	const iat = Math.floor(Date.now() / 1000);
	// Expiry: 100 years from now
	const exp = iat + 100 * 365 * 24 * 60 * 60;

	// Generate ANON_KEY JWT
	const anonPayload = {
		role: "anon",
		iss: "supabase",
		iat: iat,
		exp: exp,
	};
	const anonKey = generateJWT(jwtSecret, anonPayload);

	// Generate SERVICE_ROLE_KEY JWT
	const serviceRolePayload = {
		role: "service_role",
		iss: "supabase",
		iat: iat,
		exp: exp,
	};
	const serviceRoleKey = generateJWT(jwtSecret, serviceRolePayload);

	// Generate other secrets with EXACT lengths
	const config = {
		POSTGRES_PASSWORD: generateRandomString(64),
		JWT_SECRET: jwtSecret,
		ANON_KEY: anonKey,
		SERVICE_ROLE_KEY: serviceRoleKey,
		DASHBOARD_USERNAME: "supabase",
		DASHBOARD_PASSWORD: generatePassword(32),
		SECRET_KEY_BASE: generateRandomString(64),
		VAULT_ENC_KEY: generateRandomString(32), // Exactly 32 characters
		PG_META_CRYPTO_KEY: generateRandomString(32), // Exactly 32 characters
	};

	// Verify lengths
	console.error("\n🔍 Verifying lengths:");
	console.error(`POSTGRES_PASSWORD: ${config.POSTGRES_PASSWORD.length} chars`);
	console.error(`JWT_SECRET: ${config.JWT_SECRET.length} chars`);
	console.error(
		`DASHBOARD_PASSWORD: ${config.DASHBOARD_PASSWORD.length} chars`,
	);
	console.error(`SECRET_KEY_BASE: ${config.SECRET_KEY_BASE.length} chars`);
	console.error(`VAULT_ENC_KEY: ${config.VAULT_ENC_KEY.length} chars ✓`);
	console.error(
		`PG_META_CRYPTO_KEY: ${config.PG_META_CRYPTO_KEY.length} chars ✓\n`,
	);

	return config;
}

/**
 * Format output as .env file
 */
function formatAsEnv(config) {
	let output = "# Supabase Environment Variables\n";
	output += "# Generated on: " + new Date().toISOString() + "\n\n";

	for (const [key, value] of Object.entries(config)) {
		output += `${key}=${value}\n`;
	}

	return output;
}

// Main execution
const config = generateSupabaseEnv();
const envContent = formatAsEnv(config);

console.log(envContent);

// Optionally write to file
const fs = require("fs");
const filename = ".env.generated";

fs.writeFileSync(filename, envContent);
console.log(`✅ Environment variables have been written to ${filename}`);
console.log(
	"⚠️  Keep these credentials secure and never commit them to version control!",
);
