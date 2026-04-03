// src/modules/manual-payments/controllers/manual-payments.controller.ts
import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ManualPaymentsService } from '../services/manual-payments.service';
import { InitiatePaymentDto, InitiatePaymentResponseDto } from '../dto/initiate-payment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { InitiatePaymentResult } from '../types/manual-payment.types';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class ManualPaymentsController {
  constructor(private readonly manualPaymentsService: ManualPaymentsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a manual payment for a subscription' })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: InitiatePaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request (subscription already active, etc.)' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @ApiResponse({ status: 409, description: 'Pending payment already exists' })
  async initiatePayment(
    @CurrentUser() user: JwtPayload,
    @OrgId() organizationId: string,
    @Body() dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    const result: InitiatePaymentResult = await this.manualPaymentsService.initiatePayment(
      user.sub,
      organizationId,
      dto.subscriptionId,
      dto.amount,
      dto.customerName,
    );

    return {
      referenceCode: result.payment.referenceCode,
      proformaPdfUrl: result.proformaPdfUrl,
      paymentId: result.payment.id,
      expiresAt: result.payment.expiresAt!,
    };
  }

  @Get('status/:referenceCode')
  @ApiOperation({ summary: 'Get payment status by reference code' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentStatus(
    @CurrentUser() user: JwtPayload,
    @OrgId() organizationId: string,
    @Param('referenceCode') referenceCode: string,
  ): Promise<{
    id: string;
    referenceCode: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: Date;
    expiresAt: Date | null;
    confirmedAt: Date | null;
    rejectionNote: string | null;
  }> {
    const payment = await this.manualPaymentsService.getPaymentByReference(referenceCode);
    return {
      id: payment.id,
      referenceCode: payment.referenceCode,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt,
      confirmedAt: payment.confirmedAt,
      rejectionNote: payment.rejectionNote,
    };
  }
}
