// Chiffrement des sauvegardes : AES-GCM 256 bits, clé dérivée du mot de passe par PBKDF2-SHA-256.
// Tout se fait dans le navigateur (WebCrypto) : le mot de passe ne quitte jamais l'appareil et n'est stocké nulle part.

/** Recommandation OWASP 2023 pour PBKDF2-SHA-256 */
const ITERATIONS = 600_000
export const MIN_PASSWORD = 8

export interface EncryptedBackup {
  app: 'braz'
  version: 1
  encrypted: true
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  data: string
}

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array, iterations: number, usage: KeyUsage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

/** Chiffre le texte d'une sauvegarde. */
export async function encryptBackup(plain: string, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ITERATIONS, 'encrypt')
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  return {
    app: 'braz',
    version: 1,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    data: toB64(new Uint8Array(data)),
  }
}

/** Indique si un fichier est une sauvegarde chiffrée par BRAZ. */
export function isEncrypted(raw: unknown): raw is EncryptedBackup {
  const r = raw as Partial<EncryptedBackup> | null
  return !!r && r.app === 'braz' && r.encrypted === true && typeof r.data === 'string'
    && typeof r.kdf?.salt === 'string' && typeof r.cipher?.iv === 'string'
}

/** Déchiffre une sauvegarde ; lève une erreur lisible si le mot de passe est faux. */
export async function decryptBackup(b: EncryptedBackup, password: string): Promise<string> {
  // Borne le coût de calcul imposé par un fichier : un nombre d'itérations démesuré figerait l'appareil.
  const iterations = Number(b.kdf.iterations)
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) {
    throw new Error('Ce fichier de sauvegarde est endommagé.')
  }
  try {
    const key = await deriveKey(password, fromB64(b.kdf.salt), iterations, 'decrypt')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(b.cipher.iv) as BufferSource }, key, fromB64(b.data) as BufferSource)
    return new TextDecoder().decode(plain)
  } catch {
    // AES-GCM authentifie les données : un mauvais mot de passe ou un fichier modifié échouent de la même façon.
    throw new Error('Mot de passe incorrect, ou fichier modifié.')
  }
}
