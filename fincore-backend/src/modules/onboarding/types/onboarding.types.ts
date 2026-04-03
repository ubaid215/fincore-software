// src/modules/onboarding/types/onboarding.types.ts

export interface OnboardingStep {
  id: string;
  name: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  required: boolean;
}

export interface OnboardingState {
  userId: string;
  organizationId: string;
  currentStep: number;
  steps: OnboardingStep[];
  completedAt: Date | null;
  wizardData: OnboardingWizardData;
}

export interface OnboardingWizardData {
  // Step 1: Organization Setup
  organizationName: string;
  organizationSlug: string;
  organizationCurrency: string;
  
  // Step 2: Account Setup
  accountingStandard: 'GAAP_USA' | 'IFRS';
  fiscalYearStart: string;
  fiscalYearEnd: string;
  
  // Step 3: Chart of Accounts
  importChartOfAccounts: boolean;
  customAccounts?: Array<{ code: string; name: string; type: string }>;
  
  // Step 4: Subscription
  selectedPlan: string;
  paymentMethod: 'manual' | 'card' | 'bank_transfer';
  
  // Step 5: Team Invites
  invites: Array<{ email: string; role: string }>;
  
  // Step 6: First Invoice
  createFirstInvoice: boolean;
  firstInvoiceData?: {
    clientName: string;
    clientEmail: string;
    amount: number;
    description: string;
  };
}

export interface OnboardingResponse {
  success: boolean;
  currentStep: number;
  nextStep?: OnboardingStep;
  wizardData?: OnboardingWizardData;
  message?: string;
}