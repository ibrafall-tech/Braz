import { useState, type FormEvent } from 'react'
import { ArrowLeft, Repeat } from 'lucide-react'
import type { Budget, Category, Goal, Recurring, TxType } from './types'
import { useStore } from './store'
import { PALETTE, UNKNOWN_CATEGORY, amountToInput, parseAmount, todayISO, uid } from './lib'
import { GOAL_ICONS, ICON_KEYS, iconFor } from './icons'
import {
  AmountInput, Button, ConfirmDelete, Field, IconChip, IconPicker, Segmented, Sheet, Swatches, cx, useClosing, useToast,
} from './ui'

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Dépense' },
  { value: 'income', label: 'Revenu' },
]

/* ---------- Choix de catégorie ---------- */

export function CategoryGrid({
  type, value, onChange, error,
}: { type: TxType; value: string; onChange: (id: string) => void; error?: string }) {
  const { categories } = useStore()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-muted">Catégorie</legend>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
        {categories.filter((c) => c.type === type).map((c) => {
          const Icon = iconFor(c.icon)
          const on = c.id === value
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(c.id)}
              className={cx(
                'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-1 py-2.5 transition active:scale-95',
                on ? 'bg-surface' : 'border-transparent bg-surface-2',
              )}
              style={on ? { borderColor: c.color } : undefined}
            >
              <Icon size={20} style={{ color: c.color }} />
              <span className={cx('w-full truncate text-center text-xs font-medium', !on && 'text-muted')}>{c.name}</span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm text-neg">{error}</p>}
    </fieldset>
  )
}

/* ---------- Récurrences ---------- */

/** Liste des transactions récurrentes, avec modification et arrêt. */
export function RecurringSheet({ onClose: done }: { onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { recurring, categories, settings, save, remove, money } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Recurring | null>(null)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; day?: string }>({})

  function edit(r: Recurring) {
    setEditing(r)
    setAmount(amountToInput(r.amount, settings.currency))
    setCategoryId(r.categoryId)
    setDay(String(r.day))
    setNote(r.note)
    setErrors({})
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const value = parseAmount(amount)
    const d = Number(day)
    const next = {
      amount: value ? undefined : 'Saisissez un montant.',
      day: Number.isInteger(d) && d >= 1 && d <= 31 ? undefined : 'Entre 1 et 31.',
    }
    setErrors(next)
    if (next.amount || next.day) return
    save('recurring', { ...editing, amount: value, categoryId, day: d, note: note.trim() })
    toast('Récurrence modifiée')
    setEditing(null)
  }

  const sorted = [...recurring].sort((a, b) => a.day - b.day)

  return (
    <Sheet
      closing={closing}
      title={editing ? 'Modifier la récurrence' : 'Récurrences'}
      onClose={onClose}
      footer={
        editing ? (
          <>
            <ConfirmDelete
              label="Arrêter"
              onConfirm={() => {
                remove('recurring', editing.id)
                toast('Récurrence arrêtée')
                setEditing(null)
              }}
            />
            <Button type="submit" form="rec-form" className="flex-1">Enregistrer</Button>
          </>
        ) : undefined
      }
    >
      {editing ? (
        <form id="rec-form" onSubmit={submit} className="space-y-5" noValidate>
          <button type="button" onClick={() => setEditing(null)} className="-ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-primary">
            <ArrowLeft size={16} /> Toutes les récurrences
          </button>
          <AmountInput
            value={amount}
            error={errors.amount}
            onChange={(v) => {
              setAmount(v)
              setErrors((x) => ({ ...x, amount: undefined }))
            }}
          />
          <CategoryGrid type={editing.type} value={categoryId} onChange={setCategoryId} />
          <Field label="Jour du mois" error={errors.day}>
            <input
              className="field"
              inputMode="numeric"
              enterKeyHint="done"
              maxLength={2}
              value={day}
              onChange={(e) => {
                setDay(e.target.value.replace(/\D/g, ''))
                setErrors((x) => ({ ...x, day: undefined }))
              }}
            />
          </Field>
          <Field label="Note (facultatif)">
            <input className="field" value={note} maxLength={80} enterKeyHint="done" onChange={(e) => setNote(e.target.value)} />
          </Field>
          <p className="text-sm text-muted">Les changements s’appliquent aux prochains mois.</p>
        </form>
      ) : sorted.length ? (
        <div className="-mx-2 pb-2">
          {sorted.map((r) => {
            const cat = categories.find((c) => c.id === r.categoryId) ?? UNKNOWN_CATEGORY
            const income = r.type === 'income'
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => edit(r)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-surface-2/60 active:bg-surface-2"
              >
                <IconChip icon={cat.icon} color={cat.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.note || cat.name}</span>
                  <span className="block truncate text-sm text-muted">Le {r.day} de chaque mois</span>
                </span>
                <span className={cx('num shrink-0 font-semibold', income && 'text-pos')}>{money(income ? r.amount : -r.amount, true)}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center px-4 pb-8 pt-4 text-center">
          <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary">
            <Repeat size={26} />
          </span>
          <p className="display text-lg font-semibold">Aucune récurrence</p>
          <p className="mt-1 max-w-xs text-[15px] text-muted">
            Activez « Répéter chaque mois » en ajoutant une transaction.
          </p>
        </div>
      )}
    </Sheet>
  )
}

/* ---------- Budget ---------- */

export function BudgetSheet({ budget, onClose: done }: { budget: Budget | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { categories, budgets, settings, save, remove } = useStore()
  const toast = useToast()
  const taken = new Set(budgets.filter((b) => b.id !== budget?.id).map((b) => b.categoryId))
  const available = categories.filter((c) => c.type === 'expense' && !taken.has(c.id))
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? available[0]?.id ?? '')
  const [limit, setLimit] = useState(budget ? amountToInput(budget.limit, settings.currency) : '')
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(limit)
    if (!value) return setError('Saisissez une limite.')
    save('budgets', { id: budget?.id ?? uid(), categoryId, limit: value })
    toast(budget ? 'Budget modifié' : 'Budget créé')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={budget ? 'Modifier le budget' : 'Nouveau budget'}
      onClose={onClose}
      footer={
        <>
          {budget && (
            <ConfirmDelete
              onConfirm={() => {
                remove('budgets', budget.id)
                toast('Budget supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="budget-form" className="flex-1" disabled={!categoryId}>
            {budget ? 'Enregistrer' : 'Créer le budget'}
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          label="Limite par mois"
          value={limit}
          autoFocus={!budget}
          error={error}
          onChange={(v) => {
            setLimit(v)
            setError(undefined)
          }}
        />
        <Field label="Catégorie">
          {available.length ? (
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-[15px] text-muted">
              Toutes les catégories ont déjà un budget.
            </p>
          )}
        </Field>
      </form>
    </Sheet>
  )
}

/* ---------- Objectif d'épargne ---------- */

export function GoalSheet({ goal, onClose: done }: { goal: Goal | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { settings, moves, save, remove } = useStore()
  const toast = useToast()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? amountToInput(goal.target, settings.currency) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [color, setColor] = useState(goal?.color ?? PALETTE[0])
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(target)
    const next = {
      name: name.trim() ? undefined : 'Donnez un nom.',
      target: value ? undefined : 'Saisissez un montant.',
    }
    setErrors(next)
    if (next.name || next.target) return
    save('goals', {
      id: goal?.id ?? uid(),
      name: name.trim(),
      target: value,
      saved: goal?.saved ?? 0,
      icon,
      color,
      deadline: deadline || undefined,
      createdAt: goal?.createdAt ?? Date.now(),
    })
    toast(goal ? 'Objectif modifié' : 'Objectif créé')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'}
      onClose={onClose}
      footer={
        <>
          {goal && (
            <ConfirmDelete
              onConfirm={() => {
                // L'argent de l'objectif revient sur les comptes d'où il venait.
                moves.filter((m) => m.goalId === goal.id).forEach((m) => remove('moves', m.id))
                remove('goals', goal.id)
                toast('Objectif supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="goal-form" className="flex-1">
            {goal ? 'Enregistrer' : 'Créer l’objectif'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          label="Montant à atteindre"
          value={target}
          error={errors.target}
          onChange={(v) => {
            setTarget(v)
            setErrors((e) => ({ ...e, target: undefined }))
          }}
        />
        <Field label="Nom" error={errors.name}>
          <input
            className="field"
            value={name}
            maxLength={40}
            data-autofocus={goal ? undefined : true}
            placeholder="Ex. Ordinateur, voyage…"
            onChange={(e) => {
              setName(e.target.value)
              setErrors((x) => ({ ...x, name: undefined }))
            }}
          />
        </Field>
        <Field label="Échéance (facultatif)">
          <input type="date" className="field" value={deadline} min={todayISO()} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icône</p>
          <IconPicker icons={GOAL_ICONS} value={icon} color={color} onChange={setIcon} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Couleur</p>
          <Swatches colors={PALETTE} value={color} onChange={setColor} />
        </div>
      </form>
    </Sheet>
  )
}

/* ---------- Catégorie ---------- */

export function CategorySheet({ category, onClose: done }: { category: Category | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { transactions, budgets, recurring, save, remove } = useStore()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState<TxType>(category?.type ?? 'expense')
  const [icon, setIcon] = useState(category?.icon ?? 'wallet')
  const [color, setColor] = useState(category?.color ?? PALETTE[0])
  const [error, setError] = useState<string>()
  const used = category ? transactions.filter((t) => t.categoryId === category.id).length : 0
  // Une récurrence active continuerait de créer des transactions dans une catégorie disparue.
  const usedByRecurring = !!category && recurring.some((r) => r.categoryId === category.id)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Donnez un nom.')
    save('categories', { id: category?.id ?? uid(), name: name.trim(), type, icon, color })
    toast(category ? 'Catégorie modifiée' : 'Catégorie créée')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      onClose={onClose}
      footer={
        <>
          {category && used === 0 && !usedByRecurring && (
            <ConfirmDelete
              onConfirm={() => {
                budgets.filter((b) => b.categoryId === category.id).forEach((b) => remove('budgets', b.id))
                remove('categories', category.id)
                toast('Catégorie supprimée')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="cat-form" className="flex-1">
            {category ? 'Enregistrer' : 'Créer la catégorie'}
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="space-y-5" noValidate>
        {!category && <Segmented label="Type de catégorie" options={TYPE_OPTIONS} value={type} onChange={setType} />}
        <Field label="Nom" error={error}>
          <input
            className="field"
            value={name}
            maxLength={24}
            data-autofocus={category ? undefined : true}
            placeholder="Ex. Abonnements"
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icône</p>
          <IconPicker icons={ICON_KEYS} value={icon} color={color} onChange={setIcon} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Couleur</p>
          <Swatches colors={PALETTE} value={color} onChange={setColor} />
        </div>
        {used > 0 ? (
          <p className="text-sm text-muted">
            Utilisée par {used} transaction{used > 1 ? 's' : ''} : suppression impossible.
          </p>
        ) : usedByRecurring && (
          <p className="text-sm text-muted">Utilisée par une transaction récurrente : arrêtez-la d’abord pour supprimer la catégorie.</p>
        )}
      </form>
    </Sheet>
  )
}
