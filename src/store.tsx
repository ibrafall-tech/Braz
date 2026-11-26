import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as db from './db'
import { encryptBackup } from './crypto'
import type { Account, Budget, Category, Currency, Data, Goal, Recurring, SavingsMove, Settings, Transaction, Transfer } from './types'
import {
  DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, accountBalances, budgetAlerts, convertData, currentMonth, demoData, download, dueRecurring, emptyData,
  currencySymbol, formatMoney, normalize, toBackup, todayISO,
} from './lib'

type Lists = {
  transactions: Transaction
  categories: Category
  budgets: Budget
  goals: Goal
  recurring: Recurring
  accounts: Account
  transfers: Transfer
  moves: SavingsMove
}
const DEFAULT_SETTINGS: Settings = { id: 'settings', currency: 'FCFA' }

interface Store extends Data {
  month: string
  setMonth: (m: string) => void
  save: <K extends keyof Lists>(list: K, item: Lists[K]) => void
  remove: (list: keyof Lists, id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: Data) => Promise<void>
  clearAll: () => Promise<void>
  /**
   * Enregistre une sauvegarde JSON et note la date de l'export. Avec un mot de passe, le fichier est chiffré.
   * Renvoie false si l'export a été annulé.
   */
  exportBackup: (password?: string) => Promise<boolean>
  loadDemo: () => Promise<void>
  /** Change de devise ; avec un taux, tous les montants sont convertis. */
  changeCurrency: (currency: Currency, factor?: number) => Promise<void>
  /** Solde de chaque compte */
  balances: Map<string, number>
  /** Argent disponible, tous comptes confondus */
  total: number
  /** Budgets du mois en cours proches de leur limite ou dépassés */
  alerts: ReturnType<typeof budgetAlerts>
  /** Formulaire de transaction ouvert : une transaction à modifier, 'new', ou null */
  txForm: Transaction | 'new' | null
  setTxForm: (v: Transaction | 'new' | null) => void
  transferForm: Transfer | 'new' | null
  setTransferForm: (v: Transfer | 'new' | null) => void
  money: (n: number, sign?: boolean) => string
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [txForm, setTxForm] = useState<Store['txForm']>(null)
  const [transferForm, setTransferForm] = useState<Store['transferForm']>(null)

  useEffect(() => {
    db.loadAll()
      .then(async (d) => {
        const stored: Data = {
          transactions: d.transactions ?? [],
          categories: d.categories ?? [],
          budgets: d.budgets ?? [],
          goals: d.goals ?? [],
          recurring: d.recurring ?? [],
          accounts: d.accounts ?? [],
          transfers: d.transfers ?? [],
          moves: d.moves ?? [],
          settings: { ...DEFAULT_SETTINGS, ...d.settings, id: 'settings' },
        }
        // Première ouverture ou données d'une version précédente : mise au format courant, une fois.
        const next = normalize({ ...stored, categories: stored.categories.length ? stored.categories : DEFAULT_CATEGORIES })
        if (JSON.stringify(next) !== JSON.stringify(stored)) await db.replaceAll(next)
        setData(next)
        // Demande au navigateur de ne pas purger les données locales.
        navigator.storage?.persist?.().catch(() => {})
      })
      .catch(() => setError('Impossible d’ouvrir le stockage local. Vérifiez que la navigation privée est désactivée, puis rechargez la page.'))
  }, [])

  const save = useCallback<Store['save']>((list, item) => {
    setData((d) => {
      if (!d) return d
      const items = d[list] as { id: string }[]
      const exists = items.some((x) => x.id === item.id)
      return { ...d, [list]: exists ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item] }
    })
    db.put(list, item).catch(() => setError('L’enregistrement a échoué. Rechargez la page et réessayez.'))
  }, [])

  const remove = useCallback<Store['remove']>((list, id) => {
    setData((d) => (d ? { ...d, [list]: (d[list] as { id: string }[]).filter((x) => x.id !== id) } : d))
    db.remove(list, id).catch(() => setError('La suppression a échoué. Rechargez la page et réessayez.'))
  }, [])

  const updateSettings = useCallback<Store['updateSettings']>((patch) => {
    setData((d) => {
      if (!d) return d
      const settings = { ...d.settings, ...patch }
      db.put('meta', settings).catch(() => {})
      return { ...d, settings }
    })
  }, [])

  const replaceAll = useCallback(async (incoming: Data) => {
    const next = normalize(incoming)
    await db.replaceAll(next)
    setData(next)
  }, [])

  // Crée les transactions récurrentes arrivées à échéance : au chargement, et au retour dans l'application un autre jour.
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const onVisible = () => !document.hidden && setToday(todayISO())
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const recurring = data?.recurring
  useEffect(() => {
    if (!recurring) return
    const due = dueRecurring(recurring, today)
    due.transactions.forEach((t) => save('transactions', t))
    due.recurring.forEach((r) => save('recurring', r))
  }, [recurring, today, save])

  const value = useMemo<Store | null>(() => {
    if (!data) return null
    // Catégories d'origine dans leur ordre naturel, puis les catégories personnalisées par nom.
    const rank = (id: string) => {
      const i = DEFAULT_CATEGORIES.findIndex((c) => c.id === id)
      return i < 0 ? DEFAULT_CATEGORIES.length : i
    }
    const categories = [...data.categories].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'fr'))
    // Même principe pour les comptes : ceux d'origine d'abord, puis les comptes ajoutés, par nom.
    const accountRank = (id: string) => {
      const i = DEFAULT_ACCOUNTS.findIndex((a) => a.id === id)
      return i < 0 ? DEFAULT_ACCOUNTS.length : i
    }
    const accounts = [...data.accounts].sort((a, b) => accountRank(a.id) - accountRank(b.id) || a.name.localeCompare(b.name, 'fr'))
    const balances = accountBalances(data)
    // L'historique des versements fait foi : le total de chaque objectif en est toujours déduit,
    // ce qui évite tout écart entre l'objectif et les soldes des comptes.
    const savedBy = new Map<string, number>()
    for (const m of data.moves) savedBy.set(m.goalId, (savedBy.get(m.goalId) ?? 0) + m.amount)
    const goals = data.goals.map((g) => ({ ...g, saved: Math.round((savedBy.get(g.id) ?? 0) * 100) / 100 }))
    const hide = !!data.settings.hideAmounts
    return {
      ...data,
      categories,
      accounts,
      goals,
      balances,
      total: [...balances.values()].reduce((s, n) => s + n, 0),
      alerts: budgetAlerts(data, currentMonth()),
      month,
      setMonth,
      save,
      remove,
      updateSettings,
      replaceAll,
      clearAll: () => replaceAll(emptyData(data.settings)),
      exportBackup: async (password) => {
        const plain = JSON.stringify(toBackup(data), null, 2)
        const ok = password
          ? await download(`braz-sauvegarde-protegee-${todayISO()}.json`, JSON.stringify(await encryptBackup(plain, password)), 'application/json')
          : await download(`braz-sauvegarde-${todayISO()}.json`, plain, 'application/json')
        if (ok) updateSettings({ lastBackupAt: Date.now(), backupSnoozeUntil: undefined })
        return ok
      },
      loadDemo: () => {
        const demo = demoData()
        // Les exemples s'appuient sur les catégories par défaut : on les rétablit si elles ont été supprimées.
        const ids = new Set(data.categories.map((c) => c.id))
        const cats = [...data.categories, ...DEFAULT_CATEGORIES.filter((c) => !ids.has(c.id))]
        return replaceAll({ ...demo, categories: cats, settings: data.settings })
      },
      changeCurrency: (currency, factor) =>
        replaceAll(factor ? convertData(data, factor, currency) : { ...data, settings: { ...data.settings, currency } }),
      txForm,
      setTxForm,
      transferForm,
      setTransferForm,
      money: (n, sign) => (hide ? `•••• ${currencySymbol(data.settings.currency)}` : formatMoney(n, data.settings.currency, sign)),
    }
  }, [data, month, txForm, transferForm, save, remove, updateSettings, replaceAll])

  if (error && !value) {
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center" role="alert">
        <p className="max-w-sm text-muted">{error}</p>
      </div>
    )
  }
  if (!value) return null
  return (
    <Ctx.Provider value={value}>
      {children}
      {error && (
        <div role="alert" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-neg px-4 py-3 text-sm font-medium text-white">
          {error}
        </div>
      )}
    </Ctx.Provider>
  )
}
