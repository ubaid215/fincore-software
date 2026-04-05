import { InviteAcceptForm } from '@/modules/auth'
import { Suspense } from 'react'

export const metadata = {
  title: 'Accept invitation',
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="text-center">Loading...</div>}>
      <InviteAcceptForm />
    </Suspense>
  )
}