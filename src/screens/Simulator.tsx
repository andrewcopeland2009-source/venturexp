import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, BookOpen, Info, Megaphone, Package, RotateCcw, Rocket, Smile, Timer, TrendingDown, TrendingUp, Truck, Wallet } from 'lucide-react';
import {
  applyMonth,
  CREATORS_PER_MONTH,
  MARKETING,
  MONTHS,
  PRODUCTS,
  SAMPLE_OPTIONS,
  SIM_ID,
  SIM_RULES,
  SUPPLIERS,
  STARTING_CASH,
  product,
  sampleCost,
  simulateMonth,
  startSim,
  summarizeSim,
  supplier,
  unitCost,
  type MonthChoices,
  type MonthResult,
  type SetupChoices,
  type SimState,
} from '@/domain/simulation';
import { saveSimulationRun } from '@/db/progression';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Button, Card, PageHeader, Pill, ProgressBar, SectionTitle, cx } from '@/components/ui';
import { useToast } from '@/components/toast';

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function Disclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-soft p-3 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
      <span>
        <span className="font-semibold">Educational simulation.</span> Fictional money and simplified, documented rules. Results are not forecasts and don’t predict real business success.
      </span>
    </p>
  );
}

function Choice({ selected, onClick, title, meta, children, disabled }: { selected: boolean; onClick: () => void; title: string; meta?: string; children?: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx('w-full rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-50', selected ? 'border-violet bg-violet-soft' : 'border-line-strong bg-card hover:border-violet/50')}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        {meta && <span className="shrink-0 text-sm font-semibold text-muted">{meta}</span>}
      </span>
      {children && <span className="mt-1 block text-sm text-muted">{children}</span>}
    </button>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: number; tone?: 'neg' | 'pos'; bold?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between py-1.5 text-[15px]', bold && 'border-t border-line pt-2.5 font-bold')}>
      <span className={bold ? '' : 'text-muted'}>{label}</span>
      <span className={cx(tone === 'neg' && 'text-rose', tone === 'pos' && 'text-green')}>{tone === 'neg' && value > 0 ? `−${money(value)}` : money(value)}</span>
    </div>
  );
}

type Phase = 'intro' | 'product' | 'supplier' | 'samples' | 'decide' | 'result' | 'summary';

export default function Simulator() {
  const toast = useToast();
  const runs = useLiveQuery(() => db.simulationRuns.where('simId').equals(SIM_ID).reverse().sortBy('finishedAt'), []);
  const [phase, setPhase] = useState<Phase>('intro');
  const [setup, setSetup] = useState<SetupChoices>({ productId: 'tee', supplierId: 'standard', samples: 1 });
  const [state, setState] = useState<SimState | null>(null);
  const [choices, setChoices] = useState<MonthChoices>({ price: 28, marketing: 'organic', commission: 10 });
  const [last, setLast] = useState<MonthResult | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [showRules, setShowRules] = useState(false);

  const p = product(setup.productId);
  const preview = useMemo(() => (state ? simulateMonth(state, choices) : null), [state, choices]);

  function begin() {
    const s = startSim(setup);
    setState(s);
    setChoices({ price: p.refPrice, marketing: 'organic', commission: 10 });
    setPhase('decide');
  }

  function runMonth() {
    if (!state) return;
    const r = simulateMonth(state, choices);
    const next = applyMonth(state, r);
    setLast(r);
    setState(next);
    setPhase('result');
  }

  async function afterResult() {
    if (!state) return;
    if (state.months.length >= MONTHS) {
      const sum = summarizeSim(state);
      const res = await saveSimulationRun({
        simId: SIM_ID,
        startedAt,
        finishedAt: Date.now(),
        choices: { product: setup.productId, supplier: setup.supplierId, samples: setup.samples, ...Object.fromEntries(state.months.flatMap((m) => [[`m${m.month}price`, m.choices.price], [`m${m.month}marketing`, m.choices.marketing], [`m${m.month}commission`, m.choices.commission]])) },
        finalCash: sum.finalCash,
        totalRevenue: sum.totalRevenue,
        totalProfit: sum.totalProfit,
        satisfaction: sum.avgSatisfaction,
      });
      toast.achievements(res.achievements);
      setPhase('summary');
    } else setPhase('decide');
  }

  function replay() {
    setState(null);
    setLast(null);
    setStartedAt(Date.now());
    setPhase('product');
  }

  const steps: Phase[] = ['product', 'supplier', 'samples'];
  const month = (state?.months.length ?? 0) + (phase === 'result' ? 0 : 1);

  return (
    <div>
      <PageHeader
        title="Launch a POD Brand"
        subtitle="A deterministic business simulation"
        back="/practice"
        action={
          <button onClick={() => setShowRules(!showRules)} aria-expanded={showRules} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
            <BookOpen size={18} /> Rules
          </button>
        }
      />

      {state && phase !== 'summary' && (
        <Card className="mb-4 grid grid-cols-3 gap-2 p-3 text-center">
          <div>
            <p className="text-xs text-muted">Cash</p>
            <p className={cx('font-extrabold', state.cash < 0 ? 'text-rose' : '')}>{money(state.cash)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Month</p>
            <p className="font-extrabold">
              {Math.min(month, MONTHS)}/{MONTHS}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Satisfaction</p>
            <p className="font-extrabold">{state.satisfaction}</p>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card className="mb-4">
              <p className="mb-2 font-bold">How the simulation works</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
                {SIM_RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'intro' && (
        <div className="space-y-4">
          <Card className="hero-gradient">
            <Rocket size={32} className="text-violet" />
            <h2 className="mt-2 text-xl font-bold">You have {money(STARTING_CASH)} to launch a print-on-demand brand.</h2>
            <p className="mt-2 text-muted">
              Choose a product, a supplier and how many samples to order. Then run {MONTHS} months: set your price, marketing strategy and creator commission, and see how cash, revenue, COGS,
              fees, profit, fulfillment time and customer satisfaction respond.
            </p>
          </Card>
          <Disclaimer />
          <Button block size="lg" onClick={() => setPhase('product')}>
            Start the simulation
          </Button>
          {runs && runs.length > 0 && (
            <>
              <SectionTitle>Past runs</SectionTitle>
              <ul className="space-y-2">
                {runs.slice(0, 5).map((r) => (
                  <li key={r.id} className="surface flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{product(String(r.choices.product)).name}</span>
                      <span className="text-muted"> · {supplier(String(r.choices.supplier)).name}</span>
                    </span>
                    <span className={cx('font-bold', r.totalProfit >= 0 ? 'text-green' : 'text-rose')}>{money(r.totalProfit)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {steps.includes(phase) && (
        <div>
          <div className="mb-4 flex gap-1.5" aria-label={`Setup step ${steps.indexOf(phase) + 1} of 3`} role="img">
            {steps.map((s, i) => (
              <span key={s} className={cx('h-1.5 flex-1 rounded-full', i <= steps.indexOf(phase) ? 'bg-violet' : 'bg-elevated')} />
            ))}
          </div>

          {phase === 'product' && (
            <section aria-labelledby="sim-product">
              <h2 id="sim-product" className="text-xl font-bold">
                1. Choose your product
              </h2>
              <div role="radiogroup" className="mt-3 space-y-2.5">
                {PRODUCTS.map((x) => (
                  <Choice key={x.id} selected={setup.productId === x.id} onClick={() => setSetup({ ...setup, productId: x.id })} title={x.name} meta={`$${x.baseCost} base · ~$${x.refPrice} typical`}>
                    {x.blurb} Return rate {Math.round(x.returnRate * 100)}%.
                  </Choice>
                ))}
              </div>
            </section>
          )}
          {phase === 'supplier' && (
            <section aria-labelledby="sim-supplier">
              <h2 id="sim-supplier" className="text-xl font-bold">
                2. Choose a POD supplier
              </h2>
              <div role="radiogroup" className="mt-3 space-y-2.5">
                {SUPPLIERS.map((s) => (
                  <Choice
                    key={s.id}
                    selected={setup.supplierId === s.id}
                    onClick={() => setSetup({ ...setup, supplierId: s.id })}
                    title={s.name}
                    meta={`${money(unitCost({ ...setup, supplierId: s.id }))}/unit`}
                  >
                    {s.blurb} {s.productionDays}-day production · {Math.round(s.defectRate * 100)}% misprints.
                  </Choice>
                ))}
              </div>
            </section>
          )}
          {phase === 'samples' && (
            <section aria-labelledby="sim-samples">
              <h2 id="sim-samples" className="text-xl font-bold">
                3. Order samples?
              </h2>
              <p className="mt-1 text-sm text-muted">Samples catch print problems before customers see them and make better product photos.</p>
              <div role="radiogroup" className="mt-3 space-y-2.5">
                {SAMPLE_OPTIONS.map((o) => (
                  <Choice key={o.count} selected={setup.samples === o.count} onClick={() => setSetup({ ...setup, samples: o.count })} title={o.label} meta={money(sampleCost({ ...setup, samples: o.count }))}>
                    {o.count === 0 ? 'Save cash now, risk more misprints.' : `Misprints × ${o.defectFactor}, photos boost demand ${Math.round((o.photoBoost - 1) * 100)}%.`}
                  </Choice>
                ))}
              </div>
            </section>
          )}

          <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" onClick={() => setPhase(steps.indexOf(phase) === 0 ? 'intro' : steps[steps.indexOf(phase) - 1])}>
              Back
            </Button>
            {phase === 'samples' ? (
              <Button onClick={begin}>Launch the brand</Button>
            ) : (
              <Button onClick={() => setPhase(steps[steps.indexOf(phase) + 1])}>Continue</Button>
            )}
          </div>
        </div>
      )}

      {phase === 'decide' && state && preview && (
        <section aria-labelledby="sim-decide" className="space-y-4">
          <h2 id="sim-decide" className="text-xl font-bold">
            Month {state.months.length + 1}: your decisions
          </h2>
          <Card>
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="font-bold">Retail price</span>
                <span className="text-xl font-extrabold">${choices.price}</span>
              </span>
              <input
                type="range"
                min={p.minPrice}
                max={p.maxPrice}
                step={1}
                value={choices.price}
                onChange={(e) => setChoices({ ...choices, price: Number(e.target.value) })}
                className="mt-3 h-11 w-full accent-[var(--c-violet)]"
                aria-valuetext={`$${choices.price}`}
              />
              <span className="flex justify-between text-xs text-muted">
                <span>${p.minPrice}</span>
                <span>Typical ${p.refPrice}</span>
                <span>${p.maxPrice}</span>
              </span>
            </label>
            <p className="mt-2 text-sm text-muted">
              Unit cost {money(unitCost(setup))} + $5 shipping. Gross profit per order before fees ≈ {money(choices.price - unitCost(setup) - 5)}.
            </p>
          </Card>

          <div>
            <p className="mb-2 font-bold">Marketing strategy</p>
            <div role="radiogroup" className="space-y-2.5">
              {MARKETING.map((m) => (
                <Choice key={m.id} selected={choices.marketing === m.id} onClick={() => setChoices({ ...choices, marketing: m.id })} title={m.name} meta={m.monthlyCost ? `${money(m.monthlyCost)}/mo` : m.id === 'creators' ? `${CREATORS_PER_MONTH} free products` : 'Free'}>
                  {m.blurb}
                </Choice>
              ))}
            </div>
          </div>

          <Card>
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="font-bold">Creator commission</span>
                <span className="text-xl font-extrabold">{choices.commission}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={choices.commission}
                onChange={(e) => setChoices({ ...choices, commission: Number(e.target.value) })}
                className="mt-3 h-11 w-full accent-[var(--c-violet)]"
                aria-valuetext={`${choices.commission} percent`}
              />
            </label>
            <p className="mt-1 text-sm text-muted">
              Paid only on creator-attributed orders. {choices.marketing === 'creators' ? 'Higher commission motivates more creators to post.' : 'A few affiliates join any program with commission above 0%.'}
            </p>
          </Card>

          <Card className="border-blue/30">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue">
              <Info size={16} /> Preview with these settings
            </p>
            <p className="mt-1 text-sm text-muted">
              ~{preview.orders} orders · revenue {money(preview.revenue)} · profit {money(preview.profit)}
            </p>
          </Card>

          <Button block size="lg" onClick={runMonth}>
            Run month {state.months.length + 1}
          </Button>
        </section>
      )}

      {phase === 'result' && last && state && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="sim-result" className="space-y-4">
          <h2 id="sim-result" className="text-xl font-bold">
            Month {last.month} results
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Package size={14} /> Orders
              </p>
              <p className="text-2xl font-extrabold">{last.orders}</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                {last.profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} Profit
              </p>
              <p className={cx('text-2xl font-extrabold', last.profit >= 0 ? 'text-green' : 'text-rose')}>{money(last.profit)}</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Timer size={14} /> Fulfillment
              </p>
              <p className="text-2xl font-extrabold">{last.fulfillmentDays} days</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Smile size={14} /> Satisfaction
              </p>
              <p className="text-2xl font-extrabold">{last.satisfaction}/100</p>
              <ProgressBar value={last.satisfaction / 100} tone={last.satisfaction >= 70 ? 'green' : 'amber'} height={6} className="mt-1" label="Customer satisfaction" />
            </Card>
          </div>

          <Card>
            <p className="mb-1 font-bold">Profit & loss</p>
            <Row label={`Revenue (${last.orders} × $${last.choices.price})`} value={last.revenue} />
            <Row label={`Refunds (${last.returns} returns)`} value={last.refunds} tone="neg" />
            <Row label="COGS" value={last.cogs} tone="neg" />
            <Row label={`Reprints (${last.defects} misprints)`} value={last.reprintCost} tone="neg" />
            <Row label="Shipping" value={last.shipping} tone="neg" />
            <Row label="Payment fees" value={last.paymentFees} tone="neg" />
            <Row label="Marketing" value={last.marketingCost + last.seedingCost} tone="neg" />
            <Row label={`Creator commission (${last.creatorOrders} orders)`} value={last.commissionCost} tone="neg" />
            <Row label="Store plan" value={last.fixedCost} tone="neg" />
            <Row label="Profit" value={last.profit} bold tone={last.profit >= 0 ? 'pos' : 'neg'} />
            <div className="mt-2 flex items-center justify-between rounded-xl bg-elevated px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5">
                <Wallet size={16} /> Cash
              </span>
              <span className="font-semibold">
                {money(last.cashStart)} → {money(last.cashEnd)}
              </span>
            </div>
          </Card>

          <Card>
            <p className="mb-2 font-bold">What happened & why</p>
            <ul className="space-y-2 text-[15px]">
              {last.notes.map((n) => (
                <li key={n} className="flex items-start gap-2">
                  <Megaphone size={16} className="mt-1 shrink-0 text-violet" /> {n}
                </li>
              ))}
            </ul>
          </Card>

          <Button block size="lg" onClick={afterResult}>
            {state.months.length >= MONTHS ? 'See summary' : `Plan month ${state.months.length + 1}`}
          </Button>
        </motion.section>
      )}

      {phase === 'summary' && state && <Summary state={state} onReplay={replay} />}
    </div>
  );
}

function Summary({ state, onReplay }: { state: SimState; onReplay: () => void }) {
  const s = summarizeSim(state);
  return (
    <section aria-labelledby="sim-summary" className="space-y-4">
      <Card className="hero-gradient text-center">
        <Truck size={32} className="mx-auto text-violet" />
        <h2 id="sim-summary" className="mt-2 text-2xl font-extrabold">
          3-month summary
        </h2>
        <p className="text-muted">
          {product(state.setup.productId).name} · {supplier(state.setup.supplierId).name} · {state.setup.samples} sample{state.setup.samples === 1 ? '' : 's'}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-left">
          <div>
            <p className="text-xs text-muted">Total revenue</p>
            <p className="text-xl font-extrabold">{money(s.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Total profit</p>
            <p className={cx('text-xl font-extrabold', s.totalProfit >= 0 ? 'text-green' : 'text-rose')}>{money(s.totalProfit)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Final cash</p>
            <p className="text-xl font-extrabold">{money(s.finalCash)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Avg satisfaction</p>
            <p className="text-xl font-extrabold">{s.avgSatisfaction}/100</p>
          </div>
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-bold">Month by month</p>
        <div className="space-y-1.5 text-sm">
          {state.months.map((m) => (
            <div key={m.month} className="flex items-center justify-between gap-2">
              <span>
                Month {m.month} · ${m.choices.price} · {MARKETING.find((x) => x.id === m.choices.marketing)?.name}
              </span>
              <span className={cx('shrink-0 font-semibold', m.profit >= 0 ? 'text-green' : 'text-rose')}>{money(m.profit)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 text-muted">
            <span>Samples (up front)</span>
            <span>−{money(state.sampleCost)}</span>
          </div>
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-bold">Trade-offs to remember</p>
        <ul className="space-y-2 text-[15px]">
          {s.lessons.map((l) => (
            <li key={l} className="flex items-start gap-2">
              <Pill tone="violet" className="mt-0.5 shrink-0">
                ✓
              </Pill>
              {l}
            </li>
          ))}
        </ul>
      </Card>
      <Disclaimer />
      <Button block size="lg" onClick={onReplay}>
        <RotateCcw size={18} /> Replay with different choices
      </Button>
    </section>
  );
}
