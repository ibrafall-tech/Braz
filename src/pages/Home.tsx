import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, PiggyBank, Plus, ShieldCheck, TriangleAlert, Wallet, X } from 'lucide-react'
import type { Account } from '../types'
import { useStore } from '../store'
import { currentMonth, daysInMonth, inMonth, monthLabel, sortTx, spentByCategory, sum, todayISO } from '../lib'
import { iconFor } from '../icons'
import { Button, Empty, IconChip, Money, MonthSwitcher, Progress, stagger, useToast } from '../ui'
import { Logo, PageHeader, SectionHead, TxRow } from '../parts'
import { Sparkline } from '../charts'
import { AccountSheet } from '../sheets'

const DAY = 86_400_000

export function Home() {
  const {
    transactions, goals, budgets, categories, accounts, transfers, moves, balances, total, alerts, month, money, settings,
    setTxForm, setTransferForm, loadDemo, updateSettings, exportBackup,
  } = useStore()
  const toast = useToast()
  const [accountForm, setAccountForm] = useState<Account | 'new' | null>(null)

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0)
  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month])
  const income = sum(monthTx, 'income')
  const expense = sum(monthTx, 'expense')
  const recent = useMemo(() => sortTx(monthTx).slice(0, 6), [monthTx])

  // Solde disponible jour par jour sur le mois affiché, calculé comme le solde des comptes :
  // soldes de départ + revenus − dépenses − argent placé en épargne (les transferts s'annulent).
  const curve = useMemo(() => {
    const start = `${month}-01`
    const flows = [
      ...transactions.map((t) => ({ date: t.date, n: t.type === 'income' ? t.amount : -t.amount })),
      ...moves.map((m) => ({ date: m.date, n: -m.amount })),
    ]
    let running = accounts.reduce((s, a) => s + (a.initial || 0), 0)
    const byDay = new Map<number, number>()
    for (const f of flows) {
      if (f.date < start) running += f.n
      else if (f.date.startsWith(month)) byDay.set(Number(f.date.slice(8)), (byDay.get(Number(f.date.slice(8))) ?? 0) + f.n)
    }
    const last = month === currentMonth() ? Number(todayISO().slice(8)) : daysInMonth(month)
    const values = [running]
    for (let d = 1; d <= last; d++) values.push((running += byDay.get(d) ?? 0))
    return values
  }, [transactions, moves, accounts, month])
  // Mois passé : solde à la fin de ce mois. Mois en cours : solde réel des comptes.
  const isCurrent = month === currentMonth()
  const shownBalance = isCurrent ? total : curve[curve.length - 1]

  const spent = useMemo(() => spentByCategory(monthTx), [monthTx])
  const topBudgets = budgets
    .map((b) => ({ b, cat: categories.find((c) => c.id === b.categoryId), used: spent.get(b.categoryId) ?? 0 }))
    .filter((x) => x.cat)
    .sort((a, z) => z.used / z.b.limit - a.used / a.b.limit)
    .slice(0, 3)

  // Rappel de sauvegarde : dès qu'il y a des données, tous les 30 jours, reportable d'une semaine.
  const [now] = useState(() => Date.now())
  const backupAge = settings.lastBackupAt ? Math.floor((now - settings.lastBackupAt) / DAY) : null
  const remind =
    transactions.length >= 5 && now > (settings.backupSnoozeUntil ?? 0) && (backupAge === null || backupAge >= 30)

  const hour = new Date().getHours()
  const firstRun = transactions.length === 0 && goals.length === 0 && budgets.length === 0 && transfers.length === 0

  return (
    <>
      <PageHeader title={hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'} lead={<span className="md:hidden"><Logo /></span>}>
        <MonthSwitcher />
      </PageHeader>

      <section className="hero rise relative overflow-hidden rounded-[2rem]">
        <div className="px-6 pt-6 md:px-8 md:pt-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium text-ink/70">
              {isCurrent ? 'Solde disponible' : `Solde fin ${monthLabel(month).toLowerCase()}`}
            </p>
            <button
              type="button"
              onClick={() => updateSettings({ hideAmounts: !settings.hideAmounts })}
              aria-pressed={!!settings.hideAmounts}
              aria-label={settings.hideAmounts ? 'Afficher les montants' : 'Masquer les montants'}
              title={settings.hideAmounts ? 'Afficher les montants' : 'Masquer les montants'}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-white/60 active:scale-90"
            >
              {settings.hideAmounts ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className={`display num mt-1 text-[clamp(2rem,10.5vw,3.75rem)] font-semibold leading-none ${shownBalance < 0 ? 'text-neg' : ''}`}>
            <Money value={shownBalance} />
          </p>
          {totalSaved > 0 && (
            <a
              href="#/epargne"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/65 px-3 py-1 text-sm font-semibold text-ink/75 transition hover:bg-white"
            >
              <PiggyBank size={15} className="text-primary" />
              {money(totalSaved)} épargnés
            </a>
          )}
        </div>
        <div className="mt-4">
          <Sparkline key={month} values={curve} />
        </div>
        <dl className="grid grid-cols-2 bg-white/45 backdrop-blur-sm">
          <div className="min-w-0 px-4 py-4 min-[380px]:px-6 md:px-8">
            <dt className="flex items-center gap-1.5 text-sm text-ink/70">
              <span className="grid size-5 place-items-center rounded-full bg-pos/15 text-pos"><ArrowDownLeft size={13} strokeWidth={2.6} /></span>
              Revenus
            </dt>
            <dd className="num mt-0.5 truncate text-[clamp(0.9rem,4.5vw,1.125rem)] font-semibold"><Money value={income} /></dd>
          </div>
          <div className="min-w-0 border-l border-white/70 px-4 py-4 min-[380px]:px-6 md:px-8">
            <dt className="flex items-center gap-1.5 text-sm text-ink/70">
              <span className="grid size-5 place-items-center rounded-full bg-ember/15 text-ember"><ArrowUpRight size={13} strokeWidth={2.6} /></span>
              Dépenses
            </dt>
            <dd className="num mt-0.5 truncate text-[clamp(0.9rem,4.5vw,1.125rem)] font-semibold"><Money value={expense} /></dd>
          </div>
        </dl>
      </section>

      {alerts.length > 0 && (
        <a href="#/budgets" className="card rise mt-4 flex items-center gap-3 px-4 py-3 transition active:scale-[0.99]" style={stagger(1)}>
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ember/12 text-ember"><TriangleAlert size={20} /></span>
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight">
            {alerts[0].ratio >= 1 ? `Budget ${alerts[0].name} dépassé` : `Budget ${alerts[0].name} : ${Math.round(alerts[0].ratio * 100)} % utilisé`}
            {alerts.length > 1 && (
              <span className="block text-sm font-normal text-muted">et {alerts.length - 1} autre{alerts.length > 2 ? 's' : ''} à surveiller</span>
            )}
          </p>
        </a>
      )}

      {remind && (
        <div className="card rise mt-4 flex items-center gap-3 py-3 pl-4 pr-2" style={stagger(1)}>
          <ShieldCheck size={22} className="hidden shrink-0 text-primary min-[380px]:block" />
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight">
            Sauvegardez vos données
            <span className="block truncate text-sm font-normal text-muted">
              {backupAge === null ? 'Aucune sauvegarde pour l’instant' : `Dernière il y a ${backupAge} jours`}
            </span>
          </p>
          <Button className="h-10 shrink-0 px-4" onClick={() => exportBackup().then((ok) => ok && toast('Sauvegarde exportée'))}>
            Exporter
          </Button>
          <button
            type="button"
            aria-label="Me le rappeler plus tard"
            onClick={() => updateSettings({ backupSnoozeUntil: Date.now() + 7 * DAY })}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <section className="rise mt-8" style={stagger(2)}>
        <SectionHead title="Comptes" linkLabel="Transférer" onAction={accounts.length > 1 ? () => setTransferForm('new') : undefined} />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
          {accounts.map((a) => {
            const balance = balances.get(a.id) ?? 0
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountForm(a)}
                className="card w-40 shrink-0 p-4 text-left transition hover:border-primary/40 active:scale-[0.97] sm:w-auto"
              >
                <IconChip icon={a.icon} color={a.color} size={36} />
                <p className="mt-3 truncate text-sm text-muted">{a.name}</p>
                <p className={`num truncate font-semibold ${balance < 0 ? 'text-neg' : ''}`}>{money(balance)}</p>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setAccountForm('new')}
            className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed border-line p-4 text-sm font-semibold text-muted transition hover:border-primary/50 hover:text-primary active:scale-[0.97] sm:w-auto"
          >
            <Plus size={20} /> Compte
          </button>
        </div>
      </section>

      {firstRun ? (
        <div className="card rise mt-6" style={stagger(3)}>
          <Empty icon={Wallet} title="Bienvenue sur BRAZ" text="Ajoutez une première transaction pour démarrer.">
            <Button onClick={() => setTxForm('new')}>Ajouter une transaction</Button>
            <Button variant="soft" onClick={() => loadDemo().then(() => toast('Exemples chargés'))}>
              Voir un exemple
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-5">
          <section className="rise lg:col-span-3" style={stagger(3)}>
            <SectionHead title="Dernières transactions" href="#/transactions" />
            <div className="card p-1.5">
              {recent.length ? (
                recent.map((t, i) => <TxRow key={t.id} tx={t} index={i} />)
              ) : (
                <p className="px-4 py-8 text-center text-[15px] text-muted">Aucune transaction ce mois-ci.</p>
              )}
            </div>
          </section>

          <div className="grid content-start gap-8 sm:max-lg:grid-cols-2 lg:col-span-2">
            <section className="rise" style={stagger(4)}>
              <SectionHead title="Budgets" href="#/budgets" linkLabel={budgets.length ? 'Tout voir' : 'Créer'} />
              <div className="card space-y-4 p-5">
                {topBudgets.length ? (
                  topBudgets.map(({ b, cat, used }) => {
                    const over = used > b.limit
                    return (
                      <div key={b.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="truncate font-semibold">{cat!.name}</span>
                          <span className={`num shrink-0 text-sm ${over ? 'font-semibold text-neg' : 'text-muted'}`}>
                            {Math.round((used / b.limit) * 100)} %
                          </span>
                        </div>
                        <Progress ratio={used / b.limit} color={over ? 'var(--neg)' : cat!.color} />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-[15px] text-muted">Aucun budget.</p>
                )}
              </div>
            </section>

            <section className="rise" style={stagger(5)}>
              <SectionHead title="Épargne" href="#/epargne" linkLabel={goals.length ? 'Tout voir' : 'Créer'} />
              <div className="card space-y-4 p-5">
                {goals.length ? (
                  goals.slice(0, 3).map((g) => {
                    const Icon = iconFor(g.icon)
                    return (
                      <div key={g.id} className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ color: g.color, background: `color-mix(in srgb, ${g.color} 13%, white)` }}>
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="truncate font-semibold">{g.name}</span>
                            <span className="num shrink-0 text-sm text-muted">{Math.min(100, Math.round((g.saved / g.target) * 100))} %</span>
                          </div>
                          <Progress ratio={g.saved / g.target} color={g.color} />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-[15px] text-muted">Aucun objectif.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {accountForm && <AccountSheet account={accountForm === 'new' ? null : accountForm} onClose={() => setAccountForm(null)} />}
    </>
  )
}
