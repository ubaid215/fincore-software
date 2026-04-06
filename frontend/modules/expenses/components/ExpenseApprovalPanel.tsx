'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Send } from 'lucide-react'
import { Button, Modal, Textarea, Card, Guard } from '@/shared/ui'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import type { Expense } from '../types/expense.types'

interface ExpenseApprovalPanelProps {
  expense: Expense
  onApprove?: (comment?: string) => void
  onReject?: (comment: string) => void
  onSubmit?: () => void
  onPost?: () => void
}

export function ExpenseApprovalPanel({
  expense,
  onApprove,
  onReject,
  onSubmit,
  onPost,
}: ExpenseApprovalPanelProps) {
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveComment, setApproveComment] = useState('')

  const status = expense.status

  const handleApprove = () => {
    onApprove?.(approveComment)
    setApproveModalOpen(false)
    setApproveComment('')
  }

  const handleReject = () => {
    onReject?.(rejectComment)
    setRejectModalOpen(false)
    setRejectComment('')
  }

  // Different actions based on status
  if (status === 'DRAFT') {
    return (
      <Card className="bg-accent-subtle border-accent/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Ready to Submit</p>
            <p className="text-xs text-accent/80 mt-0.5">Submit this expense for manager approval</p>
          </div>
          <Button onClick={onSubmit}>
            <Send className="mr-2 h-4 w-4" />
            Submit for Approval
          </Button>
        </div>
      </Card>
    )
  }

  if (status === 'SUBMITTED') {
    return (
      <Guard roles={['MANAGER', 'ADMIN', 'OWNER']}>
        <Card className="bg-warning-subtle border-warning/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warning-text">Pending Manager Approval</p>
              <p className="text-xs text-warning-text/80 mt-0.5">
                Submitted by {expense.userName} on {new Date(expense.expenseDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={() => setRejectModalOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setApproveModalOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        </Card>
      </Guard>
    )
  }

  if (status === 'MANAGER_APPROVED') {
    return (
      <Guard roles={['ACCOUNTANT', 'ADMIN', 'OWNER']}>
        <Card className="bg-info-subtle border-info/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-info-text">Pending Finance Approval</p>
              <p className="text-xs text-info-text/80 mt-0.5">
                Approved by manager, waiting for finance review
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={() => setRejectModalOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setApproveModalOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        </Card>
      </Guard>
    )
  }

  if (status === 'FINANCE_APPROVED') {
    return (
      <Guard roles={['ACCOUNTANT', 'ADMIN', 'OWNER']}>
        <Card className="bg-success-subtle border-success/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-success-text">Ready to Post</p>
              <p className="text-xs text-success-text/80 mt-0.5">
                Approved by finance, ready to post to ledger
              </p>
            </div>
            <Button onClick={onPost}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Post to Ledger
            </Button>
          </div>
        </Card>
      </Guard>
    )
  }

  if (status === 'REJECTED') {
    return (
      <Card className="bg-danger-subtle border-danger/20">
        <div>
          <p className="text-sm font-medium text-danger-text">Expense Rejected</p>
          {expense.rejectionReason && (
            <p className="text-xs text-danger-text/80 mt-1">
              Reason: {expense.rejectionReason}
            </p>
          )}
        </div>
      </Card>
    )
  }

  if (status === 'POSTED') {
    return (
      <Card className="bg-success-subtle border-success/20">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-sm font-medium text-success-text">
            Posted to ledger on {expense.postedAt ? new Date(expense.postedAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </Card>
    )
  }

  return null
}