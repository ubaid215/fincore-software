// src/modules/financial-reports/controllers/reports.controller.ts
import { Controller, Get, Query, UseGuards, Res, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { UserRole } from '@prisma/client';
import { BalanceSheetService } from '../services/balance-sheet.service';
import { ProfitLossService } from '../services/profit-loss.service';
import { TrialBalanceService } from '../services/trial-balance.service';
import { CashFlowService } from '../services/cash-flow.service';
import { ReportExportService } from '../services/report-export.service';
import {
  BalanceSheetQueryDto,
  ProfitLossQueryDto,
  TrialBalanceQueryDto,
  CashFlowQueryDto,
  ReportExportQueryDto,
} from '../dto/report-params.dto';

@ApiTags('Financial Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
@Controller('reports')
export class ReportsController {
  constructor(
    private balanceSheetService: BalanceSheetService,
    private profitLossService: ProfitLossService,
    private trialBalanceService: TrialBalanceService,
    private cashFlowService: CashFlowService,
    private reportExportService: ReportExportService,
  ) {}

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Get Balance Sheet report' })
  @ApiResponse({ status: 200, description: 'Balance sheet generated successfully' })
  async getBalanceSheet(@OrgId() organizationId: string, @Query() query: BalanceSheetQueryDto) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    return this.balanceSheetService.generate(organizationId, asOfDate);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get Profit & Loss statement' })
  @ApiResponse({ status: 200, description: 'P&L generated successfully' })
  async getProfitLoss(@OrgId() organizationId: string, @Query() query: ProfitLossQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    return this.profitLossService.generate(organizationId, startDate, endDate);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get Trial Balance report' })
  @ApiResponse({ status: 200, description: 'Trial balance generated successfully' })
  async getTrialBalance(@OrgId() organizationId: string, @Query() query: TrialBalanceQueryDto) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    return this.trialBalanceService.generate(organizationId, asOfDate);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Get Cash Flow Statement (IAS 7 Indirect Method)' })
  @ApiResponse({ status: 200, description: 'Cash flow statement generated successfully' })
  async getCashFlow(@OrgId() organizationId: string, @Query() query: CashFlowQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    return this.cashFlowService.generate(organizationId, startDate, endDate);
  }

  @Get('balance-sheet/export')
  @ApiOperation({ summary: 'Export Balance Sheet to PDF or CSV' })
  async exportBalanceSheet(
    @OrgId() organizationId: string,
    @Query() query: BalanceSheetQueryDto & ReportExportQueryDto,
  ) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    const report = await this.balanceSheetService.generate(organizationId, asOfDate);

    if (query.format === 'csv') {
      const data = [
        ...report.assets.accounts,
        ...report.liabilities.accounts,
        ...report.equity.accounts,
      ];
      return this.reportExportService.exportToCsv(data, 'balance-sheet');
    }

    // PDF export
    const html = this.generateBalanceSheetHtml(report);
    return this.reportExportService.exportToPdf(html, 'balance-sheet');
  }

  private generateBalanceSheetHtml(report: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Balance Sheet</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #0d9488; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 30px; }
          .section h2 { background: #f3f4f6; padding: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .total { font-weight: bold; background: #f9fafb; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FinCore</h1>
          <h2>Balance Sheet</h2>
          <p>As of ${report.asOfDate}</p>
        </div>
        <div class="section">
          <h2>Assets</h2>
          <table>
            <tr><th>Account</th><th class="text-right">Balance</th></tr>
            ${report.assets.accounts
              .map(
                (a: any) => `
              <tr><td>${a.accountCode} - ${a.name}</td><td class="text-right">${a.balance.toFixed(2)}</td></tr>
            `,
              )
              .join('')}
            <tr class="total"><td>Total Assets</td><td class="text-right">${report.totalAssets.toFixed(2)}</td></tr>
          </table>
        </div>
        <div class="section">
          <h2>Liabilities & Equity</h2>
          <table>
            <tr><th>Account</th><th class="text-right">Balance</th></tr>
            ${report.liabilities.accounts
              .map(
                (a: any) => `
              <tr><td>${a.accountCode} - ${a.name}</td><td class="text-right">${a.balance.toFixed(2)}</td></tr>
            `,
              )
              .join('')}
            ${report.equity.accounts
              .map(
                (a: any) => `
              <tr><td>${a.accountCode} - ${a.name}</td><td class="text-right">${a.balance.toFixed(2)}</td></tr>
            `,
              )
              .join('')}
            <tr class="total"><td>Total Liabilities & Equity</td><td class="text-right">${report.totalLiabilitiesAndEquity.toFixed(2)}</td></tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }
}
