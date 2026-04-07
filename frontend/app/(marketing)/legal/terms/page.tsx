export const metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using Fincore',
}

export default function TermsPage() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-8">Terms of Service</h1>
        
        <div className="prose prose-stone max-w-none">
          <p className="lead">Last updated: March 1, 2025</p>
          
          <h2>1. Agreement to Terms</h2>
          <p>By accessing or using Fincore, you agree to be bound by these Terms of Service and our Privacy Policy.</p>
          
          <h2>2. Account Responsibilities</h2>
          <p>You are responsible for maintaining the security of your account and for any activities that occur under your account. You must immediately notify us of any unauthorized use of your account.</p>
          
          <h2>3. Payment Terms</h2>
          <p>Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to change our fees upon 30 days notice.</p>
          
          <h2>4. Cancellation and Termination</h2>
          <p>You may cancel your subscription at any time from your account settings. Upon cancellation, your access will continue until the end of your current billing period.</p>
          
          <h2>5. Data Ownership</h2>
          <p>You retain all ownership rights to your data. We do not claim ownership over any of your content.</p>
          
          <h2>6. Service Level</h2>
          <p>We strive to maintain 99.9% uptime. In the event of service disruption, we will make reasonable efforts to restore service promptly.</p>
          
          <h2>7. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Fincore shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
          
          <h2>8. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at <a href="mailto:legal@fincore.app">legal@fincore.app</a>.</p>
        </div>
      </div>
    </section>
  )
}