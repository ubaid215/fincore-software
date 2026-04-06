'use client'

import { useState } from 'react'
import { Modal, Button, Input, Textarea } from '@/shared/ui'
import { Guard } from '@/shared/ui'
import type { Invoice } from '../types/invoice.types'

interface InvoiceActionsProps {
  invoice: Invoice
  onSend?: (data: { email?: string; message?: string }) => void
  onRecordPayment?: (data: { amount: number; paymentDate: string; paymentMethod: string; reference?: string }) => void
  onVoid?: (reason?: string) => void
}

export function InvoiceActions({ invoice, onSend, onRecordPayment, onVoid }: InvoiceActionsProps) {
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [sendData, setSendData] = useState({ email: '', message: '' })
  const [paymentData, setPaymentData] = useState({
    amount: invoice.amountDue,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    reference: '',
  })
  const [voidReason, setVoidReason] = useState('')

  const handleSend = () => {
    onSend?.(sendData)
    setSendModalOpen(false)
  }

  const handleRecordPayment = () => {
    onRecordPayment?.(paymentData)
    setPaymentModalOpen(false)
  }

  const handleVoid = () => {
    onVoid?.(voidReason)
    setVoidModalOpen(false)
  }

  return (
    <>
      {/* Send Modal */}
      <Modal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        title="Send Invoice"
        description={`Send invoice ${invoice.invoiceNumber} to customer`}
      >
        <div className="space-y-4">
          <Input
            label="Customer Email"
            type="email"
            placeholder={invoice.customerEmail || 'customer@example.com'}
            value={sendData.email}
            onChange={(e) => setSendData({ ...sendData, email: e.target.value })}
          />
          <Textarea
            label="Message (optional)"
            placeholder="Add a personal message..."
            value={sendData.message}
            onChange={(e) => setSendData({ ...sendData, message: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setSendModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend}>Send Invoice</Button>
          </div>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        title="Record Payment"
        description={`Record payment for invoice ${invoice.invoiceNumber}`}
      >
        <div className="space-y-4">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={paymentData.amount}
            onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
          />
          <Input
            label="Payment Date"
            type="date"
            value={paymentData.paymentDate}
            onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
          />
          <Input
            label="Payment Method"
            placeholder="Bank Transfer, Credit Card, Cash..."
            value={paymentData.paymentMethod}
            onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
          />
          <Input
            label="Reference (optional)"
            placeholder="Transaction ID, Check #..."
            value={paymentData.reference}
            onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment}>Record Payment</Button>
          </div>
        </div>
      </Modal>

      {/* Void Modal */}
      <Guard roles={['ADMIN', 'OWNER']}>
        <Modal
          open={voidModalOpen}
          onOpenChange={setVoidModalOpen}
          title="Void Invoice"
          description={`Are you sure you want to void invoice ${invoice.invoiceNumber}? This action cannot be undone.`}
        >
          <div className="space-y-4">
            <Textarea
              label="Reason (optional)"
              placeholder="Why is this invoice being voided?"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setVoidModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleVoid}>
                Void Invoice
              </Button>
            </div>
          </div>
        </Modal>
      </Guard>
    </>
  )
}