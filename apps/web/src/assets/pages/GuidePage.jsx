import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGuide } from '../../data/guides';
import FaqSection from '../components/common/FaqSection';
import { setMeta, injectJsonLd, guideJsonLd, faqJsonLd } from '../../utils/seo';

export default function GuidePage() {
  const { slug } = useParams();
  const guide = getGuide(slug);

  useEffect(() => {
    if (!guide) return;
    setMeta({
      title:       guide.title,
      description: guide.description,
      canonical:   `https://www.macgly.com/guides/${guide.slug}`,
      type:        'article',
    });
    const ldItems = [guideJsonLd(guide)];
    if (guide.faqs?.length) ldItems.push(faqJsonLd(guide.faqs));
    injectJsonLd(ldItems);
  }, [guide]);

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-2xl font-bold text-secondary-800">Guide not found</p>
        <Link to="/" className="mt-4 text-primary-600 hover:underline">Back to Home</Link>
      </div>
    );
  }

  const published = new Date(guide.datePublished).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-secondary-400 mb-6 flex items-center gap-1.5 flex-wrap">
        <Link to="/" className="hover:text-secondary-700">Home</Link>
        <span>/</span>
        <span className="text-secondary-700 font-medium">Buying Guides</span>
        <span>/</span>
        <span className="text-secondary-700 font-medium">{guide.headline}</span>
      </nav>

      {/* Article header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 leading-snug">
          {guide.headline}
        </h1>
        <p className="mt-3 text-lg text-secondary-500 leading-relaxed">{guide.description}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-sm text-secondary-400">
          <span>By {guide.author}</span>
          <span>·</span>
          <time dateTime={guide.datePublished}>{published}</time>
          <span>·</span>
          <span>{guide.readTime}</span>
        </div>
      </header>

      {/* Table of contents */}
      <nav className="bg-orange-50 border border-orange-100 rounded-xl p-5 mb-10" aria-label="Table of contents">
        <h2 className="text-xs font-bold text-secondary-600 uppercase tracking-widest mb-3">In This Guide</h2>
        <ol className="space-y-2 text-sm">
          {guide.sections.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span className="text-secondary-300 mt-0.5 shrink-0">→</span>
              <a href={`#${s.id}`} className="text-primary-600 hover:underline">{s.heading}</a>
            </li>
          ))}
          {guide.faqs?.length > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-secondary-300 mt-0.5 shrink-0">→</span>
              <a href="#faqs" className="text-primary-600 hover:underline">Frequently Asked Questions</a>
            </li>
          )}
        </ol>
      </nav>

      {/* Article sections */}
      <article className="space-y-12">
        {guide.sections.map((s) => (
          <section key={s.id} id={s.id}>
            <h2 className="text-2xl font-bold text-secondary-900 mb-4">{s.heading}</h2>
            <div className="space-y-3">
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-secondary-600 leading-relaxed">{p}</p>
              ))}
            </div>
            {s.table && (
              <div className="overflow-x-auto mt-5">
                <table className="w-full text-sm border-collapse border border-secondary-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-secondary-100">
                      {s.table.headers.map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-left font-semibold text-secondary-700 border-b border-secondary-200 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-secondary-50'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-4 py-2.5 border-b border-secondary-100 text-secondary-600">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </article>

      {/* Related categories */}
      {guide.relatedCategories?.length > 0 && (
        <div className="mt-12 rounded-xl bg-secondary-50 border border-secondary-200 p-5">
          <h2 className="font-bold text-secondary-800 mb-3">Shop Related Products on Macgly</h2>
          <div className="flex flex-wrap gap-2">
            {guide.relatedCategories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className="px-4 py-2 bg-white border border-secondary-200 rounded-full text-sm font-medium text-secondary-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FAQs */}
      {guide.faqs?.length > 0 && (
        <div id="faqs">
          <FaqSection faqs={guide.faqs} />
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-12 rounded-xl bg-primary-600 text-white p-6 text-center">
        <p className="font-bold text-lg mb-1">Ready to shop?</p>
        <p className="text-primary-100 text-sm mb-4">Genuine products · GST invoice · Pan-India delivery</p>
        <Link
          to="/products"
          className="inline-block bg-white text-primary-600 font-bold px-6 py-2.5 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Browse All Products
        </Link>
      </div>
    </div>
  );
}
