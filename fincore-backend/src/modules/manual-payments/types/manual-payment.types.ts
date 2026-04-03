// src/modules/manual-payments/types/manual-payment.types.ts
import { ManualPaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// FIX: amount must be Decimal to match the Prisma model field type.
// Using `number` caused TS2352 unsafe cast errors in manual-payments.service.ts.
// All three call sites were doing `payment as ManualPaymentWithRelations` where
// the Prisma-returned payment.amount is a Decimal, not a number.
// Downstream consumers should call .toNumber() when they need a plain number.
export interface ManualPaymentWithRelations {
  id: string;
  subscriptionId: string;
  referenceCode: string;
  proformaS3Key: string | null;
  amount: Decimal;          // was: number — FIX applied
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
      priceMonthly: number;
      currency: string;
    };
  };
  confirmedByAdmin?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ProformaData {
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  planDisplayName: string;
  amount: number;
  currency: string;
  bankName: string;
  bankAccountTitle: string;
  bankIban: string;
  bankSwift: string;
  expiresAt: Date;
  invoiceNumber: string;
  issueDate: Date;
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
