// src/modules/financial-reports/services/report-export.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);
  private s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('s3.documentsBucket', 'fincore-documents-dev')!;
    this.s3Client = new S3Client({
      region: this.configService.get<string>('aws.region', 'ap-south-1')!,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId', 'dummy')!,
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey', 'dummy')!,
      },
    });
  }

  async exportToCsv(data: any[], reportName: string): Promise<{ url: string; key: string }> {
    if (!data.length) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/,/g, ';');
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const key = `reports/${reportName}/${Date.now()}.csv`;
    const buffer = Buffer.from(csvContent, 'utf-8');

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'text/csv',
      }),
    );

    return { url: `https://${this.bucket}.s3.amazonaws.com/${key}`, key };
  }

  async exportToPdf(html: string, reportName: string): Promise<{ url: string; key: string }> {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      pdfBuffer = Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }

    const key = `reports/${reportName}/${Date.now()}.pdf`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    return { url: `https://${this.bucket}.s3.amazonaws.com/${key}`, key };
  }
}