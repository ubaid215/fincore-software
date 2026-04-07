'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

const faqs = [
  {
    question: 'What is Fincore?',
    answer: 'Fincore is a modern accounting and ERP platform designed for growing businesses. It includes invoicing, expense tracking, payroll, inventory management, and financial reporting.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. You can cancel your subscription at any time from your account settings.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. We use enterprise-grade encryption, regular backups, and comply with industry security standards.',
  },
  {
    question: 'Do you offer support?',
    answer: 'Yes, we offer email support for all plans and priority support for annual subscribers.',
  },
  {
    question: 'Can I import my existing data?',
    answer: 'Yes, we support CSV imports for customers, products, and historical transactions.',
  },
]

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div key={index} className="rounded-lg border border-border bg-white">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="font-medium text-text-primary">{faq.question}</span>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-text-tertiary transition-transform',
                openIndex === index && 'rotate-180'
              )}
            />
          </button>
          {openIndex === index && (
            <div className="border-t border-border px-4 pb-4">
              <p className="text-text-tertiary">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}