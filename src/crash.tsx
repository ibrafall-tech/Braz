import { Component, type ReactNode } from 'react'
import { loadAll } from './db'
import { download, toBackup, todayISO } from './lib'
import type { Data } from './types'

/**
 * Filet de sécurité : si un écran plante, on n'affiche pas une page blanche.
 * L'utilisateur peut recharger, et surtout récupérer ses données brutes avant toute autre manipulation.
 */
export class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  private async rescue() {
    try {
      const d = await loadAll()
      // Le code d'accès protège aussi cette sortie de secours.
      if (d.settings?.pin) {
        alert('Un code d’accès protège ces données : rechargez l’application, déverrouillez-la, puis exportez depuis Paramètres.')
        return
      }
      const data: Data = {
        transactions: d.transactions ?? [], categories: d.categories ?? [], budgets: d.budgets ?? [], goals: d.goals ?? [],
        recurring: d.recurring ?? [], accounts: d.accounts ?? [], transfers: d.transfers ?? [], moves: d.moves ?? [],
        settings: { id: 'settings', currency: d.settings?.currency ?? 'FCFA' },
      }
      await download(`braz-secours-${todayISO()}.json`, JSON.stringify(toBackup(data), null, 2), 'application/json')
    } catch {
      alert('Impossible de lire les données de cet appareil.')
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const btn = 'inline-flex h-12 items-center justify-center rounded-2xl px-5 font-semibold'
    return (
      <div role="alert" className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="max-w-sm">
          <p className="display text-2xl font-semibold">Un problème est survenu</p>
          <p className="mt-2 text-[15px] text-muted">
            Vos données sont toujours sur cet appareil. Rechargez l’application ; si le problème persiste, exportez d’abord une copie de secours.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" className={`${btn} bg-primary text-white`} onClick={() => location.reload()}>
              Recharger
            </button>
            <button type="button" className={`${btn} bg-surface-2 text-ink`} onClick={() => void this.rescue()}>
              Exporter une copie de secours
            </button>
          </div>
        </div>
      </div>
    )
  }
}
