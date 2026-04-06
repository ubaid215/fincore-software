'use client'

import { useParams } from 'next/navigation'
import { useOrganization } from '@/modules/workspace'
import { OrgSettingsForm } from '@/modules/workspace'
import { PageHeader, Card, Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui'

export default function SettingsPage() {
  const params = useParams()
  const orgId = params.orgId as string

  // TODO: Fetch organization data from API
  const mockOrgData = {
    name: 'Acme Inc.',
    currency: 'USD',
    timezone: 'America/New_York',
    country: 'United States',
    taxNumber: '12-3456789',
    address: '123 Business St, New York, NY 10001',
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your organization settings"
      />

      <div className="mt-6">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <OrgSettingsForm orgId={orgId} initialData={mockOrgData} />
          </TabsContent>
          
          <TabsContent value="billing" className="mt-6">
            <Card className="p-6 text-center">
              <p className="text-text-tertiary">Billing settings coming soon</p>
            </Card>
          </TabsContent>
          
          <TabsContent value="integrations" className="mt-6">
            <Card className="p-6 text-center">
              <p className="text-text-tertiary">Integrations coming soon</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}