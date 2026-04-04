// src/modules/manual-payments/types/manual-payment.types.ts
import { ManualPaymentStatus, type Prisma } from '@prisma/client';
export interface ManualPaymentWithRelations {
  id: string;
  subscriptionId: string;
  referenceCode: string;
  proformaS3Key: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: ManualPaymentStatus;
  confirmedByAdminId: string | null;
  confirmedAt: Date | null;
  rejectionNote: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subscription?: {
    id: string;
    status: string;
    plan: {
      id: string;
      name: string;
      displayName: string;
      priceMonthly: Prisma.Decimal;
      currency: string;
    };
  };
  confirmedByAdmin?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

// src/modules/manual-payments/types/manual-payment.types.ts
export interface ProformaData {
  referenceCode: string;
  invoiceNumber: string;
  issueDate: Date | string;
  customerName: string;
  customerEmail: string;
  planDisplayName?: string;
  planName?: string; // Fallback
  expiresAt: Date | string;
  bankName: string;
  bankAccountTitle: string;
  bankIban: string;
  bankSwift: string;
  amount: number;
  currency: string;
  // Optional fields
  notes?: string;
  discount?: number;
  tax?: number;
}

export interface InitiatePaymentResult {
  payment: ManualPaymentWithRelations;
  proformaPdfUrl: string;
}

export interface ConfirmPaymentResult {
  payment: ManualPaymentWithRelations;
  subscriptionActivated: boolean;
}

export interface PendingPayment {
  id: string;
  referenceCode: string;
  amount: number;
  currency: string;
  createdAt: Date;
  expiresAt: Date | null;
  customerName: string;
  customerEmail: string;
  planName: string;
}

export interface PaymentReferenceResponse {
  referenceCode: string;
  proformaPdfUrl: string;
}

/** Shape returned by getPaymentByReference (amount flattened to number for JSON/API use). */
export type ManualPaymentByReferenceResult = Omit<ManualPaymentWithRelations, 'amount'> & {
  amount: number;
};
