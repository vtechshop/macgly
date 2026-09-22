import { ChevronDown } from 'lucide-react';

/**
 * Renders FAQs as always-visible HTML using native <details>/<summary>
 * so content is in the DOM for crawlers even when collapsed.
 * JSON-LD injection is the caller's responsibility.
 */
export default function FaqSection({ faqs }) {
  if (!faqs?.length) return null;
  return (
    <section className="mt-10" aria-label="Frequently Asked Questions">
      <h2 className="text-xl font-bold text-secondary-900 mb-4">Frequently Asked Questions</h2>
      <dl className="divide-y divide-secondary-200 border border-secondary-200 rounded-xl overflow-hidden">
        {faqs.map((faq, i) => (
          <details key={i} className="group bg-white">
            <summary className="flex items-center justify-between w-full px-4 py-3.5 cursor-pointer font-medium text-secondary-800 [&::-webkit-details-marker]:hidden list-none">
              {faq.q}
              <ChevronDown size={16} className="shrink-0 text-secondary-500 transition-transform duration-200 group-open:rotate-180 ml-3" />
            </summary>
            <dd className="px-4 pb-4 pt-1 text-sm text-secondary-600 bg-secondary-50 m-0">{faq.a}</dd>
          </details>
        ))}
      </dl>
    </section>
  );
}
