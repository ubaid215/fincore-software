// app/page.tsx (NO redirects - let proxy handle it)
import { HeroSection } from '@/components/marketing/HeroSection';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { TestimonialStrip } from '@/components/marketing/TestimonialStrip';
import { LogoCloud } from '@/components/marketing/LogoCloud';
import { CtaStrip } from '@/components/marketing/CtaStrip';

export default function RootPage() {
  // This page should ALWAYS render the marketing homepage
  // The proxy will handle redirecting authenticated users
  return (
    <>
      <HeroSection />
      <LogoCloud />
      <FeatureGrid />
      <TestimonialStrip />
      <CtaStrip />
    </>
  );
}