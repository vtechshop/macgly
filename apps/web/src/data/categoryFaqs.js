/**
 * FAQs for category pages.
 * Keys are category slugs; values are arrays of {q, a} objects.
 * These are injected as FAQPage JSON-LD and rendered as visible HTML
 * by FaqSection so AI crawlers see them without executing JavaScript.
 */

export const CATEGORY_FAQS = {
  'engineering-workshop-kits': [
    {
      q: 'Does Macgly sell genuine power tools with warranty?',
      a: 'Yes. All power tools on Macgly are sourced from verified vendors and come with the manufacturer\'s standard warranty. Every purchase includes a GST-compliant tax invoice.',
    },
    {
      q: 'Can I buy power tools online and get fast delivery in India?',
      a: 'Yes. Macgly ships to all major cities and most pin codes across India. Estimated delivery is 3–5 business days. You can check delivery availability by entering your pin code on any product page.',
    },
  ],

  'agricultural-industry-farm-tools': [
    {
      q: 'Does Macgly deliver agricultural equipment across India?',
      a: 'Yes. Macgly delivers to all major towns and rural pin codes across India. We ship agricultural tools and farm equipment directly from verified vendors with GST invoice.',
    },
  ],

  'spare-parts': [
    {
      q: 'Does Macgly provide GST invoice for spare parts purchases?',
      a: 'Yes. All purchases on Macgly, including spare parts, come with a GST-compliant tax invoice that can be used for input tax credit (ITC) by registered businesses.',
    },
  ],

  'general-machineries': [
    {
      q: 'Does Macgly provide GST invoice for machinery purchases?',
      a: 'Yes. All machinery purchases on Macgly include a GST-compliant tax invoice, making it easy for businesses to claim input tax credit (ITC) and maintain records for accounting.',
    },
  ],

  'hotel-food-processing': [
    {
      q: 'Does Macgly provide GST invoice for commercial kitchen equipment?',
      a: 'Yes. All purchases on Macgly include a GST-compliant tax invoice for easy input tax credit (ITC) claims. This is particularly useful for restaurants, hotels, and food businesses.',
    },
  ],
};
