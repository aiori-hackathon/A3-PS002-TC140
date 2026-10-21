'use strict';

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { loadOrGenerateKeys } = require('../config/keys');

// Load (or generate) the EC P-256 key pair once at module load.
const { privateKey, publicKey } = loadOrGenerateKeys();

const JWT_ALGORITHM = 'ES256';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '300', 10); // seconds

/**
 * Sign a JWT with the EC private key (ES256).
 *
 * Expected payload fields:
 *   sub, purpose, nv, cv, scope, aud
 *
 * iat and exp are added automatically by jsonwebtoken.
 *
 * @param {Object} payload
 * @returns {string} Signed JWT string.
 */
function signJWT(payload) {
  return jwt.sign(payload, privateKey, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT using the EC public key (ES256).
 *
 * @param {string} token
 * @returns {Object} Decoded claims.
 * @throws {Error} If the token is invalid, expired, or tampered.
 */
function verifyJWT(token) {
  return jwt.verify(token, publicKey, { algorithms: [JWT_ALGORITHM] });
}

/**
 * Compute the SHA-256 hex digest of a string.
 *
 * @param {string} str
 * @returns {string} Hex-encoded digest.
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = { signJWT, verifyJWT, sha256 };
