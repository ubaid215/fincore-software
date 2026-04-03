// src/modules/manual-payments/controllers/admin-payments.controller.ts
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ManualPaymentsService } from '../services/manual-payments.service';
import { ConfirmPaymentDto, RejectPaymentDto } from '../dto/confirm-payment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { UserRole } from '@prisma/client';
import { ConfirmPaymentResult, PendingPayment } from '../types/manual-payment.types';

@ApiTags('Admin - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly manualPaymentsService: ManualPaymentsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending payments for this organization' })
  @ApiResponse({ status: 200, description: 'List of pending payments' })
  async getPendingPayments(@OrgId() organizationId: string): Promise<PendingPayment[]> {
    return this.manualPaymentsService.getPendingPayments(organizationId);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm a manual payment and activate subscription' })
  @ApiResponse({ status: 200, description: 'Payment confirmed, subscription activated' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 409, description: 'Payment already confirmed/rejected/expired' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async confirmPayment(
    @CurrentUser() user: JwtPayload,
    @OrgId() organizationId: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<{
    success: boolean;
    paymentId: string;
    referenceCode: string;
    subscriptionActivated: boolean;
    confirmedAt: Date | null;
  }> {
    const result: ConfirmPaymentResult = await this.manualPaymentsService.confirmPayment(
      user.sub,
      organizationId,
      dto.referenceCode,
      dto.note,
    );
    return {
      success: true,
      paymentId: result.payment.id,
      referenceCode: result.payment.referenceCode,
      subscriptionActivated: result.subscriptionActivated,
      confirmedAt: result.payment.confirmedAt,
    };
  }

  @Post('reject')
  @ApiOperation({ summary: 'Reject a manual payment' })
  @ApiResponse({ status: 200, description: 'Payment rejected, email sent to customer' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 409, description: 'Payment already confirmed/rejected/expired' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async rejectPayment(
    @CurrentUser() user: JwtPayload,
    @OrgId() organizationId: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<{
    success: boolean;
    paymentId: string;
    referenceCode: string;
    rejectedAt: Date | null;
    emailSent: boolean;
  }> {
    const result = await this.manualPaymentsService.rejectPayment(
      user.sub,
      organizationId,
      dto.referenceCode,
      dto.rejectionReason,
    );
    return {
      success: true,
      paymentId: result.payment.id,
      referenceCode: result.payment.referenceCode,
      rejectedAt: result.payment.confirmedAt,
      emailSent: result.emailSent,
    };
  }
}
