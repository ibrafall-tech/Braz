// Export et ouverture des sauvegardes protégées par mot de passe.
import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import type { Data } from './types'
import { useStore } from './store'
import { readBackup } from './lib'
import { MIN_PASSWORD, decryptBackup, type EncryptedBackup } from './crypto'
import { Button, Field, Sheet, useClosing, useToast } from './ui'

/** Champ de mot de passe avec bouton pour l'afficher. */
function PasswordField({
  label, value, onChange, error, autoComplete, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} error={error}>
      <span className="relative block">
        <input
          type={shown ? 'text' : 'password'}
          className="field pr-12!"
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          data-autofocus={autoFocus || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:text-ink active:scale-90"
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </Field>
  )
}

/** Le chiffrement exige un contexte sécurisé (HTTPS), toujours le cas une fois l'application en ligne. */
const canEncrypt = () => !!globalThis.crypto?.subtle

/** Export d'une sauvegarde, protégée par mot de passe par défaut. */
export function ExportBackupSheet({ onClose: done }: { onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { exportBackup } = useStore()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const secure = canEncrypt()

  async function run(withPassword: boolean) {
    if (withPassword) {
      const next = {
        password: password.length >= MIN_PASSWORD ? undefined : `Au moins ${MIN_PASSWORD} caractères.`,
        confirm: confirm === password ? undefined : 'Les deux mots de passe ne correspondent pas.',
      }
      setErrors(next)
      if (next.password || next.confirm) return
    }
    setBusy(true)
    try {
      const ok = await exportBackup(withPassword ? password : undefined)
      if (ok) {
        toast(withPassword ? 'Sauvegarde protégée exportée' : 'Sauvegarde exportée')
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(secure)
  }

  return (
    <Sheet
      closing={closing}
      title="Exporter une sauvegarde"
      onClose={onClose}
      footer={
        <Button type="submit" form="export-form" className="flex-1" disabled={busy}>
          {busy ? 'Préparation…' : secure ? 'Exporter protégée' : 'Exporter'}
        </Button>
      }
    >
      <form id="export-form" onSubmit={submit} className="space-y-5 pb-2" noValidate>
        {secure ? (
          <>
            <p className="flex gap-3 rounded-2xl bg-primary-soft p-4 text-[15px] text-ink">
              <LockKeyhole size={20} className="mt-0.5 shrink-0 text-primary" />
              <span>
                Le fichier sera chiffré : sans ce mot de passe, personne ne peut le lire.
                <b className="mt-1 block font-semibold">Notez-le bien : il ne peut pas être récupéré.</b>
              </span>
            </p>
            {/* Nom d'utilisateur caché : permet au gestionnaire de mots de passe d'enregistrer celui-ci sous « BRAZ ». */}
            <input type="text" autoComplete="username" value="Sauvegarde BRAZ" readOnly hidden />
            <PasswordField
              label="Mot de passe"
              value={password}
              autoComplete="new-password"
              autoFocus
              error={errors.password}
              onChange={(v) => {
                setPassword(v)
                setErrors((x) => ({ ...x, password: undefined }))
              }}
            />
            <PasswordField
              label="Confirmez le mot de passe"
              value={confirm}
              autoComplete="new-password"
              error={errors.confirm}
              onChange={(v) => {
                setConfirm(v)
                setErrors((x) => ({ ...x, confirm: undefined }))
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(false)}
              className="block w-full rounded-xl py-2 text-center text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Exporter sans mot de passe (lisible par tous)
            </button>
          </>
        ) : (
          <p className="text-[15px] text-muted">
            La protection par mot de passe n’est disponible que sur la version en ligne (HTTPS). Le fichier sera lisible par quiconque l’ouvre.
          </p>
        )}
      </form>
    </Sheet>
  )
}

/** Demande le mot de passe d'une sauvegarde chiffrée, puis la valide. */
export function UnlockBackupSheet({
  backup, onOpened, onClose: done,
}: { backup: EncryptedBackup; onOpened: (d: Data) => void; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password) return setError('Saisissez le mot de passe.')
    setBusy(true)
    try {
      const data = readBackup(await decryptBackup(backup, password))
      done()
      onOpened(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ouverture impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      closing={closing}
      title="Sauvegarde protégée"
      onClose={onClose}
      footer={
        <Button type="submit" form="unlock-form" className="flex-1" disabled={busy}>
          {busy ? 'Ouverture…' : 'Ouvrir'}
        </Button>
      }
    >
      <form id="unlock-form" onSubmit={submit} className="space-y-4 pb-2" noValidate>
        <p className="text-[15px] text-muted">Saisissez le mot de passe choisi lors de l’export.</p>
        <input type="text" autoComplete="username" value="Sauvegarde BRAZ" readOnly hidden />
        <PasswordField
          label="Mot de passe"
          value={password}
          autoComplete="current-password"
          autoFocus
          error={error}
          onChange={(v) => {
            setPassword(v)
            setError(undefined)
          }}
        />
      </form>
    </Sheet>
  )
}
