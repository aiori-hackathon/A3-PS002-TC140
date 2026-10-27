'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, 'ec_private.pem');
const PUBLIC_KEY_PATH  = path.join(__dirname, 'ec_public.pem');

/**
 * Load existing EC key pair from environment variables, disk, or generate a new one.
 * Returns { privateKey, publicKey } as PEM strings.
 */
function loadOrGenerateKeys() {
  // 1. Check if provided in environment variables (ideal for Render/cloud deployments)
  if (process.env.EC_PRIVATE_KEY && process.env.EC_PUBLIC_KEY) {
    const privateKey = process.env.EC_PRIVATE_KEY.replace(/\\n/g, '\n');
    const publicKey  = process.env.EC_PUBLIC_KEY.replace(/\\n/g, '\n');
    console.log('[Keys] Loaded EC key pair from environment variables.');
    return { privateKey, publicKey };
  }

  // 2. Check if keys exist on disk
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicKey  = fs.readFileSync(PUBLIC_KEY_PATH,  'utf8');
    console.log('[Keys] Loaded existing EC key pair from disk.');
    return { privateKey, publicKey };
  }

  // 3. Generate new EC P-256 key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  });

  try {
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
    fs.writeFileSync(PUBLIC_KEY_PATH,  publicKey,  'utf8');
    console.log('[Keys] Generated and persisted new EC P-256 key pair.');
  } catch (err) {
    console.warn('[Keys] Could not persist keys to disk (read-only filesystem), continuing in-memory:', err.message);
  }

  return { privateKey, publicKey };
}

module.exports = { loadOrGenerateKeys, PRIVATE_KEY_PATH, PUBLIC_KEY_PATH };
