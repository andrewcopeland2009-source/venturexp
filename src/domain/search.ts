import { normalizeText } from './grading';

export interface SearchDoc {
  kind: 'term' | 'course' | 'lesson' | 'category';
  id: string;
  title: string;
  subtitle: string;
  /** Extra searchable text: aliases, keywords, definitions. */
  body: string;
  aliases: string[];
  category: string;
  difficulty?: string;
  /** Where to navigate. */
  href: string;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

const tokens = (s: string) => normalizeText(s).split(' ').filter(Boolean);

interface Prepared {
  doc: SearchDoc;
  title: string;
  aliases: string[];
  titleTokens: string[];
  bodyTokens: Set<string>;
  bodyText: string;
}

export function prepare(docs: SearchDoc[]): Prepared[] {
  return docs.map((doc) => {
    const title = normalizeText(doc.title);
    const aliases = doc.aliases.map(normalizeText);
    const bodyText = normalizeText(`${doc.subtitle} ${doc.body}`);
    return {
      doc,
      title,
      aliases,
      titleTokens: [title, ...aliases].join(' ').split(' '),
      bodyTokens: new Set(bodyText.split(' ')),
      bodyText,
    };
  });
}

/**
 * Small offline ranking: every query token must appear (as a word prefix) in the title,
 * an alias or the body. Exact title/alias matches rank highest, then title prefixes.
 */
export function search(index: Prepared[], query: string, limit = 50): SearchHit[] {
  const q = normalizeText(query);
  if (!q) return [];
  const qt = tokens(q);
  const hits: SearchHit[] = [];
  for (const p of index) {
    let score = 0;
    if (p.title === q || p.aliases.includes(q)) score += 100;
    else if (p.title.startsWith(q) || p.aliases.some((a) => a.startsWith(q))) score += 60;
    else if (p.title.includes(q) || p.aliases.some((a) => a.includes(q))) score += 40;
    let allFound = true;
    for (const t of qt) {
      if (p.titleTokens.some((w) => w.startsWith(t))) score += 10;
      else if ([...p.bodyTokens].some((w) => w.startsWith(t))) score += 3;
      else if (p.bodyText.includes(t)) score += 1;
      else {
        allFound = false;
        break;
      }
    }
    if (!allFound) continue;
    if (p.doc.kind === 'term') score += 2;
    hits.push({ doc: p.doc, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title)).slice(0, limit);
}
