import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layers, PartyPopper, Zap } from 'lucide-react';
import { cardContent, unlockedCardIds, type CardContent } from '@/db/cards';
import { dueCardIds } from '@/db/practice';
import { completePracticeSession, reviewCard } from '@/db/progression';
import { db, uid } from '@/db/db';
import type { Rating } from '@/domain/grading';
import { shuffle } from '@/domain/random';
import { cardAccuracy, SRS_RULES } from '@/domain/srs';
import { formatDayKey } from '@/domain/dates';
import type { FlashcardReview } from '@/domain/records';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { FlashcardFace, RatingButtons } from '@/components/activities/ActivityViews';
import { Button, Card, EmptyState, LinkButton, PageHeader, ProgressBar, Segmented, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';
import { QUALIFYING_REVIEW_ITEMS } from '@/domain/xp';

const SESSION_SIZE = 15;

export default function Flashcards() {
  const toast = useToast();
  const [deck, setDeck] = useState<'due' | 'all'>('due');
  const [cards, setCards] = useState<CardContent[] | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState(0);
  const [finished, setFinished] = useState<{ xp: number } | null>(null);
  const [sessionId, setSessionId] = useState(() => uid());
  const [rows, setRows] = useState<Map<string, FlashcardReview>>(new Map());
  const [counts, setCounts] = useState({ due: 0, all: 0 });
  const timer = useActiveTimer(!finished);
  const saving = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [due, all] = await Promise.all([dueCardIds(), unlockedCardIds()]);
      const ids = shuffle(deck === 'due' ? due : all, sessionId).slice(0, SESSION_SIZE);
      const r = await db.flashcards.bulkGet(all);
      if (!alive) return;
      setRows(new Map(r.filter(Boolean).map((x) => [x!.cardId, x!])));
      setCounts({ due: due.length, all: all.length });
      setCards(ids.map(cardContent).filter((c): c is CardContent => !!c));
      setPos(0);
      setRated(0);
      setRevealed(false);
      setFinished(null);
    })();
    return () => {
      alive = false;
    };
  }, [deck, sessionId]);

  async function rate(r: Rating) {
    if (!cards || saving.current) return;
    saving.current = true;
    timer.lap();
    const card = cards[pos];
    const res = await reviewCard(card.id, r);
    toast.achievements(res.achievements);
    const nextRated = rated + 1;
    setRated(nextRated);
    // "Again" cards come back at the end of this session.
    const nextCards = r === 'again' && cards.filter((c) => c.id === card.id).length < 2 ? [...cards, card] : cards;
    setCards(nextCards);
    if (pos + 1 >= nextCards.length) {
      const s = await completePracticeSession({ sessionId, mode: 'flashcards', items: nextRated, correct: 0, seconds: timer.total() });
      toast.achievements(s.achievements);
      setFinished({ xp: s.xpEvents.reduce((n, e) => n + e.amount, 0) });
    } else {
      setPos(pos + 1);
      setRevealed(false);
    }
    saving.current = false;
  }

  if (!cards) return <Spinner />;

  const header = <PageHeader title="Flashcards" back="/practice" subtitle={`${counts.due} due · ${counts.all} unlocked from completed lessons`} />;

  if (counts.all === 0)
    return (
      <div>
        {header}
        <EmptyState icon={<Layers />} title="No flashcards yet" action={<LinkButton to="/learn">Start a lesson</LinkButton>}>
          Key terms from each lesson you complete become flashcards here.
        </EmptyState>
      </div>
    );

  if (finished)
    return (
      <div>
        {header}
        <Card className="hero-gradient text-center">
          <PartyPopper size={40} className="mx-auto text-violet" />
          <p className="mt-2 text-xl font-bold">Session complete</p>
          <p className="text-muted">{rated} cards reviewed</p>
          {finished.xp > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1 font-bold text-amber">
              <Zap size={16} /> +{finished.xp} XP
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {rated < QUALIFYING_REVIEW_ITEMS ? `Review ${QUALIFYING_REVIEW_ITEMS}+ cards in a session to earn XP.` : 'Practice XP cap reached for today.'}
            </p>
          )}
        </Card>
        <div className="mt-4 space-y-2">
          <Button block size="lg" onClick={() => setSessionId(uid())}>
            Review more
          </Button>
          <LinkButton to="/practice" variant="ghost" block>
            Back to Practice
          </LinkButton>
        </div>
      </div>
    );

  if (!cards.length)
    return (
      <div>
        {header}
        <Segmented label="Deck" value={deck} onChange={setDeck} options={[{ value: 'due', label: `Due (${counts.due})` }, { value: 'all', label: `All (${counts.all})` }]} />
        <div className="mt-4">
          <EmptyState icon={<PartyPopper />} title="All caught up!" action={<Button onClick={() => setDeck('all')}>Browse all cards</Button>}>
            No cards are due today. Come back tomorrow, or review the full deck anyway.
          </EmptyState>
        </div>
      </div>
    );

  const card = cards[pos];
  const row = rows.get(card.id);
  const acc = row ? cardAccuracy(row) : null;

  return (
    <div>
      {header}
      <Segmented label="Deck" value={deck} onChange={(v) => { setDeck(v); setSessionId(uid()); }} options={[{ value: 'due', label: `Due (${counts.due})` }, { value: 'all', label: `All (${counts.all})` }]} />
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={pos / cards.length} className="flex-1" label="Flashcard session progress" />
        <span className="text-sm font-semibold text-muted">
          {pos + 1}/{cards.length}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${pos}-${card.id}`} initial={{ opacity: 0, rotateY: -12 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }} className="mt-4">
          <FlashcardFace front={card.front} back={card.back} detail={card.detail} revealed={revealed} onReveal={() => setRevealed(true)} />
        </motion.div>
      </AnimatePresence>
      <p className="mt-2 text-center text-xs text-faint">
        {card.source}
        {row ? ` · next due ${formatDayKey(row.due)} · reviewed ${row.history.length}×${acc !== null ? ` · ${Math.round(acc * 100)}% recalled` : ''}` : ' · new card'}
      </p>
      <div className="mt-4">
        {revealed ? (
          <>
            <RatingButtons onRate={rate} />
            <p className="mt-2 text-center text-xs text-muted">{SRS_RULES.map((r) => r.label).join(' · ')} — keys 1–4 work too.</p>
          </>
        ) : (
          <Button block size="lg" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        )}
      </div>
    </div>
  );
}
