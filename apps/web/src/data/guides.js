/**
 * Static buying-guide content.
 *
 * Each guide object drives both the GuidePage component and the SSR
 * prerender.  Add a guide here, add its slug to the sitemap, and the
 * route /guides/:slug is live automatically.
 *
 * Replace every [PLACEHOLDER …] with real copy before launch.
 */

export const GUIDES = [
  {
    slug: 'how-to-choose-a-drilling-machine',
    title: 'How to Choose a Drilling Machine: Complete Buying Guide India 2024',
    headline: 'How to Choose a Drilling Machine',
    description:
      'A complete buying guide to drilling machines in India — types, power ratings, use cases, and what to look for before you buy.',
    datePublished: '2024-09-01',
    dateModified: '2024-09-22',
    author: 'Macgly Editorial Team',
    readTime: '8 min read',
    heroImage: null, // replace with an absolute URL once you have one
    relatedCategories: [
      { name: 'Engineering & Workshop Kits', slug: 'engineering-workshop-kits' },
      { name: 'Spare Parts', slug: 'spare-parts' },
    ],
    sections: [
      {
        id: 'types',
        heading: 'Types of Drilling Machines Available in India',
        paragraphs: [
          '[PLACEHOLDER: Introduce the main categories — corded drill, cordless drill, hammer drill, rotary hammer / SDS drill, and bench drill press. One short paragraph per type covering what it is, who it is for, and a typical power range in watts.]',
        ],
        table: null,
      },
      {
        id: 'power-ratings',
        heading: 'Understanding Power Ratings (300 W – 1 500 W)',
        paragraphs: [
          '[PLACEHOLDER: Explain wattage tiers. E.g. 300–500 W for light home use (wood, plastic, thin metal), 500–800 W for general DIY and masonry, 800–1 200 W for heavy-duty work, 1 200 W+ for industrial/continuous use. Mention RPM range alongside wattage.]',
        ],
        table: {
          headers: ['Power Range', 'Best For', 'Typical User'],
          rows: [
            ['300 – 500 W', 'Wood, plastic, thin sheet metal', 'Home / DIY users'],
            ['500 – 800 W', 'Masonry, general drilling', 'Small contractors, workshops'],
            ['800 – 1 200 W', 'Concrete, heavy masonry', 'Contractors, site workers'],
            ['1 200 W+', 'Industrial / continuous use', 'Factories, heavy industry'],
          ],
        },
      },
      {
        id: 'use-cases',
        heading: 'Which Drill for Which Job?',
        paragraphs: [
          '[PLACEHOLDER: Match drill types to common Indian use-cases: home renovation (corded or cordless 500–700 W), agricultural shed construction (corded 800 W hammer drill), workshop metal fabrication (bench drill press), plumbing/electrical work (cordless 18 V for mobility). Include 2–3 sentences per use-case.]',
        ],
        table: null,
      },
      {
        id: 'key-features',
        heading: 'Key Features to Check Before Buying',
        paragraphs: [
          '[PLACEHOLDER: Cover: chuck size (10 mm vs 13 mm), keyless vs keyed chuck, variable-speed trigger, reverse function, torque settings, handle ergonomics, cord length vs battery capacity, dust protection rating (IP rating) for outdoor/site use.]',
        ],
        table: null,
      },
      {
        id: 'brands',
        heading: 'Top Drilling Machine Brands in India',
        paragraphs: [
          '[PLACEHOLDER: Brief overview of major brands available on Macgly — Bosch, Makita, Dewalt, Black & Decker, Stanley, Vega, Cheston — with 1–2 sentences on each brand\'s positioning (premium, mid-range, budget, industrial). End with a note that all products on Macgly come with GST invoice and pan-India delivery.]',
        ],
        table: null,
      },
      {
        id: 'buying-checklist',
        heading: 'Quick Buying Checklist',
        paragraphs: [
          '[PLACEHOLDER: Short bullet-point list — 6–8 items — summarising the decision process: identify material (wood/concrete/metal), decide power requirement, choose corded vs cordless, check chuck size, verify brand warranty, compare price vs feature set, confirm GST invoice available.]',
        ],
        table: null,
      },
    ],
    faqs: [
      {
        q: 'Which drill machine is best for home use in India?',
        a: '[PLACEHOLDER: Recommend a 500–700 W variable-speed corded drill or an 18 V cordless model. Mention 2–3 specific models available on Macgly and their price range.]',
      },
      {
        q: 'What is the price of a good drilling machine in India?',
        a: '[PLACEHOLDER: Give price tiers — ₹800–₹2 000 for basic home use, ₹2 000–₹6 000 for mid-range, ₹6 000–₹15 000 for professional grade. Link to the Engineering category on Macgly.]',
      },
      {
        q: 'What is the difference between a drill and a hammer drill?',
        a: '[PLACEHOLDER: A regular drill rotates the bit. A hammer drill also delivers rapid axial blows, making it much more effective for masonry and concrete. Recommend hammer drills for any work on RCC walls.]',
      },
      {
        q: 'Is a cordless drill good enough for concrete walls?',
        a: '[PLACEHOLDER: A brushless 18–20 V cordless hammer drill with at least 2.0 Ah battery can handle light masonry. For heavy RCC or stone, a corded hammer drill or rotary hammer is recommended.]',
      },
      {
        q: 'Does Macgly deliver drilling machines across India?',
        a: 'Yes. Macgly delivers to all major cities and most pin codes across India. All orders include a GST tax invoice. Check delivery availability for your pin code on any product page.',
      },
    ],
  },

  {
    slug: 'drill-machine-price-guide-india',
    title: 'Drill Machine Price Guide India 2024: Ranges, Categories & Value Picks',
    headline: 'Drill Machine Price Guide India 2024',
    description:
      'A detailed price guide to drill machines in India — from ₹800 budget drills to ₹30 000 industrial rotary hammers — with category breakdowns and value recommendations.',
    datePublished: '2024-09-05',
    dateModified: '2024-09-22',
    author: 'Macgly Editorial Team',
    readTime: '6 min read',
    heroImage: null,
    relatedCategories: [
      { name: 'Engineering & Workshop Kits', slug: 'engineering-workshop-kits' },
      { name: 'Hardware & Tools', slug: 'hardware-tools' },
    ],
    sections: [
      {
        id: 'overview',
        heading: 'Drill Machine Price Ranges in India (2024)',
        paragraphs: [
          '[PLACEHOLDER: Brief intro noting that Indian drill prices span ₹800 to ₹30 000+ depending on type, brand, and features. State that this guide breaks it down by category so buyers can budget accurately.]',
        ],
        table: {
          headers: ['Category', 'Entry-Level Price', 'Mid-Range Price', 'Professional Price'],
          rows: [
            ['Corded Drill (basic)', '₹800 – ₹1 500', '₹1 500 – ₹4 000', '₹4 000 – ₹8 000'],
            ['Corded Hammer Drill', '₹1 500 – ₹3 000', '₹3 000 – ₹7 000', '₹7 000 – ₹15 000'],
            ['Cordless Drill (12 V)', '₹2 000 – ₹4 000', '₹4 000 – ₹8 000', '—'],
            ['Cordless Drill (18–20 V)', '₹3 500 – ₹6 000', '₹6 000 – ₹12 000', '₹12 000 – ₹22 000'],
            ['Rotary Hammer / SDS', '₹4 000 – ₹7 000', '₹7 000 – ₹15 000', '₹15 000 – ₹30 000+'],
            ['Bench Drill Press', '₹3 000 – ₹6 000', '₹6 000 – ₹12 000', '₹12 000 – ₹25 000'],
          ],
        },
      },
      {
        id: 'budget-under-2000',
        heading: 'Best Drills Under ₹2 000',
        paragraphs: [
          '[PLACEHOLDER: 2–3 paragraphs. Who should buy (casual home users, light DIY). What to expect (basic 300–450 W single-speed corded drill, 10 mm chuck, no hammer function). What to look for at this price point. Name 2–3 specific models available on Macgly.]',
        ],
        table: null,
      },
      {
        id: 'budget-2000-6000',
        heading: 'Drills in the ₹2 000 – ₹6 000 Range',
        paragraphs: [
          '[PLACEHOLDER: Most popular price band in India. Covers variable-speed corded drills (500–750 W), entry-level hammer drills, and basic 12 V cordless. Who it is for (homeowners, small contractors). 3–4 specific model recommendations with approximate prices.]',
        ],
        table: null,
      },
      {
        id: 'budget-6000-15000',
        heading: 'Professional Drills: ₹6 000 – ₹15 000',
        paragraphs: [
          '[PLACEHOLDER: Mid-to-high segment covering quality corded hammer drills (800–1 050 W), 18–20 V cordless combos, and entry SDS+. Who it is for (serious contractors, workshops, heavy home renovation). Brands to look at in this range.]',
        ],
        table: null,
      },
      {
        id: 'budget-above-15000',
        heading: 'Industrial Grade: Above ₹15 000',
        paragraphs: [
          '[PLACEHOLDER: SDS-Plus and SDS-Max rotary hammers, industrial bench presses, heavy cordless combos. Use cases: construction sites, factories, RCC drilling. Note that Macgly offers GST invoice for input tax credit, which is relevant for industrial buyers.]',
        ],
        table: null,
      },
      {
        id: 'value-picks',
        heading: 'Best Value-for-Money Picks Across Price Points',
        paragraphs: [
          '[PLACEHOLDER: Short curated list — one recommendation per price tier with a 2-sentence reason. Link each to its product page on Macgly using the product slug.]',
        ],
        table: null,
      },
    ],
    faqs: [
      {
        q: 'What is the price of a heavy-duty drill machine in India?',
        a: '[PLACEHOLDER: Heavy-duty corded hammer drills (800–1 200 W) are typically priced between ₹5 000 and ₹15 000. Industrial SDS rotary hammers start at ₹8 000 and go up to ₹30 000+ for premium brands. All prices subject to GST.]',
      },
      {
        q: 'Which is the cheapest drill machine available in India?',
        a: '[PLACEHOLDER: Basic 300 W corded drills are available from ₹700–₹1 200. They are suitable only for light woodwork and soft materials. For anything harder, budget at least ₹1 500–₹2 000 for a 500 W model.]',
      },
      {
        q: 'Is buying a drill machine online safe in India?',
        a: 'Yes, buying from Macgly is safe. All products are sourced from verified vendors, come with a manufacturer warranty, and include a GST tax invoice. You can check the return policy on our Returns page.',
      },
      {
        q: 'Can I get a GST invoice for a drill machine purchase?',
        a: 'Yes. Every purchase on Macgly includes a GST-compliant tax invoice, which you can use for input tax credit (ITC) if you are a registered business.',
      },
    ],
  },

  {
    slug: 'corded-vs-cordless-drills-india',
    title: 'Corded vs Cordless Drills in India: Which Should You Buy? (2024)',
    headline: 'Corded vs Cordless Drills: Which Should You Buy?',
    description:
      'A practical comparison of corded and cordless drills for Indian buyers — covering performance, cost, convenience, and which is right for your use case.',
    datePublished: '2024-09-10',
    dateModified: '2024-09-22',
    author: 'Macgly Editorial Team',
    readTime: '7 min read',
    heroImage: null,
    relatedCategories: [
      { name: 'Engineering & Workshop Kits', slug: 'engineering-workshop-kits' },
    ],
    sections: [
      {
        id: 'quick-verdict',
        heading: 'Quick Verdict',
        paragraphs: [
          '[PLACEHOLDER: 2–3 sentence executive summary. E.g. For most Indian homeowners and light contractors, a cordless 18 V brushless drill is the better buy in 2024 due to improved battery life. For heavy masonry, continuous-use workshops, or tight budgets, a corded model wins on raw power and cost.]',
        ],
        table: null,
      },
      {
        id: 'performance',
        heading: 'Performance Comparison',
        paragraphs: [
          '[PLACEHOLDER: Compare torque, continuous-use capability, and heat management. Corded drills maintain constant power (no battery drain effect). Cordless drills have improved significantly with brushless motors — a quality 18 V model now rivals corded mid-range on most tasks. Explain brushed vs brushless briefly.]',
        ],
        table: {
          headers: ['Factor', 'Corded Drill', 'Cordless Drill'],
          rows: [
            ['Continuous power', 'Unlimited (mains)', 'Limited by battery (20–60 min per charge)'],
            ['Peak torque', 'Higher for same price', 'Catching up (brushless models)'],
            ['Weight', 'Lighter (no battery)', 'Heavier by 300–700 g'],
            ['Best for', 'Heavy / long sessions', 'Mobility and versatility'],
          ],
        },
      },
      {
        id: 'cost',
        heading: 'Cost Comparison in India',
        paragraphs: [
          '[PLACEHOLDER: Corded drills start at ₹800; equivalent cordless starts at ₹2 500–₹3 500. Battery replacement cost after 2–3 years (typically ₹1 500–₹3 500 for 18 V Li-ion). Ecosystem benefits of cordless (share batteries across tools). Total cost of ownership comparison over 3 years.]',
        ],
        table: null,
      },
      {
        id: 'indian-context',
        heading: 'Specific Considerations for India',
        paragraphs: [
          '[PLACEHOLDER: Address India-specific factors: frequent power cuts → cordless advantage; dusty worksites → sealed brushless motors; humidity in coastal/monsoon regions → IP rating importance; voltage fluctuation → corded drills with motor protection are preferable in rural areas. Mention availability of spare parts and batteries through Macgly.]',
        ],
        table: null,
      },
      {
        id: 'which-to-buy',
        heading: 'Which One Should You Buy?',
        paragraphs: [
          '[PLACEHOLDER: Decision tree. Buy corded if: budget under ₹3 000, need 800+ W, work at a fixed location, drill concrete frequently. Buy cordless if: move between job sites, value convenience, can budget ₹5 000+, do light-to-medium tasks. Buy both if: professional contractor needing versatility.]',
        ],
        table: null,
      },
    ],
    faqs: [
      {
        q: 'Is cordless drill as powerful as corded drill?',
        a: '[PLACEHOLDER: Modern 18–20 V brushless cordless drills are close in practical terms for most tasks. However, a corded 800 W+ drill still wins for prolonged masonry work, concrete drilling, or any task requiring sustained maximum torque.]',
      },
      {
        q: 'How long does a cordless drill battery last in India?',
        a: '[PLACEHOLDER: A 2.0 Ah Li-ion battery gives 20–30 minutes of active drilling. A 4.0 Ah battery doubles that. Battery lifespan is typically 300–500 charge cycles (2–4 years with regular use). Store batteries in a cool, dry place to extend life in India\'s climate.]',
      },
      {
        q: 'What voltage cordless drill should I buy in India?',
        a: '[PLACEHOLDER: For general home and workshop use, 18 V (or 20 V MAX) is the standard. 12 V models are lighter but less powerful. 54 V / 60 V models are for heavy industrial use. Most Indian buyers are best served by an 18–20 V model with a 2.0 or 4.0 Ah battery.]',
      },
      {
        q: 'Does Macgly sell cordless drill batteries and chargers separately?',
        a: '[PLACEHOLDER: Yes, Macgly stocks replacement batteries and chargers for major brands. Check the Spare Parts category or search for your brand name + battery on our site.]',
      },
      {
        q: 'Which brand cordless drill is best in India?',
        a: '[PLACEHOLDER: For quality, Bosch and Makita lead. For value, Vega and Cheston offer strong performance at Indian prices. DeWalt and Milwaukee are premium choices for professionals. All are available on Macgly with GST invoice.]',
      },
    ],
  },
];

export function getGuide(slug) {
  return GUIDES.find((g) => g.slug === slug) || null;
}
