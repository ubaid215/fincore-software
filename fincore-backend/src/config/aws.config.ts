import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    receiptsBucket: process.env.S3_RECEIPTS_BUCKET ?? 'fincore-receipts-dev',
    documentsBucket: process.env.S3_DOCUMENTS_BUCKET ?? 'fincore-documents-dev',
  },
}));
