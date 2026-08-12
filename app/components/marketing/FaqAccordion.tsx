'use client'

/* Design "Chi": acordeão de FAQ nativo (sem dependências), acessível */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="bg-sand/60 rounded-2xl border border-border/70 px-6 divide-y divide-border">
      {items.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <h3>
              <button type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left font-sans font-semibold text-ink hover:text-jade transition-colors"
              >
                {f.q}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-jade' : 'text-ink/50'}`}
                />
              </button>
            </h3>
            <div
              className="grid transition-all duration-200"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-ink/70 leading-relaxed">{f.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
