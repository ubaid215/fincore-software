// /types/api.ts
// Shared types that mirror backend response shapes

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export type ContactType =
  | 'CUSTOMER' | 'VENDOR' | 'BOTH'
  | 'BANK' | 'LEAD' | 'PARTNER' | 'INTERNAL';

export interface ContactListItem {
  id:          string;
  code:        string;
  contactType: ContactType;
  displayName: string;
  companyName: string | null;
  email:       string | null;
  phone:       string | null;
  city:        string | null;
  country:     string | null;
  tags:        string[];
  isActive:    boolean;
  createdAt:   string;
}

export interface ContactNote {
  id:         string;
  contactId:  string;
  authorId:   string;
  authorName: string;
  body:       string;
  createdAt:  string;
  updatedAt:  string;
}

export interface CustomFieldDef {
  id:           string;
  fieldKey:     string;
  label:        string;
  fieldType:    'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'URL' | 'EMAIL' | 'PHONE';
  isRequired:   boolean;
  defaultValue: string | null;
  options:      string | null; // JSON string of string[]
  sortOrder:    number;
}

export interface CustomFieldValue {
  id:        string;
  fieldDefId: string;
  resourceId: string;
  value:      string | null;
  fieldDef:   CustomFieldDef;
}

export interface ContactSmartSummary {
  invoiceCount:      number;
  invoicedAmount:    string;
  saleOrderCount:    number;
  purchaseOrderCount: number;
  appointmentCount:  number;
  documentCount:     number;
}

export interface Contact {
  id:              string;
  organizationId:  string;
  contactType:     ContactType;
  code:            string;
  tags:            string[];
  displayName:     string;
  firstName:       string | null;
  lastName:        string | null;
  companyName:     string | null;
  jobTitle:        string | null;
  email:           string | null;
  email2:          string | null;
  phone:           string | null;
  phone2:          string | null;
  whatsapp:        string | null;
  website:         string | null;
  addressLine1:    string | null;
  addressLine2:    string | null;
  city:            string | null;
  state:           string | null;
  postalCode:      string | null;
  country:         string | null;
  taxId:           string | null;
  currency:        string | null;
  creditLimit:     string | null;
  paymentTerms:    number | null;
  openingBalance:  string | null;
  bankName:        string | null;
  bankIban:        string | null;
  bankAccount:     string | null;
  notes:           string | null;
  portalEnabled:   boolean;
  isActive:        boolean;
  createdAt:       string;
  updatedAt:       string;
  // Includes when fetched with relations
  notes_list?:     ContactNote[];
  customFields?:   CustomFieldValue[];
  summary?:        ContactSmartSummary;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export type EventVisibility = 'PRIVATE' | 'TEAM' | 'PUBLIC';
export type EventStatus     = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
export type AttendeeStatus  = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

export interface EventAttendee {
  id:     string;
  userId: string | null;
  email:  string | null;
  name:   string | null;
  status: AttendeeStatus;
}

export interface CalendarEvent {
  id:             string;
  organizationId: string;
  organizerId:    string;
  title:          string;
  description:    string | null;
  location:       string | null;
  startAt:        string;
  endAt:          string;
  allDay:         boolean;
  isRecurring:    boolean;
  recurrenceRule: string | null;
  color:          string | null;
  visibility:     EventVisibility;
  status:         EventStatus;
  contactId:      string | null;
  resourceType:   string | null;
  resourceId:     string | null;
  attendees:      EventAttendee[];
  createdAt:      string;
  updatedAt:      string;
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export type AppointmentStatus =
  | 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export interface Appointment {
  id:              string;
  organizationId:  string;
  ownerId:         string;
  contactId:       string | null;
  title:           string;
  notes:           string | null;
  scheduledAt:     string;
  durationMinutes: number;
  location:        string | null;
  meetingUrl:      string | null;
  status:          AppointmentStatus;
  reminderSentAt:  string | null;
  cancelledAt:     string | null;
  cancelReason:    string | null;
  createdAt:       string;
  contact?: {
    displayName: string;
    email:       string | null;
    phone:       string | null;
  } | null;
}