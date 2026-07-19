export interface Reservation {
  id: number;
  guestName: string;
  guestDocument: string; // RG do hóspede ('' = não informado)
  checkinDate: string;
  checkoutDate: string;
  checkinTime: string; // 'HH:MM'
  checkoutTime: string; // 'HH:MM'
  grossAmount: number;
  condoRegistered: boolean;
  apartmentInfoSent: boolean;
  status: 'pending' | 'complete';
  source: 'manual' | 'airbnb-ical' | 'airbnb-csv';
  icalUid: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface SyncResult {
  url: string;
  totalEvents: number;
  createdCount: number;
  skippedCount: number;
  blockedCount: number;
  cancelledCount: number;
  created: Reservation[];
  cancelled: Reservation[];
}

// Resposta de POST /api/reservations/import-csv
export interface ImportCsvResult {
  staysFound: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  ignoredRows: number;
  created: Reservation[];
  updated: Reservation[];
}

export interface NewReservation {
  guestName: string;
  guestDocument?: string;
  checkinDate: string;
  checkoutDate: string;
  checkinTime?: string;
  checkoutTime?: string;
  grossAmount: number;
}

export interface Settings {
  hostSplitPercent: number;
  ownerName: string;
  icalUrl: string | null;
}

export type ExpenseCategory = 'luz' | 'condominio' | 'internet' | 'funcionaria' | 'outro';

export interface Expense {
  id: number;
  month: string; // 'YYYY-MM'
  category: ExpenseCategory;
  amount: number;
  description: string;
  createdAt: string;
}

export interface NewExpense {
  month: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
}

// Resposta de GET /api/finance/closing
export interface Closing {
  month: string;
  hostSplitPercent: number;
  ownerSplitPercent: number;
  ownerName: string;
  reservationsCount: number;
  pendingCount: number;
  grossRevenue: number;
  totalExpenses: number;
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
  balance: number;
  hostAmount: number;
  ownerAmount: number;
}
