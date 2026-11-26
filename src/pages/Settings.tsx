import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight, Download, FileSpreadsheet, KeyRound, LockKeyhole, LockKeyholeOpen, Plus, Repeat, ScanFace, Sparkles, Trash2, Upload,
  type LucideIcon,
} from 'lucide-react'
import type { Category, Currency, Data } from '../types'
import { useStore } from '../store'
import { download, readBackup, toCSV, todayISO } from '../lib'
import { Button, ConfirmDelete, Segmented, Sheet, Switch, stagger, useToast } from '../ui'
import { PageHeader } from '../parts'
import { CategorySheet, RecurringSheet } from '../forms'
import { CurrencySheet } from '../sheets'
import { PinSetupSheet, PinVerifySheet, biometricAvailable, biometricRegister } from '../lock'
import { iconFor } from '../icons'
import { ExportBackupSheet, UnlockBackupSheet } from '../backup'
import { isEncrypted, type EncryptedBackup } from '../crypto'

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'FCFA', label: 'FCFA' },
  { value: 'XOF', label: 'XOF' },
  { value: 'EUR', label: 'Euro' },
  { value: 'USD', label: 'Dollar' },
]
const isXOF = (c: Currency) => c === 'FCFA' || c === 'XOF'

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  return (
    <section className="rise mb-8" style={stagger(index)}>
      <h2 className="display mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Row({
  icon: Icon, title, text, onClick, danger,
}: { icon: LucideIcon; title: string; text?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-surface-2/60 active:bg-surface-2">
      <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${danger ? 'bg-neg/10 text-neg' : 'bg-primary-soft text-primary'}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${danger ? 'text-neg' : ''}`}>{title}</span>
        {text && <span className="block truncate text-sm text-muted">{text}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  )
}

export function SettingsPage() {
  const store = useStore()
  const { settings, categories, accounts, transactions, budgets, goals, recurring, transfers, updateSettings } = store
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [catForm, setCatForm] = useState<Category | 'new' | null>(null)
  const [pinSetup, setPinSetup] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [currencyTo, setCurrencyTo] = useState<Currency | null>(null)
  const [pending, setPending] = useState<Data | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [wipe, setWipe] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [locked, setLocked] = useState<EncryptedBackup | null>(null)
  const [biometric, setBiometric] = useState(false)
  // Action de sécurité en attente de la saisie du code actuel
  const [verify, setVerify] = useState<'change' | 'disable' | null>(null)

  useEffect(() => {
    biometricAvailable().then(setBiometric)
  }, [])

  const empty = !transactions.length && !budgets.length && !goals.length && !recurring.length && !transfers.length
  const hasAmounts = !empty || accounts.some((a) => a.initial)

  function pickCurrency(to: Currency) {
    if (to === settings.currency) return
    // FCFA et XOF désignent la même monnaie ; sans montant enregistré, il n'y a rien à convertir.
    if ((isXOF(to) && isXOF(settings.currency)) || !hasAmounts) store.changeCurrency(to)
    else setCurrencyTo(to)
  }
  async function toggleBiometric(on: boolean) {
    if (!on) return updateSettings({ biometricId: undefined })
    const id = await biometricRegister()
    if (id) {
      updateSettings({ biometricId: id })
      toast('Déverrouillage biométrique activé')
    } else setProblem('L’activation a été annulée ou n’est pas possible sur cet appareil.')
  }
  function exportCSV() {
    download(`braz-transactions-${todayISO()}.csv`, toCSV(transactions, categories, accounts), 'text/csv;charset=utf-8').then(
      (ok) => ok && toast('Transactions exportées'),
    )
  }
  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const text = await file.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        /* readBackup renverra le message adapté */
      }
      // Sauvegarde protégée : on demande d'abord son mot de passe.
      if (isEncrypted(raw)) setLocked(raw)
      else setPending(readBackup(text))
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Ce fichier est illisible.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const lastBackup = settings.lastBackupAt
    ? `Dernière le ${new Date(settings.lastBackupAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : 'Aucune pour l’instant'

  return (
    <>
      <PageHeader title="Paramètres" />

      <div className="max-w-2xl">
        <Section title="Devise" index={0}>
          <Segmented label="Devise" options={CURRENCIES} value={settings.currency} onChange={pickCurrency} />
        </Section>

        <Section title="Sécurité" index={1}>
          <div className="card divide-y divide-line overflow-hidden">
            {settings.pin ? (
              <>
                <Row icon={KeyRound} title="Modifier le code" text="Demandé à chaque ouverture" onClick={() => setVerify('change')} />
                <Row
                  icon={LockKeyholeOpen}
                  title="Désactiver le code"
                  onClick={() => setVerify('disable')}
                />
              </>
            ) : (
              <Row icon={LockKeyhole} title="Activer un code d’accès" text="4 chiffres, demandés à l’ouverture" onClick={() => setPinSetup(true)} />
            )}
          </div>
          {settings.pin && biometric && (
            <div className="mt-3 flex items-center gap-3">
              <ScanFace size={22} className="ml-1 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <Switch label="Face ID ou empreinte" checked={!!settings.biometricId} onChange={toggleBiometric} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Récurrences" index={2}>
          <div className="card overflow-hidden">
            <Row
              icon={Repeat}
              title="Transactions récurrentes"
              text={recurring.length ? `${recurring.length} active${recurring.length > 1 ? 's' : ''}, ajoutées chaque mois` : 'Salaire, loyer, abonnements…'}
              onClick={() => setRecurringOpen(true)}
            />
          </div>
        </Section>

        <Section title="Catégories" index={3}>
          <div className="card space-y-5 p-5">
            {(['expense', 'income'] as const).map((type) => (
              <div key={type}>
                <p className="mb-2 text-sm font-medium text-muted">{type === 'expense' ? 'Dépenses' : 'Revenus'}</p>
                <div className="flex flex-wrap gap-2">
                  {categories.filter((c) => c.type === type).map((c) => {
                    const Icon = iconFor(c.icon)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCatForm(c)}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 pl-3 pr-4 text-[15px] font-medium transition hover:brightness-[0.97] active:scale-95"
                      >
                        <Icon size={16} style={{ color: c.color }} />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <Button variant="ghost" className="-ml-2 h-10 px-3" onClick={() => setCatForm('new')}>
              <Plus size={18} strokeWidth={2.6} /> Nouvelle catégorie
            </Button>
          </div>
        </Section>

        <Section title="Données" index={4}>
          <div className="card divide-y divide-line overflow-hidden">
            <Row icon={Download} title="Exporter une sauvegarde" text={lastBackup} onClick={() => setExporting(true)} />
            <Row icon={FileSpreadsheet} title="Exporter en CSV" text="Pour Excel ou Google Sheets, non protégé" onClick={exportCSV} />
            <Row icon={Upload} title="Restaurer une sauvegarde" onClick={() => fileRef.current?.click()} />
            {empty ? (
              <Row icon={Sparkles} title="Voir un exemple" text="Quatre mois de données fictives" onClick={() => store.loadDemo().then(() => toast('Exemples chargés'))} />
            ) : (
              <Row icon={Trash2} danger title="Tout effacer" onClick={() => setWipe(true)} />
            )}
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <p className="mt-3 px-1 text-sm text-muted">Tout reste sur cet appareil. Pensez à exporter une sauvegarde.</p>
        </Section>
      </div>

      {catForm && <CategorySheet category={catForm === 'new' ? null : catForm} onClose={() => setCatForm(null)} />}
      {pinSetup && <PinSetupSheet onClose={() => setPinSetup(false)} />}
      {exporting && <ExportBackupSheet onClose={() => setExporting(false)} />}
      {locked && <UnlockBackupSheet backup={locked} onOpened={setPending} onClose={() => setLocked(null)} />}
      {verify && (
        <PinVerifySheet
          title={verify === 'change' ? 'Modifier le code' : 'Désactiver le code'}
          onClose={() => setVerify(null)}
          onVerified={() => {
            if (verify === 'change') setPinSetup(true)
            else {
              updateSettings({ pin: undefined, biometricId: undefined })
              toast('Code d’accès désactivé')
            }
          }}
        />
      )}
      {recurringOpen && <RecurringSheet onClose={() => setRecurringOpen(false)} />}
      {currencyTo && <CurrencySheet to={currencyTo} onClose={() => setCurrencyTo(null)} />}

      {pending && (
        <Sheet
          title="Restaurer la sauvegarde ?"
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="soft" onClick={() => setPending(null)}>Annuler</Button>
              <Button
                className="flex-1"
                onClick={() =>
                  store
                    // Code d'accès et suivi des sauvegardes appartiennent à l'appareil : seule la devise est restaurée.
                    .replaceAll({ ...pending, settings: { ...settings, currency: pending.settings.currency } })
                    .then(() => toast('Sauvegarde restaurée'))
                    .catch(() => setProblem('La restauration a échoué. Vos données actuelles sont intactes.'))
                    .finally(() => setPending(null))
                }
              >
                Restaurer
              </Button>
            </>
          }
        >
          <p className="text-[15px] text-muted">
            {pending.transactions.length} transaction{pending.transactions.length > 1 ? 's' : ''}, {pending.budgets.length} budget
            {pending.budgets.length > 1 ? 's' : ''}, {pending.goals.length} objectif{pending.goals.length > 1 ? 's' : ''}. Les données
            actuelles seront remplacées.
          </p>
        </Sheet>
      )}

      {wipe && (
        <Sheet
          title="Tout effacer ?"
          onClose={() => setWipe(false)}
          footer={
            <>
              <Button variant="soft" className="flex-1" onClick={() => setWipe(false)}>Annuler</Button>
              <ConfirmDelete
                label="Tout effacer"
                onConfirm={() =>
                  store.clearAll().then(() => {
                    setWipe(false)
                    toast('Données effacées')
                  })
                }
              />
            </>
          }
        >
          <p className="text-[15px] text-muted">
            Transactions, comptes, budgets et objectifs seront supprimés de cet appareil. C’est définitif : exportez d’abord une sauvegarde.
          </p>
        </Sheet>
      )}

      {problem && (
        <Sheet title="Action impossible" onClose={() => setProblem(null)} footer={<Button className="flex-1" onClick={() => setProblem(null)}>Fermer</Button>}>
          <p className="text-[15px] text-muted">{problem}</p>
        </Sheet>
      )}
    </>
  )
}
