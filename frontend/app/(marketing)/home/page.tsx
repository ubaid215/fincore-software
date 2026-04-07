import { HeroSection } from '@/components/marketing/HeroSection'
import { FeatureGrid } from '@/components/marketing/FeatureGrid'
import { TestimonialStrip } from '@/components/marketing/TestimonialStrip'
import { LogoCloud } from '@/components/marketing/LogoCloud'
import { CtaStrip } from '@/components/marketing/CtaStrip'

export const metadata = {
  title: 'Home',
  description: 'Modern accounting & ERP platform for growing businesses',
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoCloud />
      <FeatureGrid />
      <TestimonialStrip />
      <CtaStrip />
    </>
  )
}