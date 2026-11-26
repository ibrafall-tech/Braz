import { useMemo, useState } from 'react'
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import type { Transaction } from '../types'
import { useStore } from '../store'
import {
  UNKNOWN_CATEGORY, currentMonth, daysInMonth, formatCompact, inMonth, monthShort, shiftMonth, spentByCategory, sum, todayISO,
} from '../lib'
import { Button, Empty, MonthSwitcher, Segmented, cx, stagger } from '../ui'
import { PageHeader } from '../parts'
import { Donut, MonthBars, type MonthPoint, type Slice } from '../charts'

type Period = 'month' | 'year'
const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
]

/** Écart en pourcentage par rapport à la période précédente ; null quand il n'y a pas de point de comparaison. */
const delta = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null)

export function Stats() {
  const { transactions, categories, month, setMonth, money, setTxForm, settings } = useStore()
  const [period, setPeriod] = useState<Period>('month')
  const year = month.slice(0, 4)
  const thisYear = currentMonth().slice(0, 4)
  const yearly = period === 'year'

  const within = (txs: Transaction[], prefix: string) => (prefix.length === 7 ? inMonth(txs, prefix) : txs.filter((t) => t.date.startsWith(prefix)))

  // Mois : six mois autour du mois affiché. Année : les douze mois de l'année affichée.
  const series = useMemo<MonthPoint[]>(() => {
    const months = yearly
      ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
      : (() => {
          const now = currentMonth()
          let end = shiftMonth(month, 2)
          if (end > now) end = now
          return Array.from({ length: 6 }, (_, i) => shiftMonth(end, i - 5))
        })()
    return months.map((m) => {
      const txs = inMonth(transactions, m)
      return { month: m, income: sum(txs, 'income'), expense: sum(txs, 'expense') }
    })
  }, [transactions, month, year, yearly])

  const current = useMemo(() => within(transactions, yearly ? year : month), [transactions, month, year, yearly])
  const previous = useMemo(
    () => within(transactions, yearly ? String(Number(year) - 1) : shiftMonth(month, -1)),
    [transactions, month, year, yearly],
  )
  const income = sum(current, 'income')
  const expense = sum(current, 'expense')
  const net = income - expense
  const previousLabel = yearly ? String(Number(year) - 1) : monthShort(shiftMonth(month, -1))

  const slices = useMemo<Slice[]>(() => {
    const all = [...spentByCategory(current)]
      .map(([id, value]) => {
        const cat = categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY
        return { label: cat.name, value, color: cat.color }
      })
      .sort((a, b) => b.value - a.value)
    if (all.length <= 6) return all
    const rest = all.slice(5).reduce((s, x) => s + x.value, 0)
    return [...all.slice(0, 5), { label: 'Autres', value: rest, color: '#B4B6CE' }]
  }, [current, categories])

  // Nombre de jours écoulés sur la période, pour la moyenne quotidienne
  const elapsed = useMemo(() => {
    const today = todayISO()
    if (!yearly) return month === currentMonth() ? Number(today.slice(8)) : daysInMonth(month)
    if (year !== thisYear) return Number(year) % 4 === 0 ? 366 : 365
    return Math.max(1, Math.round((Date.parse(today) - Date.parse(`${year}-01-01`)) / 86_400_000) + 1)
  }, [month, year, yearly, thisYear])

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Statistiques" />
        <Empty icon={ChartNoAxesColumn} title="Pas encore de statistiques">
          <Button onClick={() => setTxForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Ajouter une transaction
          </Button>
        </Empty>
      </>
    )
  }

  const figures = [
    { label: 'Dépenses', value: money(expense), tone: '', change: delta(expense, sum(previous, 'expense')), goodWhenDown: true },
    { label: 'Revenus', value: money(income), tone: '', change: delta(income, sum(previous, 'income')), goodWhenDown: false },
    { label: yearly ? 'Solde de l’année' : 'Solde du mois', value: money(net, true), tone: net < 0 ? 'text-neg' : 'text-pos', change: null, goodWhenDown: false },
    { label: 'Moyenne par jour', value: money(Math.round(expense / elapsed)), tone: '', change: null, goodWhenDown: false },
  ]
  const arrow = 'grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-90 disabled:opacity-30'
  const setYear = (y: number) => setMonth(`${y}-${y === Number(thisYear) ? currentMonth().slice(5) : '12'}`)

  return (
    <>
      <PageHeader title="Statistiques">
        {yearly ? (
          <div className="flex w-full items-center justify-between rounded-full border border-line bg-surface p-0.5 md:inline-flex md:w-auto">
            <button type="button" aria-label="Année précédente" className={arrow} onClick={() => setYear(Number(year) - 1)}>
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-32 px-1 text-center text-[15px] font-semibold">{year}</span>
            <button type="button" aria-label="Année suivante" className={arrow} disabled={year >= thisYear} onClick={() => setYear(Number(year) + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <MonthSwitcher />
        )}
      </PageHeader>

      <div className="mb-4 sm:max-w-xs">
        <Segmented label="Période" options={PERIODS} value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f, i) => {
          const good = f.change !== null && (f.goodWhenDown ? f.change <= 0 : f.change >= 0)
          const Trend = f.change !== null && f.change < 0 ? TrendingDown : TrendingUp
          return (
            <div key={f.label} className="card rise min-w-0 p-4 sm:p-5" style={stagger(i)}>
              <p className="truncate text-sm text-muted">{f.label}</p>
              <p className={`display num mt-1 truncate text-[clamp(0.95rem,4.6vw,1.5rem)] font-semibold ${f.tone}`}>{f.value}</p>
              {f.change !== null && (
                <p className={cx('mt-1.5 flex items-center gap-1 truncate text-xs font-semibold', good ? 'text-pos' : 'text-neg')}>
                  <Trend size={14} className="shrink-0" />
                  <span className="truncate">{f.change > 0 ? '+' : ''}{f.change} % vs {previousLabel}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card rise p-5 sm:p-6" style={stagger(4)}>
          <h2 className="display mb-5 text-lg font-semibold">Revenus et dépenses</h2>
          <MonthBars
            key={`${period}-${series[0].month}`}
            data={series}
            selected={yearly ? '' : month}
            compact={yearly}
            onSelect={(m) => {
              setMonth(m > currentMonth() ? currentMonth() : m)
              setPeriod('month')
            }}
            describe={(p) => `revenus ${money(p.income)}, dépenses ${money(p.expense)}`}
          />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className="size-2.5 rounded-full bg-[#3fbf98]" /> Revenus
              </dt>
              <dd className="num truncate font-semibold">{money(income)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className="size-2.5 rounded-full bg-ember" /> Dépenses
              </dt>
              <dd className="num truncate font-semibold">{money(expense)}</dd>
            </div>
          </dl>
        </section>

        <section className="card rise p-5 sm:p-6" style={stagger(5)}>
          <h2 className="display mb-5 text-lg font-semibold">Répartition des dépenses</h2>
          {slices.length ? (
            <div className="flex flex-col items-center gap-6 sm:max-lg:flex-row sm:max-lg:items-start">
              <Donut key={`${period}-${month}`} slices={slices}>
                <div>
                  <p className="text-xs text-muted">Total</p>
                  <p className="display num text-lg font-semibold leading-tight">{settings.hideAmounts ? "••••" : formatCompact(expense)}</p>
                </div>
              </Donut>
              <ul className="w-full min-w-0 flex-1 space-y-3">
                {slices.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5 text-[15px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="num shrink-0 text-muted">{Math.round((s.value / expense) * 100)} %</span>
                    <span className="num min-w-24 shrink-0 text-right font-semibold">{money(s.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-[15px] text-muted">Aucune dépense sur cette période.</p>
          )}
        </section>
      </div>
    </>
  )
}
