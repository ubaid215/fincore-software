const logos = [
  { name: 'Acme Corp' },
  { name: 'Beta Industries' },
  { name: 'Gamma LLC' },
  { name: 'Delta Solutions' },
  { name: 'Epsilon Tech' },
  { name: 'Zeta Global' },
]

export function LogoCloud() {
  return (
    <section className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-text-tertiary">
          Trusted by innovative businesses worldwide
        </p>
        <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center justify-center"
            >
              <div className="h-12 w-32 rounded bg-surface-2 flex items-center justify-center">
                <span className="text-text-tertiary text-sm font-medium">{logo.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}