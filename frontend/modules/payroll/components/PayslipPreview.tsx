'use client'

import { useRef } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button, Card } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import type { Payrun, PayrunEmployee } from '../types/payroll.types'

interface PayslipPreviewProps {
  payrun: Payrun
  employee: PayrunEmployee
  orgName: string
}

export function PayslipPreview({ payrun, employee, orgName }: PayslipPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML
    const printWindow = window.open('', '_blank')
    if (printWindow && printContent) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payslip - ${employee.employeeName}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; }
              .payslip { max-width: 800px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; }
              .company-name { font-size: 24px; font-weight: bold; }
              .payslip-title { font-size: 18px; margin-top: 10px; }
              .section { margin-bottom: 20px; }
              .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
              .row { display: flex; justify-content: space-between; padding: 5px 0; }
              .total-row { font-weight: bold; border-top: 1px solid #ccc; margin-top: 10px; padding-top: 10px; }
              .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleDownload = () => {
    // TODO: Implement PDF download using jsPDF
    console.log('Download PDF')
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-3">
        <Button variant="secondary" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div ref={printRef} className="rounded-lg border border-border bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">{orgName}</h1>
          <p className="mt-1 text-text-tertiary">Payslip for {formatDate(payrun.periodStart)} - {formatDate(payrun.periodEnd)}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-text-tertiary">Employee Details</h3>
            <p className="mt-2 text-text-primary">{employee.employeeName}</p>
            <p className="text-sm text-text-tertiary">Employee ID: {employee.employeeCode}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-tertiary">Payment Details</h3>
            <p className="mt-2 text-text-primary">Payment Date: {formatDate(payrun.paymentDate)}</p>
            <p className="text-sm text-text-tertiary">Payrun #{payrun.payrunNumber}</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="section-title">Earnings</h3>
          <div className="space-y-2">
            <div className="row">
              <span>Basic Salary</span>
              <span>{formatCurrency(employee.basicSalary, 'USD')}</span>
            </div>
            {employee.allowances > 0 && (
              <div className="row">
                <span>Allowances</span>
                <span>{formatCurrency(employee.allowances, 'USD')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="section-title">Deductions</h3>
          <div className="space-y-2">
            {employee.deductions > 0 && (
              <div className="row">
                <span>Other Deductions</span>
                <span>{formatCurrency(employee.deductions, 'USD')}</span>
              </div>
            )}
            {employee.tax > 0 && (
              <div className="row">
                <span>Tax</span>
                <span>{formatCurrency(employee.tax, 'USD')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="total-row row">
            <span>Net Pay</span>
            <span className="text-lg font-bold">{formatCurrency(employee.netPay, 'USD')}</span>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-text-tertiary">
          <p>This is a computer-generated document. No signature is required.</p>
        </div>
      </div>
    </div>
  )
}