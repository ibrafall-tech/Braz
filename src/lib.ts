import type { Account, Backup, Category, Currency, Data, Goal, Recurring, Settings, Transaction, Budget } from './types'

export const uid = () => crypto.randomUUID()

/* ---------- Dates ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const currentMonth = () => todayISO().slice(0, 7)
const parse = (iso: string) => new Date(iso.length === 7 ? `${iso}-01T12:00:00` : `${iso}T12:00:00`)

export function shiftMonth(month: string, delta: number): string {
  const d = parse(month)
  d.setMonth(d.getMonth() + delta)
  return toISO(d).slice(0, 7)
}
export function shiftDay(iso: string, delta: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + delta)
  return toISO(d)
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const monthLabel = (month: string) =>
  cap(parse(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
export const monthShort = (month: string) =>
  parse(month).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
export function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Aujourd’hui'
  if (iso === shiftDay(today, -1)) return 'Hier'
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  return cap(
    parse(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
    }),
  )
}
export const dateLabel = (iso: string) =>
  parse(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/* ---------- Montants ---------- */

const SYMBOL: Record<Currency, string> = { FCFA: 'FCFA', XOF: 'XOF', EUR: '€', USD: '$' }
export const currencySymbol = (c: Currency) => SYMBOL[c]
export const decimals = (c: Currency) => (c === 'FCFA' || c === 'XOF' ? 0 : 2)

export function formatNumber(n: number, c: Currency): string {
  const dec = decimals(c)
  const abs = Math.abs(n)
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: dec,
    minimumFractionDigits: Number.isInteger(abs) ? 0 : dec,
  }).format(abs)
}
export function formatMoney(n: number, c: Currency, sign = false): string {
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${prefix}${formatNumber(n, c)} ${SYMBOL[c]}`
}
/** Format compact pour les axes : 125 k, 1,2 M */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Plafond de saisie : au-delà, les calculs en virgule flottante perdent leur précision. */
export const MAX_AMOUNT = 999_999_999_999
export function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : 0
}
/** Met en forme la saisie d'un montant : « 125000 » → « 125 000 » */
export function formatAmountInput(raw: string, c: Currency): string {
  let s = raw.replace(/[^\d.,]/g, '').replace('.', ',')
  const [int = '', ...rest] = s.split(',')
  const grouped = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (decimals(c) === 0 || s.indexOf(',') === -1) return grouped
  s = `${grouped || '0'},${rest.join('').slice(0, 2)}`
  return s
}
export const amountToInput = (n: number, c: Currency) =>
  n ? formatAmountInput(String(n).replace('.', ','), c) : ''

/* ---------- Catégories ---------- */

export const PALETTE = [
  '#4B4EE6', '#FF5B2E', '#0E9F6E', '#E0A100', '#D6336C',
  '#0C8CE9', '#8B5CF6', '#0FA3A3', '#A0714F', '#7A7FA3',
]

const c = (id: string, name: string, type: Category['type'], icon: string, color: string): Category => ({
  id, name, type, icon, color,
})
export const DEFAULT_CATEGORIES: Category[] = [
  c('alimentation', 'Alimentation', 'expense', 'utensils', '#FF5B2E'),
  c('transport', 'Transport', 'expense', 'bus', '#0C8CE9'),
  c('logement', 'Logement', 'expense', 'home', '#4B4EE6'),
  c('etudes', 'Études', 'expense', 'graduation', '#8B5CF6'),
  c('sante', 'Santé', 'expense', 'heart', '#D6336C'),
  c('loisirs', 'Loisirs', 'expense', 'gamepad', '#E0A100'),
  c('shopping', 'Shopping', 'expense', 'bag', '#0FA3A3'),
  c('factures', 'Factures', 'expense', 'receipt', '#A0714F'),
  c('communication', 'Communication', 'expense', 'phone', '#0E9F6E'),
  c('autres', 'Autres', 'expense', 'more', '#7A7FA3'),
  c('salaire', 'Salaire', 'income', 'briefcase', '#0E9F6E'),
  c('bourse', 'Bourse', 'income', 'award', '#8B5CF6'),
  c('freelance', 'Freelance', 'income', 'laptop', '#0C8CE9'),
  c('cadeau', 'Cadeau', 'income', 'gift', '#D6336C'),
  c('autres-revenus', 'Autres revenus', 'income', 'coins', '#7A7FA3'),
]

export const UNKNOWN_CATEGORY: Category = c('?', 'Sans catégorie', 'expense', 'more', '#7A7FA3')

/* ---------- Comptes ---------- */

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'especes', name: 'Espèces', icon: 'wallet', color: '#0E9F6E', initial: 0 },
  { id: 'banque', name: 'Compte bancaire', icon: 'bank', color: '#4B4EE6', initial: 0 },
  { id: 'mobile', name: 'Mobile money', icon: 'phone', color: '#FF5B2E', initial: 0 },
]

/** Solde de chaque compte : départ + revenus − dépenses ± transferts − argent placé en épargne. */
export function accountBalances(d: Pick<Data, 'accounts' | 'transactions' | 'transfers' | 'moves'>): Map<string, number> {
  const b = new Map(d.accounts.map((a) => [a.id, a.initial || 0]))
  const add = (id: string | undefined, n: number) => {
    if (id && b.has(id)) b.set(id, b.get(id)! + n)
  }
  for (const t of d.transactions) add(t.accountId, t.type === 'income' ? t.amount : -t.amount)
  for (const t of d.transfers) {
    add(t.fromId, -t.amount)
    add(t.toId, t.amount)
  }
  for (const m of d.moves) add(m.accountId, -m.amount)
  return b
}

export function emptyData(settings: Settings): Data {
  return {
    transactions: [], budgets: [], goals: [], recurring: [], transfers: [], moves: [],
    categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, settings,
  }
}

/**
 * Met des données anciennes ou importées au format courant : comptes par défaut,
 * rattachement de chaque mouvement à un compte, historique d'épargne reconstitué.
 */
export function normalize(d: Data): Data {
  const accounts = d.accounts.length ? d.accounts : DEFAULT_ACCOUNTS
  const main = accounts[0].id
  const ids = new Set(accounts.map((a) => a.id))
  const fix = <T extends { accountId?: string }>(x: T): T => (x.accountId && ids.has(x.accountId) ? x : { ...x, accountId: main })
  const withHistory = new Set(d.moves.map((m) => m.goalId))
  const initialMoves = d.goals
    .filter((g) => g.saved > 0 && !withHistory.has(g.id))
    .map((g) => ({ id: `init-${g.id}`, goalId: g.id, accountId: main, amount: g.saved, date: toISO(new Date(g.createdAt)), createdAt: g.createdAt }))
  return {
    ...d,
    accounts,
    transactions: d.transactions.map(fix),
    recurring: d.recurring.map(fix),
    moves: [...d.moves.map(fix), ...initialMoves],
  }
}

/** Convertit tous les montants dans une autre devise. */
export function convertData(d: Data, factor: number, currency: Currency): Data {
  const p = 10 ** decimals(currency)
  const r = (n: number) => Math.round(n * factor * p) / p
  const amount = <T extends { amount: number }>(x: T): T => ({ ...x, amount: r(x.amount) })
  const moves = d.moves.map(amount)
  return {
    ...d,
    transactions: d.transactions.map(amount),
    recurring: d.recurring.map(amount),
    transfers: d.transfers.map(amount),
    moves,
    budgets: d.budgets.map((b) => ({ ...b, limit: r(b.limit) })),
    // Le total épargné est recalculé depuis l'historique pour rester exact après arrondi.
    goals: d.goals.map((g) => ({
      ...g,
      target: r(g.target),
      saved: Math.round(moves.reduce((s, m) => (m.goalId === g.id ? s + m.amount : s), 0) * p) / p,
    })),
    accounts: d.accounts.map((a) => ({ ...a, initial: r(a.initial) })),
    settings: { ...d.settings, currency },
  }
}

/** Budgets du mois proches de leur limite (85 % et plus) ou dépassés. */
export function budgetAlerts(d: Pick<Data, 'budgets' | 'categories' | 'transactions'>, month: string) {
  const spent = spentByCategory(inMonth(d.transactions, month))
  return d.budgets
    .map((b) => ({ id: b.id, name: d.categories.find((c) => c.id === b.categoryId)?.name ?? '', ratio: (spent.get(b.categoryId) ?? 0) / b.limit }))
    .filter((a) => a.name && a.ratio >= 0.85)
    .sort((a, b) => b.ratio - a.ratio)
}

/* ---------- Calculs ---------- */

export const sum = (txs: Transaction[], type: Transaction['type']) =>
  txs.reduce((s, t) => (t.type === type ? s + t.amount : s), 0)
export const inMonth = (txs: Transaction[], month: string) => txs.filter((t) => t.date.startsWith(month))
export const sortTx = (txs: Transaction[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))

export function spentByCategory(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) if (t.type === 'expense') map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  return map
}

/* ---------- Récurrences ---------- */

export const recurringDate = (month: string, day: number) => `${month}-${pad(Math.min(day, daysInMonth(month)))}`

/**
 * Transactions à créer pour les récurrences arrivées à échéance, et récurrences mises à jour.
 * L'identifiant de chaque transaction est déterministe : rejouer le calcul ne crée pas de doublon.
 */
export function dueRecurring(recurring: Recurring[], today: string): { transactions: Transaction[]; recurring: Recurring[] } {
  const transactions: Transaction[] = []
  const updated: Recurring[] = []
  const thisMonth = today.slice(0, 7)
  for (const r of recurring) {
    let month = r.lastRun ? shiftMonth(r.lastRun, 1) : r.startMonth
    let last = r.lastRun
    for (let guard = 0; month <= thisMonth && guard < 60; guard++) {
      const date = recurringDate(month, r.day)
      if (date > today) break
      transactions.push({
        id: `${r.id}-${month}`,
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        note: r.note,
        date,
        createdAt: Date.now(),
        recurringId: r.id,
        accountId: r.accountId,
      })
      last = month
      month = shiftMonth(month, 1)
    }
    if (last !== r.lastRun) updated.push({ ...r, lastRun: last })
  }
  return { transactions, recurring: updated }
}

/* ---------- Code d'accès ---------- */

/** Empreinte salée du code. Verrou d'écran local : les données ne sont pas chiffrées. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const text = `${salt}:${pin}`
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Hors contexte sécurisé (HTTP), crypto.subtle n'existe pas : empreinte FNV-1a de repli.
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}

/* ---------- Sauvegarde ---------- */

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Enregistre un fichier. Renvoie false si l'utilisateur a annulé. */
export async function download(filename: string, content: string, type: string): Promise<boolean> {
  // Sur iPhone, une application installée ne sait pas télécharger un lien : on passe par la feuille de partage.
  if (isIOS() && typeof navigator.share === 'function') {
    const file = new File([content], filename, { type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return true
      } catch {
        return false
      }
    }
  }
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export function toBackup(data: Data): Backup {
  // Le code d'accès reste propre à l'appareil : il n'est jamais exporté.
  const settings = { id: 'settings' as const, currency: data.settings.currency }
  return { app: 'braz', version: 1, exportedAt: new Date().toISOString(), ...data, settings }
}

/* Contrôles de forme de chaque élément d'une sauvegarde importée */
const isStr = (v: unknown): v is string => typeof v === 'string'
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT
const isPositive = (v: unknown) => isAmount(v) && v > 0
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isType = (v: unknown) => v === 'income' || v === 'expense'
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const CHECKS: Record<keyof Omit<Data, 'settings'>, [string, (x: Record<string, unknown>) => boolean]> = {
  transactions: ['transactions', (t) => isStr(t.id) && isType(t.type) && isPositive(t.amount) && isStr(t.categoryId) && isDate(t.date)],
  categories: ['catégories', (c) => isStr(c.id) && isStr(c.name) && isType(c.type)],
  budgets: ['budgets', (b) => isStr(b.id) && isStr(b.categoryId) && isPositive(b.limit)],
  goals: ['objectifs', (g) => isStr(g.id) && isStr(g.name) && isPositive(g.target)],
  recurring: ['récurrences', (r) => isStr(r.id) && isType(r.type) && isPositive(r.amount) && isStr(r.categoryId)
    && Number.isInteger(r.day) && /^\d{4}-\d{2}$/.test(String(r.startMonth))],
  accounts: ['comptes', (a) => isStr(a.id) && isStr(a.name) && (a.initial === undefined || isAmount(a.initial))],
  transfers: ['transferts', (t) => isStr(t.id) && isStr(t.fromId) && isStr(t.toId) && isPositive(t.amount) && isDate(t.date)],
  moves: ['mouvements d’épargne', (m) => isStr(m.id) && isStr(m.goalId) && isAmount(m.amount) && isDate(m.date)],
}
const CURRENCIES: Currency[] = ['FCFA', 'XOF', 'EUR', 'USD']

/** Valide un fichier de sauvegarde ; lève une erreur lisible si le fichier n'est pas exploitable. */
export function readBackup(text: string): Data {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde BRAZ lisible.')
  }
  if (!isObj(raw) || raw.app !== 'braz' || !Array.isArray(raw.transactions) || !Array.isArray(raw.categories)) {
    throw new Error('Ce fichier n’est pas une sauvegarde BRAZ.')
  }
  // Chaque élément est vérifié : une donnée mal formée ferait planter l'application après la restauration.
  const out: Record<string, unknown[]> = {}
  for (const [key, [label, ok]] of Object.entries(CHECKS)) {
    const list = raw[key] ?? []
    if (!Array.isArray(list) || !list.every((x) => isObj(x) && ok(x))) {
      throw new Error(`La sauvegarde contient des ${label} invalides.`)
    }
    out[key] = list
  }
  const currency = isObj(raw.settings) && CURRENCIES.includes(raw.settings.currency as Currency) ? (raw.settings.currency as Currency) : 'FCFA'
  return { ...(out as unknown as Omit<Data, 'settings'>), settings: { id: 'settings', currency } }
}

export function toCSV(txs: Transaction[], categories: Category[], accounts: Account[]): string {
  const cat = new Map(categories.map((x) => [x.id, x.name]))
  const acc = new Map(accounts.map((x) => [x.id, x.name]))
  // Un texte commençant par = + - @ serait interprété comme une formule par Excel : on le neutralise.
  const esc = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
  const rows = sortTx(txs).map((t) =>
    [t.date, t.type === 'income' ? 'Revenu' : 'Dépense', esc(cat.get(t.categoryId) ?? ''), esc(acc.get(t.accountId ?? '') ?? ''), String(t.amount).replace('.', ','), esc(t.note)].join(';'),
  )
  return '﻿' + ['Date;Type;Catégorie;Compte;Montant;Description', ...rows].join('\r\n')
}

/* ---------- Données d'exemple ---------- */

export function demoData(): Pick<Data, 'transactions' | 'budgets' | 'goals' | 'recurring' | 'accounts' | 'transfers' | 'moves'> {
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const between = (a: number, b: number, step = 500) => Math.round((a + rnd() * (b - a)) / step) * step
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const pocket = () => (rnd() < 0.65 ? 'especes' : 'mobile')
  const today = todayISO()
  const txs: Transaction[] = []
  const transfers: Data['transfers'] = []
  let n = 0
  const add = (date: string, type: Transaction['type'], categoryId: string, amount: number, note: string, accountId: string) => {
    if (date <= today) txs.push({ id: uid(), type, categoryId, amount, note, date, accountId, createdAt: Date.now() - 1e6 + n++ })
  }
  const move = (date: string, toId: string, amount: number, note: string) => {
    if (date <= today) transfers.push({ id: uid(), fromId: 'banque', toId, amount, date, note, createdAt: Date.now() - 1e6 + n++ })
  }
  const months = [3, 2, 1, 0].map((back) => shiftMonth(currentMonth(), -back))
  months.forEach((m, i) => {
    const back = 3 - i
    const days = daysInMonth(m)
    const day = (d: number) => `${m}-${pad(Math.min(d, days))}`
    add(day(1), 'income', 'salaire', 350000, 'Salaire', 'banque')
    if (back % 2 === 1) add(day(14), 'income', 'freelance', between(60000, 120000, 5000), 'Mission site web', 'banque')
    add(day(2), 'expense', 'logement', 90000, 'Loyer', 'banque')
    move(day(3), 'especes', 120000, 'Retrait au guichet')
    move(day(4), 'mobile', 60000, 'Recharge')
    add(day(5), 'expense', 'factures', between(12000, 19000), 'Électricité', 'banque')
    add(day(6), 'expense', 'communication', 10000, 'Forfait internet', 'mobile')
    add(day(9), 'expense', 'etudes', between(15000, 30000, 1000), pick(['Livres', 'Formation en ligne', 'Fournitures']), 'banque')
    for (let d = 1; d <= days; d++) {
      if (rnd() < 0.62) add(day(d), 'expense', 'alimentation', between(1500, 7500), pick(['Marché', 'Déjeuner', 'Supermarché', 'Boulangerie', 'Dîner']), pocket())
      if (rnd() < 0.45) add(day(d), 'expense', 'transport', between(500, 3000), pick(['Taxi', 'Bus', 'Carburant', 'Moto-taxi']), pocket())
      if (rnd() < 0.1) add(day(d), 'expense', 'loisirs', between(3000, 12000), pick(['Cinéma', 'Sortie entre amis', 'Concert', 'Jeux']), pocket())
      if (rnd() < 0.05) add(day(d), 'expense', 'shopping', between(8000, 25000, 1000), pick(['Vêtements', 'Chaussures', 'Accessoires']), pocket())
      if (rnd() < 0.035) add(day(d), 'expense', 'sante', between(3000, 15000), pick(['Pharmacie', 'Consultation']), pocket())
    }
  })
  const budgets: Budget[] = [
    { id: uid(), categoryId: 'alimentation', limit: 90000 },
    { id: uid(), categoryId: 'transport', limit: 30000 },
    { id: uid(), categoryId: 'loisirs', limit: 25000 },
    { id: uid(), categoryId: 'shopping', limit: 30000 },
  ]
  // Objectifs alimentés par des versements réguliers depuis le compte bancaire
  const plan = [
    { name: 'Ordinateur portable', target: 450000, icon: 'laptop', color: '#4B4EE6', parts: [60000, 40000, 50000, 30000] },
    { name: 'Fonds d’urgence', target: 300000, icon: 'piggy', color: '#0E9F6E', parts: [25000, 20000, 25000, 25000] },
  ]
  const moves: Data['moves'] = []
  const goals: Goal[] = plan.map((p, gi) => {
    const id = uid()
    months.forEach((m, i) => {
      const date = `${m}-10`
      if (date <= today) moves.push({ id: uid(), goalId: id, accountId: 'banque', amount: p.parts[i], date, createdAt: Date.now() - 1e6 + n++ })
    })
    const saved = moves.reduce((s, x) => (x.goalId === id ? s + x.amount : s), 0)
    return { id, name: p.name, target: p.target, saved, icon: p.icon, color: p.color, createdAt: Date.now() - 2 + gi }
  })
  // Les exemples mensuels ci-dessus existent déjà : la récurrence reprend au mois suivant.
  const rec = (categoryId: string, type: Transaction['type'], amount: number, note: string, day: number, accountId: string): Recurring => {
    const month = currentMonth()
    const done = recurringDate(month, day) <= today
    return { id: uid(), type, amount, categoryId, note, day, accountId, startMonth: month, lastRun: done ? month : shiftMonth(month, -1) }
  }
  const recurring = [
    rec('salaire', 'income', 350000, 'Salaire', 1, 'banque'),
    rec('logement', 'expense', 90000, 'Loyer', 2, 'banque'),
    rec('communication', 'expense', 10000, 'Forfait internet', 6, 'mobile'),
  ]
  const accounts: Account[] = [
    { ...DEFAULT_ACCOUNTS[0], initial: 15000 },
    { ...DEFAULT_ACCOUNTS[1], initial: 120000 },
    { ...DEFAULT_ACCOUNTS[2], initial: 20000 },
  ]
  return { transactions: txs, budgets, goals, recurring, accounts, transfers, moves }
}
