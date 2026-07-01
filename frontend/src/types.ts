export interface Reservation {
  id: number;
  guestName: string;
  checkinDate: string;
  checkoutDate: string;
  grossAmount: number;
  condoRegistered: boolean;
  apartmentInfoSent: boolean;
  status: 'pending' | 'complete';
  source: 'manual' | 'airbnb-ical';
  icalUid: string | null;
  createdAt: string;
}

export interface SyncResult {
  url: string;
  totalEvents: number;
  createdCount: number;
  skippedCount: number;
  created: Reservation[];
}

export interface NewReservation {
  guestName: string;
  checkinDate: string;
  checkoutDate: string;
  grossAmount: number;
}
