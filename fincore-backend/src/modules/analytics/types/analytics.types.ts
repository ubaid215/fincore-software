// src/modules/analytics/types/analytics.types.ts

export interface DashboardMetrics {
  // Financial Health
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  workingCapital: number;

  // Profitability
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  returnOnEquity: number;

  // Efficiency
  inventoryTurnover: number;
  receivablesTurnover: number;
  payablesTurnover: number;

  // Growth
  revenueGrowth: number;
  profitGrowth: number;

  // Cash Flow
  operatingCashFlow: number;
  freeCashFlow: number;
  cashConversionCycle: number;

  // FIX: These were missing — analytics.service.ts uses both
  revenue: number;
  netProfit: number;
}

export interface TrendAnalysis {
  metric: string;
  currentPeriod: number;
  previousPeriod: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  forecast: number;
}

export interface CustomerInsights {
  topCustomers: TopCustomer[];
  atRiskCustomers: AtRiskCustomer[];
  newCustomers: number;
  customerRetentionRate: number;
  customerChurnRate: number;
}

export interface TopCustomer {
  name: string;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: Date;
  lifetimeValue: number;
}

export interface AtRiskCustomer {
  name: string;
  daysSinceLastOrder: number;
  previousAverageOrder: number;
}

export interface ProductInsights {
  bestSellers: BestSeller[];
  worstSellers: WorstSeller[];
  seasonalityPatterns: SeasonalityPattern[];
}

export interface BestSeller {
  productName: string;
  unitsSold: number;
  revenue: number;
  profitMargin: number;
}

export interface WorstSeller {
  productName: string;
  unitsSold: number;
  stockHolding: number;
  daysInInventory: number;
}

export interface SeasonalityPattern {
  productName: string;
  peakMonths: number[];
  averageMonthlySales: number;
}

export interface KpiDashboard {
  metrics: DashboardMetrics;
  trends: TrendAnalysis[];
  alerts: KpiAlert[];
  timestamp: Date;
}

export interface KpiAlert {
  metric: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  currentValue: number;
  threshold: number;
}
