'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

const testimonials = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'CEO, Acme Corp',
    content: 'Fincore has transformed how we manage our finances. The invoicing and expense tracking alone saved us 10+ hours a week.',
    rating: 5,
  },
  {
    id: 2,
    name: 'Michael Chen',
    role: 'CFO, Beta Industries',
    content: 'The reporting features are outstanding. Being able to see real-time P&L and cash flow has been a game-changer for our board meetings.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    role: 'Finance Manager, Gamma LLC',
    content: 'Finally, an accounting platform that doesn\'t feel like it was built in the 90s. Modern, fast, and intuitive.',
    rating: 5,
  },
]

export function TestimonialStrip() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const testimonial = testimonials[currentIndex]

  return (
    <section className="bg-accent-subtle py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Trusted by businesses worldwide
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
            See what our customers are saying about Fincore
          </p>
        </div>

        <div className="relative mt-12">
          {/* Stars */}
          <div className="mb-6 flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-warning text-warning" />
            ))}
          </div>

          {/* Testimonial Content */}
          <div className="text-center px-8">
            <p className="text-xl text-text-primary md:text-2xl leading-relaxed">
              &quot;{testimonial.content}&quot;
            </p>
            <div className="mt-6">
              <p className="font-semibold text-text-primary">{testimonial.name}</p>
              <p className="text-sm text-text-tertiary">{testimonial.role}</p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md hover:bg-surface transition-all"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md hover:bg-surface transition-all"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {/* Dots */}
        <div className="mt-8 flex justify-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                index === currentIndex 
                  ? 'w-6 bg-accent' 
                  : 'w-2 bg-border-2'
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}