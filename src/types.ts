export type TxType = 'expense' | 'income'
export type Currency = 'FCFA' | 'XOF' | 'EUR' | 'USD'

export interface Transaction {
  id: string
  type: TxType
  amount: number
  categoryId: string
  note: string
  /** Date locale au format AAAA-MM-JJ */
  date: string
  createdAt: number
  /** Renseigné quand la transaction provient d'une récurrence */
  recurringId?: string
  /** Compte débité ou crédité */
  accountId?: string
}

/** Transaction répétée chaque mois (salaire, loyer, abonnement…) */
export interface Recurring {
  id: string
  type: TxType
  amount: number
  categoryId: string
  note: string
  /** Jour du mois, de 1 à 31 ; ramené au dernier jour pour les mois plus courts */
  day: number
  /** Premier mois concerné, au format AAAA-MM */
  startMonth: string
  /** Dernier mois pour lequel la transaction a été créée */
  lastRun?: string
  accountId?: string
}

/** Endroit où se trouve l'argent : espèces, compte bancaire, mobile money… */
export interface Account {
  id: string
  name: string
  icon: string
  color: string
  /** Solde au moment de la création du compte */
  initial: number
}

/** Déplacement d'argent entre deux comptes : ni un revenu, ni une dépense */
export interface Transfer {
  id: string
  fromId: string
  toId: string
  amount: number
  date: string
  note: string
  createdAt: number
}

/** Versement (montant positif) ou retrait (négatif) sur un objectif d'épargne */
export interface SavingsMove {
  id: string
  goalId: string
  accountId: string
  amount: number
  date: string
  createdAt: number
}

export interface Category {
  id: string
  name: string
  type: TxType
  icon: string
  color: string
}

/** Limite mensuelle récurrente pour une catégorie de dépenses */
export interface Budget {
  id: string
  categoryId: string
  limit: number
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  icon: string
  color: string
  deadline?: string
  createdAt: number
}

export interface Settings {
  id: 'settings'
  currency: Currency
  /** Code d'accès : seule son empreinte salée est conservée. */
  pin?: { salt: string; hash: string }
  /** Date du dernier export de sauvegarde sur cet appareil */
  lastBackupAt?: number
  /** Le rappel de sauvegarde est masqué jusqu'à cette date */
  backupSnoozeUntil?: number
  /** Dernier compte utilisé, proposé par défaut */
  lastAccountId?: string
  /** Identifiant de la clé biométrique (Face ID, empreinte) enregistrée sur cet appareil */
  biometricId?: string
  /** Mode discret : les montants sont masqués à l'écran (consultation en public) */
  hideAmounts?: boolean
}

export interface Data {
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  recurring: Recurring[]
  accounts: Account[]
  transfers: Transfer[]
  moves: SavingsMove[]
  settings: Settings
}

export interface Backup extends Data {
  app: 'braz'
  version: 1
  exportedAt: string
}
