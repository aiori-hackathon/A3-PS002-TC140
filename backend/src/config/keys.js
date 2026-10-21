'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, 'ec_private.pem');
const PUBLIC_KEY_PATH  = path.join(__dirname, 'ec_public.pem');

/**
 * Load existing EC key pair from disk or generate a new one and persist it.
 * Returns { privateKey, publicKey } as PEM strings.
 */
function loadOrGenerateKeys() {
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicKey  = fs.readFileSync(PUBLIC_KEY_PATH,  'utf8');
    console.log('[Keys] Loaded existing EC key pair from disk.');
    return { privateKey, publicKey };
  }

  // Generate new EC P-256 key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
  fs.writeFileSync(PUBLIC_KEY_PATH,  publicKey,  'utf8');
  console.log('[Keys] Generated and persisted new EC P-256 key pair.');
  return { privateKey, publicKey };
}

module.exports = { loadOrGenerateKeys, PRIVATE_KEY_PATH, PUBLIC_KEY_PATH };
