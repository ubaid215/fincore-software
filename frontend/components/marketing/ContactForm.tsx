'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Textarea } from '@/shared/ui'
import { toast } from '@/shared/hooks/useToast'
import { useState } from 'react'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      message: '',
    },
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to send message')

      toast({ description: 'Message sent successfully! We\'ll get back to you soon.', variant: 'success' })
      reset()
    } catch (error) {
      toast({ description: 'Failed to send message. Please try again.', variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Input
        label="Name"
        placeholder="John Doe"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="Email"
        type="email"
        placeholder="john@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Company (Optional)"
        placeholder="Acme Inc."
        error={errors.company?.message}
        {...register('company')}
      />
      <Textarea
        label="Message"
        rows={5}
        placeholder="Tell us how we can help..."
        error={errors.message?.message}
        {...register('message')}
      />
      <Button type="submit" fullWidth loading={isSubmitting}>
        Send Message
      </Button>
    </form>
  )
}