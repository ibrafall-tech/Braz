import { useEffect, useState } from 'react'
import { ChartNoAxesColumn, House, ArrowLeftRight, PiggyBank, Plus, Settings, Target, type LucideIcon } from 'lucide-react'
import { useStore } from './store'
import { cx } from './ui'
import { Logo } from './parts'
import { TransactionSheet, TransferSheet } from './sheets'
import { Lock } from './lock'
import { Home } from './pages/Home'
import { Transactions } from './pages/Transactions'
import { Budgets } from './pages/Budgets'
import { Savings } from './pages/Savings'
import { Stats } from './pages/Stats'
import { SettingsPage } from './pages/Settings'

const ROUTES: { path: string; label: string; full?: string; icon: LucideIcon; page: () => React.JSX.Element }[] = [
  { path: '', label: 'Accueil', icon: House, page: Home },
  { path: 'transactions', label: 'Transactions', icon: ArrowLeftRight, page: Transactions },
  { path: 'budgets', label: 'Budgets', icon: Target, page: Budgets },
  { path: 'epargne', label: 'Épargne', icon: PiggyBank, page: Savings },
  { path: 'stats', label: 'Stats', full: 'Statistiques', icon: ChartNoAxesColumn, page: Stats },
  { path: 'parametres', label: 'Paramètres', icon: Settings, page: SettingsPage },
]

/** Délai d'absence au-delà duquel l'application se reverrouille. */
const RELOCK_AFTER_MS = 60_000

const readPath = () => location.hash.replace(/^#\/?/, '').split('?')[0]

function useRoute() {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    const onChange = () => {
      setPath(readPath())
      window.scrollTo(0, 0)
    }
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return ROUTES.find((r) => r.path === path) ?? ROUTES[0]
}

export function App() {
  const route = useRoute()
  const { txForm, setTxForm, transferForm, setTransferForm, settings, alerts } = useStore()
  const hasPin = !!settings.pin
  const [locked, setLocked] = useState(hasPin)
  const Page = route.page

  // Reverrouille après une absence prolongée (application en arrière-plan).
  useEffect(() => {
    if (!hasPin) return
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [hasPin])

  // Raccourci d'application « Nouvelle transaction »
  useEffect(() => {
    if (location.hash.includes('nouveau=1')) {
      history.replaceState(null, '', '#/')
      setTxForm('new')
    }
  }, [setTxForm])

  if (locked && hasPin) return <Lock onUnlock={() => setLocked(false)} />

  return (
    <div className="min-h-dvh md:pl-20 xl:pl-64">
      {/* Barre latérale : rail d'icônes sur tablette, complète sur grand écran */}
      <aside className="fixed inset-y-0 left-0 hidden w-20 flex-col border-r border-line bg-surface px-3 py-6 md:flex xl:w-64 xl:px-4">
        <a href="#/" className="mb-8 flex items-center justify-center gap-3 rounded-xl xl:justify-start xl:px-2">
          <Logo size={40} />
          <span className="display hidden text-2xl font-bold tracking-tight xl:inline">braz</span>
        </a>
        <button
          type="button"
          onClick={() => setTxForm('new')}
          aria-label="Nouvelle transaction"
          className="group mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#cc4824] font-semibold text-white shadow-[0_10px_22px_-10px_var(--ember)] transition hover:brightness-105 active:scale-[0.97]"
        >
          <Plus size={20} strokeWidth={2.6} className="transition-transform duration-300 group-hover:rotate-90" />
          <span className="hidden xl:inline">Nouvelle transaction</span>
        </button>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1">
          {ROUTES.map((r, i) => {
            const on = r === route
            return (
              <a
                key={r.path}
                href={`#/${r.path}`}
                title={r.full ?? r.label}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-11 items-center justify-center gap-3 rounded-xl font-semibold transition xl:justify-start xl:px-3',
                  on ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  i === ROUTES.length - 1 && 'mt-auto',
                )}
              >
                <span className="relative">
                  <r.icon size={20} strokeWidth={on ? 2.4 : 2} />
                  {r.path === 'budgets' && alerts.length > 0 && (
                    <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-ember ring-2 ring-surface" aria-label="Budget à surveiller" />
                  )}
                </span>
                <span className="hidden xl:inline">{r.full ?? r.label}</span>
              </a>
            )
          })}
        </nav>
      </aside>

      <main
        key={route.path}
        className="page mx-auto w-full max-w-5xl pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(7.5rem+env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 md:px-8 md:pt-10 md:pb-16 lg:px-10"
      >
        <Page />
      </main>

      {/* Navigation basse — mobile */}
      <button
        type="button"
        onClick={() => setTxForm('new')}
        aria-label="Nouvelle transaction"
        className="group fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-ember text-white shadow-[0_12px_24px_-8px_var(--ember)] transition duration-150 active:scale-90 md:hidden"
      >
        <Plus size={26} strokeWidth={2.6} className="transition-transform duration-300 group-active:rotate-90" />
      </button>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {ROUTES.slice(0, 5).map((r) => {
            const on = r === route
            return (
              <a
                key={r.path}
                href={`#/${r.path}`}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors active:scale-95',
                  on ? 'text-primary' : 'text-muted',
                )}
              >
                <span className="relative grid h-7 w-12 place-items-center">
                  {on && <span className="pill-in absolute inset-0 rounded-full bg-primary-soft" />}
                  <r.icon size={20} strokeWidth={on ? 2.4 : 2} className="relative" />
                  {r.path === 'budgets' && alerts.length > 0 && (
                    <span className="absolute right-2 top-0 size-2.5 rounded-full bg-ember ring-2 ring-surface" aria-label="Budget à surveiller" />
                  )}
                </span>
                <span className="max-w-full truncate text-[10px] font-semibold leading-none min-[360px]:text-[11px]">{r.label}</span>
              </a>
            )
          })}
        </div>
      </nav>

      {txForm && <TransactionSheet tx={txForm === 'new' ? null : txForm} onClose={() => setTxForm(null)} />}
      {transferForm && <TransferSheet transfer={transferForm === 'new' ? null : transferForm} onClose={() => setTransferForm(null)} />}
    </div>
  )
}
