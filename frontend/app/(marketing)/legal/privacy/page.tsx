export const metadata = {
  title: 'Privacy Policy',
  description: 'Learn how we protect your data',
}

export default function PrivacyPage() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-8">Privacy Policy</h1>
        
        <div className="prose prose-stone max-w-none">
          <p className="lead">Last updated: March 1, 2025</p>
          
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create an account, fill out a form, or communicate with us. This may include your name, email address, phone number, and payment information.</p>
          
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to comply with legal obligations.</p>
          
          <h2>3. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
          
          <h2>4. Data Retention</h2>
          <p>We retain your personal information for as long as your account is active or as needed to provide you services, and as necessary to comply with legal obligations.</p>
          
          <h2>5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal information. You may also object to or restrict certain processing of your data.</p>
          
          <h2>6. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@fincore.app">privacy@fincore.app</a>.</p>
        </div>
      </div>
    </section>
  )
}