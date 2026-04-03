/**
 * src/modules/expenses/services/receipts.service.ts
 *
 * S3 presigned URL workflow for receipt uploads.
 *
 * Flow (client perspective):
 *   1. POST /v1/expenses/:id/receipts/initiate  →  { uploadUrl, s3Key, receiptId }
 *   2. Client PUT the file binary directly to uploadUrl (no server involved)
 *   3. POST /v1/expenses/:id/receipts/:receiptId/confirm
 *      → service verifies object exists in S3, marks receipt confirmed
 *
 * Why presigned URLs?
 *   - Files never transit the NestJS server → no memory pressure, no Multer
 *   - Upload goes client → S3 directly → much faster for mobile users
 *   - Server only stores the metadata (s3Key, size, mimeType)
 *
 * Sprint: S3 · Week 7–8
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  type HeadObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';
import type { InitiateReceiptUploadDto } from '../dto/expense.dto';
import type { PresignedUploadResult, ReceiptRecord } from '../types/expense.types';

const PRESIGNED_URL_EXPIRES_IN = 300; // 5 minutes
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: config.get<string>('aws.region', 'ap-south-1'),
      credentials: {
        accessKeyId: config.get<string>('aws.accessKeyId', 'dummy'),
        secretAccessKey: config.get<string>('aws.secretAccessKey', 'dummy'),
      },
    });

    this.bucket = config.get<string>('aws.s3.receiptsBucket', 'fincore-receipts-dev');
  }

  // ─── Initiate upload ────────────────────────────────────────────────────────

  async initiateUpload(
    expenseId: string,
    organizationId: string,
    claimantId: string,
    dto: InitiateReceiptUploadDto,
  ): Promise<PresignedUploadResult> {
    // Validate the expense belongs to this org and claimant
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });
    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }
    if (expense.claimantId !== claimantId) {
      throw new ForbiddenException('Only the expense claimant can upload receipts');
    }
    if (!['DRAFT', 'SUBMITTED'].includes(expense.status)) {
      throw new BadRequestException(
        `Receipts can only be uploaded to DRAFT or SUBMITTED expenses. ` +
          `Current status: ${expense.status}`,
      );
    }

    // Validate mime type and size (belt-and-suspenders — DTO already validates)
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException(`File type '${dto.mimeType}' is not accepted.`);
    }
    if (dto.sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB limit.');
    }

    // Build a unique, org-scoped S3 key
    const receiptId = uuidv4();
    const ext = this.mimeToExt(dto.mimeType);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const s3Key = `receipts/${organizationId}/${year}/${month}/${expenseId}/${receiptId}${ext}`;

    // Create the DB record first (status tracking)
    await this.prisma.receipt.create({
      data: {
        id: receiptId,
        expenseId,
        fileName: dto.fileName,
        s3Key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });

    // Generate presigned PUT URL
    const putCommand: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: dto.mimeType,
      ContentLength: dto.sizeBytes,
      Metadata: {
        expenseId,
        organizationId,
        receiptId,
        originalName: encodeURIComponent(dto.fileName),
      },
    };

    const uploadUrl = await getSignedUrl(this.s3, new PutObjectCommand(putCommand), {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });

    this.logger.log(
      `Presigned upload URL generated for receipt ${receiptId} on expense ${expenseId}`,
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
      receiptId,
    };
  }

  // ─── Confirm upload ─────────────────────────────────────────────────────────

  async confirmUpload(
    expenseId: string,
    organizationId: string,
    receiptId: string,
  ): Promise<ReceiptRecord> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, expenseId },
    });
    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptId} not found on expense ${expenseId}`);
    }

    // Verify the object actually exists in S3 (client did upload it)
    const headInput: HeadObjectCommandInput = { Bucket: this.bucket, Key: receipt.s3Key };
    try {
      await this.s3.send(new HeadObjectCommand(headInput));
    } catch {
      // S3 returns NoSuchKey if file wasn't uploaded
      throw new BadRequestException(
        `Receipt file was not found in S3. Upload the file to the presigned URL before confirming.`,
      );
    }

    this.logger.log(`Receipt ${receiptId} confirmed in S3 for expense ${expenseId}`);

    // Return the receipt record (it's already in the DB from initiate step)
    return receipt as unknown as ReceiptRecord;
  }

  // ─── List receipts ──────────────────────────────────────────────────────────

  async listReceipts(expenseId: string, organizationId: string): Promise<ReceiptRecord[]> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });
    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }

    const receipts = await this.prisma.receipt.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });

    return receipts as unknown as ReceiptRecord[];
  }

  // ─── Delete receipt ─────────────────────────────────────────────────────────

  async deleteReceipt(
    expenseId: string,
    organizationId: string,
    receiptId: string,
    claimantId: string,
  ): Promise<{ deleted: true }> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });
    if (!expense) throw new NotFoundException(`Expense ${expenseId} not found`);
    if (expense.claimantId !== claimantId) {
      throw new ForbiddenException('Only the claimant can delete receipts');
    }
    if (expense.status !== 'DRAFT') {
      throw new BadRequestException('Receipts can only be deleted from DRAFT expenses');
    }

    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, expenseId },
    });
    if (!receipt) throw new NotFoundException(`Receipt ${receiptId} not found`);

    // Delete from S3 (best-effort — don't block DB delete if S3 fails)
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: receipt.s3Key }));
    } catch (err: unknown) {
      this.logger.warn(`S3 delete failed for key ${receipt.s3Key}: ${(err as Error).message}`);
    }

    await this.prisma.receipt.delete({ where: { id: receiptId } });
    return { deleted: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private mimeToExt(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return map[mimeType] ?? '';
  }
}

/*
 * Sprint S3 · ReceiptsService · Week 7–8
 * Upload flow: Initiate (presigned PUT) → Client uploads → Confirm (HeadObject)
 * Bucket: aws.s3.receiptsBucket (fincore-receipts-dev in development)
 */
