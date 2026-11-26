import { useCallback, useEffect, useState } from 'react'
import { Delete, ScanFace } from 'lucide-react'
import { useStore } from './store'
import { emptyData, hashPin, uid } from './lib'
import { Button, ConfirmDelete, Sheet, cx, useClosing, useToast } from './ui'
import { Logo } from './parts'

const LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/* Garde anti-essais : conservée hors de la base pour survivre à un rechargement de la page. */
const GUARD_KEY = 'braz-lock'
const FREE_ATTEMPTS = 5
interface Guard { fails: number; until: number }
function readGuard(): Guard {
  try {
    const g = JSON.parse(localStorage.getItem(GUARD_KEY) ?? '{}')
    return { fails: Number(g.fails) || 0, until: Number(g.until) || 0 }
  } catch {
    return { fails: 0, until: 0 }
  }
}
function writeGuard(g: Guard | null) {
  try {
    if (g) localStorage.setItem(GUARD_KEY, JSON.stringify(g))
    else localStorage.removeItem(GUARD_KEY)
  } catch {
    /* stockage indisponible : la garde ne vaut alors que pour la session */
  }
}
/** Cinq essais libres, puis 30 s d'attente, doublée à chaque nouvelle erreur (15 min au plus). */
const penalty = (fails: number) => (fails < FREE_ATTEMPTS ? 0 : Math.min(30_000 * 2 ** (fails - FREE_ATTEMPTS), 900_000))
const waitLabel = (ms: number) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min` : `${Math.ceil(ms / 1000)} s`)

/** Vérifie un code en appliquant la garde anti-essais commune à tous les écrans. */
function useGuardedCheck(pin: { salt: string; hash: string }) {
  const [guard, setGuard] = useState(readGuard)
  const [now, setNow] = useState(() => Date.now())
  const waiting = Math.max(0, guard.until - now)
  useEffect(() => {
    if (guard.until <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [guard.until])
  const check = async (code: string) => {
    const ok = (await hashPin(code, pin.salt)) === pin.hash
    const next = ok ? null : { fails: guard.fails + 1, until: Date.now() + penalty(guard.fails + 1) }
    writeGuard(next)
    setGuard(next ?? { fails: 0, until: 0 })
    setNow(Date.now())
    return ok
  }
  const error = waiting > 0 ? `Trop d’essais. Réessayez dans ${waitLabel(waiting)}` : undefined
  return { check, waiting, error }
}

/* ---------- Biométrie (Face ID, empreinte) ----------
   La clé reste dans le téléphone. Sans serveur, on ne vérifie pas de signature : le simple fait que
   l'appareil accepte de l'utiliser prouve que son propriétaire s'est authentifié. */

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Enregistre une clé sur l'appareil ; renvoie son identifiant, ou null si l'utilisateur annule. */
export async function biometricRegister(): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'BRAZ' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'braz', displayName: 'BRAZ' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    return cred ? toB64(cred.rawId) : null
  } catch {
    return null
  }
}

export async function biometricVerify(id: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        allowCredentials: [{ type: 'public-key', id: fromB64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!assertion
  } catch {
    return false
  }
}

/** Clavier à quatre chiffres. `onComplete` renvoie false si le code est refusé. */
export function PinPad({
  title, error, onComplete, disabled,
}: { title: string; error?: string; disabled?: boolean; onComplete: (code: string) => boolean | Promise<boolean> }) {
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)

  const press = useCallback((d: string) => {
    if (disabled) return
    setWrong(false)
    setCode((c) => (c.length < LENGTH ? c + d : c))
  }, [disabled])
  const erase = useCallback(() => setCode((c) => c.slice(0, -1)), [])

  useEffect(() => {
    if (code.length !== LENGTH) return
    let alive = true
    Promise.resolve(onComplete(code)).then((ok) => {
      if (!alive || ok) return
      setWrong(true)
      navigator.vibrate?.(60)
      setTimeout(() => alive && setCode(''), 380)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') erase()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [press, erase])

  const key =
    'display grid aspect-square w-full max-w-20 place-items-center justify-self-center rounded-full bg-surface [@media(max-height:650px)]:max-w-16 text-2xl font-semibold shadow-[0_1px_2px_rgb(43_44_79/0.05),0_8px_20px_-12px_rgb(43_44_79/0.25)] transition duration-100 active:scale-90 active:bg-primary-soft disabled:opacity-40'

  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <p className="display text-xl font-semibold">{title}</p>
      <p role="alert" className="mt-1 h-5 text-sm text-neg">{wrong && !disabled ? 'Code incorrect' : error}</p>
      <div className={cx('my-5 flex gap-4', wrong && 'shake')} aria-label={`${code.length} chiffre sur ${LENGTH}`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={`${i}-${i < code.length}`}
            className={cx(
              'size-3.5 rounded-full transition-colors',
              i < code.length ? (wrong ? 'bg-neg' : 'dot-pop bg-primary') : 'bg-ink/15',
            )}
          />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-x-5 gap-y-3 [@media(min-height:700px)]:gap-y-4">
        {KEYS.map((d) => (
          <button key={d} type="button" className={key} disabled={disabled} onClick={() => press(d)}>{d}</button>
        ))}
        <span />
        <button type="button" className={key} disabled={disabled} onClick={() => press('0')}>0</button>
        <button
          type="button"
          aria-label="Effacer"
          onClick={erase}
          disabled={!code}
          className="grid aspect-square w-full max-w-20 place-items-center justify-self-center rounded-full text-muted transition active:scale-90 disabled:opacity-30"
        >
          <Delete size={26} />
        </button>
      </div>
    </div>
  )
}

/** Écran de verrouillage affiché à l'ouverture quand un code est défini. */
export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const { settings, replaceAll } = useStore()
  const [leaving, setLeaving] = useState(false)
  const [forgot, setForgot] = useState(false)
  const { check, waiting, error } = useGuardedCheck(settings.pin!)

  const open = () => {
    writeGuard(null)
    setLeaving(true)
    setTimeout(onUnlock, 230)
  }
  const biometricId = settings.biometricId
  const useBiometric = () => {
    if (biometricId) biometricVerify(biometricId).then((ok) => ok && open())
  }
  // Propose Face ID dès l'ouverture ; si le navigateur exige un geste, le bouton prend le relais.
  useEffect(() => {
    useBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={cx(
        'hero fixed inset-0 z-40 flex overflow-y-auto px-8 py-[max(1.5rem,env(safe-area-inset-top))]',
        leaving && 'lock-out',
      )}
    >
      {/* m-auto centre le contenu tout en le laissant défiler sur les petits écrans */}
      <div className="m-auto flex w-full flex-col items-center gap-6 [@media(min-height:700px)]:gap-9">
      <div className="rise flex flex-col items-center gap-3">
        <Logo size={56} />
        <span className="display text-3xl font-bold [@media(max-height:650px)]:hidden">braz</span>
      </div>
      <div className="rise flex w-full justify-center" style={{ animationDelay: '90ms' }}>
        <PinPad
          title="Code d’accès"
          disabled={waiting > 0}
          error={error}
          onComplete={async (code) => {
            const ok = await check(code)
            if (ok) open()
            return ok
          }}
        />
      </div>
      {biometricId && (
        <button
          type="button"
          onClick={useBiometric}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white/70 px-5 text-sm font-semibold text-primary transition active:scale-95"
        >
          <ScanFace size={18} /> Face ID ou empreinte
        </button>
      )}
      <button type="button" onClick={() => setForgot(true)} className="rounded-md text-sm font-semibold text-muted hover:text-ink">
        Code oublié ?
      </button>

      {forgot && (
        <Sheet
          title="Code oublié ?"
          onClose={() => setForgot(false)}
          footer={
            <>
              <Button variant="soft" className="flex-1" onClick={() => setForgot(false)}>Annuler</Button>
              <ConfirmDelete
                label="Tout effacer"
                onConfirm={() =>
                  replaceAll(emptyData({ id: 'settings', currency: settings.currency })).then(open)
                }
              />
            </>
          }
        >
          <p className="text-[15px] text-muted">
            Sans le code, il faut effacer les données de cet appareil. Vous pourrez ensuite restaurer une sauvegarde.
          </p>
        </Sheet>
      )}
      </div>
    </div>
  )
}

/**
 * Demande le code actuel avant une action sensible (changer ou retirer le code, activer la biométrie).
 * Sans cette étape, une personne qui trouve l'application ouverte pourrait retirer la protection.
 */
export function PinVerifySheet({ title, onVerified, onClose: done }: { title: string; onVerified: () => void; onClose: () => void }) {
  const { settings } = useStore()
  const [closing, onClose] = useClosing(done)
  const { check, waiting, error } = useGuardedCheck(settings.pin!)
  return (
    <Sheet title={title} onClose={onClose} closing={closing}>
      <div className="flex justify-center pb-4 pt-2">
        <PinPad
          title="Code actuel"
          disabled={waiting > 0}
          error={error}
          onComplete={async (code) => {
            const ok = await check(code)
            if (ok) {
              onVerified()
              done()
            }
            return ok
          }}
        />
      </div>
    </Sheet>
  )
}

/** Définit ou remplace le code d'accès : saisie, puis confirmation. */
export function PinSetupSheet({ onClose: done }: { onClose: () => void }) {
  const { updateSettings } = useStore()
  const toast = useToast()
  const [closing, onClose] = useClosing(done)
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()

  return (
    <Sheet title="Code d’accès" onClose={onClose} closing={closing}>
      <div className="flex justify-center pb-4 pt-2">
        {first ? (
          <PinPad
            key="confirm"
            title="Confirmez le code"
            onComplete={async (code) => {
              if (code !== first) {
                setTimeout(() => {
                  setFirst('')
                  setError('Les codes ne correspondent pas')
                }, 380)
                return false
              }
              const salt = uid()
              updateSettings({ pin: { salt, hash: await hashPin(code, salt) } })
              toast('Code d’accès activé')
              onClose()
              return true
            }}
          />
        ) : (
          <PinPad
            key="new"
            title="Choisissez 4 chiffres"
            error={error}
            onComplete={(code) => {
              setError(undefined)
              setFirst(code)
              return true
            }}
          />
        )}
      </div>
    </Sheet>
  )
}
