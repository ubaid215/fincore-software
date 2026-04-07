import { ContactForm } from '@/components/marketing'
import { Mail, Phone, MapPin } from 'lucide-react'

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with our team',
}

export default function ContactPage() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Get in touch
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
            Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Contact Form */}
          <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-text-primary">Send us a message</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-text-primary">Contact information</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-text-primary">Email</p>
                    <a href="mailto:hello@fincore.app" className="text-text-tertiary hover:text-accent">
                      hello@fincore.app
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-text-primary">Phone</p>
                    <a href="tel:+11234567890" className="text-text-tertiary hover:text-accent">
                      +1 (234) 567-890
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-text-primary">Office</p>
                    <p className="text-text-tertiary">
                      123 Business Avenue<br />
                      New York, NY 10001<br />
                      United States
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-text-primary">Support hours</h2>
              <div className="mt-4 space-y-2 text-text-tertiary">
                <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                <p>Saturday: 10:00 AM - 2:00 PM EST</p>
                <p>Sunday: Closed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}