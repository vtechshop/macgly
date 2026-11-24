// Word-based product search with relevance ranking.
//
// The old search matched the whole query as one phrase, so "wall drill" only
// found products containing exactly "wall drill" and hid every other drill.
// Now each word is matched on its own (any word is enough to match), word
// endings are ignored ("drill" finds "drills" and "drilling"), and results
// are ranked so products matching every word, and matching in the title,
// come first.

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'of', 'to', 'in', 'on', 'with', 'by', 'at', 'or', 'from',
  'buy', 'best', 'price', 'online', 'india',
]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Light stemming so singular/plural/-ing forms meet at a shared prefix.
function stem(word) {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('es') && /(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Search terms from a query: lower-cased, de-duplicated, stopwords dropped. */
function parseTerms(query = '') {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const kept = words.filter((w) => !STOPWORDS.has(w));
  const terms = (kept.length ? kept : words).map(stem).filter((t) => t.length >= 2 || /\d/.test(t));
  return [...new Set(terms)].slice(0, 8);
}

/** Matches a term at the start of a word, so "drill" hits "drills" but not "undrilled". */
function termRegex(term) {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(term)}`, 'i');
}

/** One regex matching any of the terms (for the database pre-filter). */
function anyTermRegex(terms) {
  return new RegExp(`(^|[^a-z0-9])(${terms.map(escapeRe).join('|')})`, 'i');
}

const FIELD_WEIGHTS = { title: 6, tags: 4, category: 3, brand: 3, sku: 3, description: 1 };

/**
 * Relevance of one product. `categoryNames` are the names of its categories.
 * The last term usually names the product type ("wall drill" → drill), so it
 * counts more than the words describing it.
 */
function scoreProduct(p, terms, categoryNames = [], rawQuery = '') {
  const fields = {
    title: p.title || '',
    tags: (p.tags || []).join(' '),
    category: [p.category || '', ...categoryNames].join(' '),
    brand: p.brand || '',
    sku: p.sku || '',
    description: p.description || '',
  };
  let score = 0;
  let matchedTerms = 0;
  terms.forEach((term, i) => {
    const re = termRegex(term);
    let best = 0;
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      if (re.test(fields[field])) best = Math.max(best, weight);
    }
    if (best) {
      matchedTerms += 1;
      score += best * (i === terms.length - 1 && terms.length > 1 ? 1.5 : 1);
    }
  });
  if (terms.length > 1 && matchedTerms === terms.length) score += 10;
  const phrase = rawQuery.trim().toLowerCase();
  if (phrase.length > 2 && fields.title.toLowerCase().includes(phrase)) score += 8;
  return score;
}

module.exports = { parseTerms, termRegex, anyTermRegex, scoreProduct, stem };
