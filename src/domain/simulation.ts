/**
 * "Launch a POD Brand" — a deterministic, fully transparent educational simulation.
 * Same choices → same results, always. These are teaching rules, NOT forecasts: real
 * outcomes depend on countless factors this model ignores.
 */

export const SIM_ID = 'pod-launch';
export const STARTING_CASH = 1000;
export const MONTHS = 3;
export const SHIPPING_PER_ORDER = 5;
export const TRANSIT_DAYS = 4;
export const PAYMENT_FEE_RATE = 0.03;
export const PAYMENT_FEE_FIXED = 0.3;
export const STORE_PLAN_PER_MONTH = 30;

export interface ProductOption {
  id: string;
  name: string;
  baseCost: number;
  refPrice: number;
  minPrice: number;
  maxPrice: number;
  /** Orders per month at the reference price with neutral marketing. */
  baseDemand: number;
  /** How strongly demand reacts to price (higher = more sensitive). */
  elasticity: number;
  returnRate: number;
  blurb: string;
}

export const PRODUCTS: ProductOption[] = [
  { id: 'tee', name: 'Graphic T-shirt', baseCost: 11, refPrice: 28, minPrice: 18, maxPrice: 45, baseDemand: 90, elasticity: 1.6, returnRate: 0.05, blurb: 'Popular and easy to sell, but lots of competition. Sizing causes some returns.' },
  { id: 'hoodie', name: 'Hoodie', baseCost: 24, refPrice: 50, minPrice: 35, maxPrice: 75, baseDemand: 50, elasticity: 1.3, returnRate: 0.04, blurb: 'Higher price and profit per order, fewer orders. Seasonal in real life.' },
  { id: 'mug', name: 'Ceramic mug', baseCost: 7, refPrice: 18, minPrice: 12, maxPrice: 30, baseDemand: 70, elasticity: 1.8, returnRate: 0.06, blurb: 'Cheap to make, giftable, but breakage in transit drives returns.' },
  { id: 'poster', name: 'Art poster', baseCost: 9, refPrice: 24, minPrice: 15, maxPrice: 40, baseDemand: 45, elasticity: 1.2, returnRate: 0.03, blurb: 'Niche audience that cares about design more than price.' },
];

export interface SupplierOption {
  id: string;
  name: string;
  costMultiplier: number;
  productionDays: number;
  defectRate: number;
  /** Multiplies demand via reviews and photos. */
  quality: number;
  blurb: string;
}

export const SUPPLIERS: SupplierOption[] = [
  { id: 'budget', name: 'Budget Print Co.', costMultiplier: 0.85, productionDays: 6, defectRate: 0.08, quality: 0.9, blurb: '15% cheaper. Slower and more misprints.' },
  { id: 'standard', name: 'Reliable Print', costMultiplier: 1, productionDays: 3, defectRate: 0.03, quality: 1, blurb: 'Market-rate pricing, steady quality.' },
  { id: 'premium', name: 'Premium Studio', costMultiplier: 1.2, productionDays: 2, defectRate: 0.01, quality: 1.08, blurb: '20% pricier. Fast, rarely makes mistakes, nicer blanks.' },
];

export const SAMPLE_OPTIONS = [
  { count: 0, label: 'No samples', defectFactor: 1, photoBoost: 1 },
  { count: 1, label: '1 sample', defectFactor: 0.6, photoBoost: 1.03 },
  { count: 3, label: '3 samples', defectFactor: 0.35, photoBoost: 1.06 },
] as const;

export interface MarketingOption {
  id: 'organic' | 'ads' | 'creators';
  name: string;
  monthlyCost: number;
  blurb: string;
}

export const MARKETING: MarketingOption[] = [
  { id: 'organic', name: 'Organic content', monthlyCost: 0, blurb: 'Post your own videos. Free, slow to start, grows each month.' },
  { id: 'ads', name: 'Paid ads', monthlyCost: 250, blurb: '$250/month. Immediate reach while you pay.' },
  { id: 'creators', name: 'Creator seeding', monthlyCost: 0, blurb: 'Send 5 free products to creators each month and pay commission on their sales.' },
];

export const CREATORS_PER_MONTH = 5;

export interface SetupChoices {
  productId: string;
  supplierId: string;
  samples: 0 | 1 | 3;
}

export interface MonthChoices {
  price: number;
  marketing: MarketingOption['id'];
  /** 0–30 (%), commission paid on creator-attributed sales. */
  commission: number;
}

export interface MonthResult {
  month: number;
  choices: MonthChoices;
  orders: number;
  creatorOrders: number;
  revenue: number;
  refunds: number;
  cogs: number;
  reprintCost: number;
  shipping: number;
  paymentFees: number;
  marketingCost: number;
  seedingCost: number;
  commissionCost: number;
  fixedCost: number;
  profit: number;
  cashStart: number;
  cashEnd: number;
  fulfillmentDays: number;
  defects: number;
  returns: number;
  satisfaction: number;
  notes: string[];
}

export interface SimState {
  setup: SetupChoices;
  sampleCost: number;
  months: MonthResult[];
  cash: number;
  satisfaction: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function product(id: string): ProductOption {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}
export function supplier(id: string): SupplierOption {
  return SUPPLIERS.find((s) => s.id === id) ?? SUPPLIERS[1];
}
export function unitCost(setup: SetupChoices): number {
  return r2(product(setup.productId).baseCost * supplier(setup.supplierId).costMultiplier);
}

/** Samples cost unit cost + shipping each, paid up front. */
export function sampleCost(setup: SetupChoices): number {
  return r2(setup.samples * (unitCost(setup) + SHIPPING_PER_ORDER));
}

export function startSim(setup: SetupChoices): SimState {
  const sc = sampleCost(setup);
  return { setup, sampleCost: sc, months: [], cash: r2(STARTING_CASH - sc), satisfaction: 80 };
}

/** Reach multiplier for a marketing choice in a given month (1-based). */
export function reachFactor(m: MonthChoices, month: number): number {
  switch (m.marketing) {
    case 'organic':
      return r2(0.55 + 0.2 * (month - 1)); // 0.55, 0.75, 0.95 — content compounds
    case 'ads':
      return 1.35;
    case 'creators':
      // More commission → more creators bother posting. 0% → 0.7, 30% → 1.3
      return r2(0.7 + (Math.min(30, Math.max(0, m.commission)) / 30) * 0.6);
  }
}

/** Share of orders attributed to creators (they earn commission on these). */
export function creatorShare(m: MonthChoices): number {
  if (m.marketing === 'creators') return 0.6;
  return m.commission > 0 ? 0.1 : 0; // a few affiliates join any open program
}

export function priceFactor(p: ProductOption, price: number): number {
  return Math.pow(p.refPrice / price, p.elasticity);
}

export function satisfactionFactor(sat: number): number {
  return 0.7 + (sat / 100) * 0.4; // 80 → 1.02
}

export function simulateMonth(state: SimState, choices: MonthChoices): MonthResult {
  const p = product(state.setup.productId);
  const s = supplier(state.setup.supplierId);
  const sample = SAMPLE_OPTIONS.find((o) => o.count === state.setup.samples) ?? SAMPLE_OPTIONS[0];
  const month = state.months.length + 1;
  const price = Math.min(p.maxPrice, Math.max(p.minPrice, choices.price));
  const c: MonthChoices = { ...choices, price };
  const notes: string[] = [];

  const demand =
    p.baseDemand * priceFactor(p, price) * reachFactor(c, month) * s.quality * sample.photoBoost * satisfactionFactor(state.satisfaction);
  const orders = Math.max(0, Math.round(demand));
  const creatorOrders = Math.round(orders * creatorShare(c));
  const defectRate = s.defectRate * sample.defectFactor;
  const defects = Math.round(orders * defectRate);
  const returns = Math.round(orders * p.returnRate);
  const uc = unitCost(state.setup);

  const revenue = r2(orders * price);
  const refunds = r2(returns * price);
  const cogs = r2(orders * uc);
  const reprintCost = r2(defects * (uc + SHIPPING_PER_ORDER));
  const shipping = r2(orders * SHIPPING_PER_ORDER);
  const paymentFees = r2(revenue * PAYMENT_FEE_RATE + orders * PAYMENT_FEE_FIXED);
  const marketingCost = MARKETING.find((m) => m.id === c.marketing)!.monthlyCost;
  const seedingCost = c.marketing === 'creators' ? r2(CREATORS_PER_MONTH * (uc + SHIPPING_PER_ORDER)) : 0;
  const commissionCost = r2(creatorOrders * price * (c.commission / 100));
  const fixedCost = STORE_PLAN_PER_MONTH;
  const costs = refunds + cogs + reprintCost + shipping + paymentFees + marketingCost + seedingCost + commissionCost + fixedCost;
  const profit = r2(revenue - costs);
  const cashStart = state.cash;
  const cashEnd = r2(cashStart + profit);

  const fulfillmentDays = s.productionDays + TRANSIT_DAYS;
  let sat = 92 - defectRate * 400 - Math.max(0, fulfillmentDays - 6) * 4 - p.returnRate * 100;
  if (price > p.refPrice * 1.3) sat -= 8;
  if (price < p.refPrice * 0.8) sat += 3;
  const satisfaction = Math.round(Math.min(100, Math.max(0, sat)));

  // Plain-language explanations of what drove the month.
  const pf = priceFactor(p, price);
  if (pf < 0.85) notes.push(`Your price ($${price}) is above the typical $${p.refPrice}, so fewer people bought — but each sale earns more.`);
  else if (pf > 1.15) notes.push(`Your low price ($${price}) brought in more orders, but thinner profit per order.`);
  if (c.marketing === 'organic')
    notes.push(month === 1 ? 'Organic content starts slowly — reach grows each month you keep posting.' : 'Your content library is compounding: organic reach grew this month.');
  if (c.marketing === 'ads') notes.push('Paid ads delivered steady reach, but cost $250 whether or not they sold.');
  if (c.marketing === 'creators')
    notes.push(`Creators drove ${creatorOrders} orders. Seeding cost $${seedingCost} and commissions $${commissionCost}.`);
  if (defects > 0) notes.push(`${defects} misprint${defects === 1 ? '' : 's'} had to be reprinted and reshipped ($${reprintCost}).`);
  if (state.setup.samples > 0 && month === 1) notes.push('Ordering samples caught print issues early and improved your product photos.');
  if (fulfillmentDays > 8) notes.push(`Customers waited ~${fulfillmentDays} days, which hurt satisfaction.`);
  if (cashEnd < 0) notes.push('Cash went negative — in real life you would need to stop spending or find funding.');
  if (profit > 0 && cashEnd > cashStart) notes.push('Profitable month: cash grew.');

  return {
    month,
    choices: c,
    orders,
    creatorOrders,
    revenue,
    refunds,
    cogs,
    reprintCost,
    shipping,
    paymentFees,
    marketingCost,
    seedingCost,
    commissionCost,
    fixedCost,
    profit,
    cashStart,
    cashEnd,
    fulfillmentDays,
    defects,
    returns,
    satisfaction,
    notes,
  };
}

export function applyMonth(state: SimState, result: MonthResult): SimState {
  return { ...state, months: [...state.months, result], cash: result.cashEnd, satisfaction: result.satisfaction };
}

export interface SimSummary {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  finalCash: number;
  avgSatisfaction: number;
  bestMonth: number;
  lessons: string[];
}

export function summarizeSim(state: SimState): SimSummary {
  const ms = state.months;
  const totalRevenue = r2(ms.reduce((s, m) => s + m.revenue, 0));
  const totalProfit = r2(ms.reduce((s, m) => s + m.profit, 0) - state.sampleCost);
  const totalOrders = ms.reduce((s, m) => s + m.orders, 0);
  const avgSatisfaction = ms.length ? Math.round(ms.reduce((s, m) => s + m.satisfaction, 0) / ms.length) : 0;
  const best = ms.reduce((b, m) => (m.profit > b.profit ? m : b), ms[0]);
  const lessons: string[] = [];
  const sup = supplier(state.setup.supplierId);
  if (sup.id === 'budget') lessons.push('The budget supplier saved on unit cost, but misprints and slow delivery cost money and goodwill.');
  if (sup.id === 'premium') lessons.push('The premium supplier cost more per unit, but fewer defects and faster delivery protected satisfaction.');
  if (state.setup.samples === 0) lessons.push('Skipping samples saved cash up front but let more print problems reach customers.');
  const usedAds = ms.some((m) => m.choices.marketing === 'ads');
  if (usedAds) lessons.push('Paid ads cost the same whether sales came or not — they pay off only when margin per order is healthy.');
  if (ms.some((m) => m.choices.marketing === 'organic')) lessons.push('Organic content was free but slow; it rewards consistency over months.');
  if (ms.some((m) => m.choices.marketing === 'creators')) lessons.push('Creator seeding mixed fixed costs (free products) with variable costs (commission) — you pay more only when they sell.');
  lessons.push('Revenue is not profit: refunds, fees, shipping and marketing all come out before you keep anything.');
  return { totalRevenue, totalProfit, totalOrders, finalCash: state.cash, avgSatisfaction, bestMonth: best?.month ?? 1, lessons };
}

/** The rules, shown in-app so the model is fully transparent. */
export const SIM_RULES: string[] = [
  `You start with $${STARTING_CASH.toLocaleString()} of fictional cash.`,
  'Unit cost = product base cost × supplier cost multiplier. Samples cost unit cost + $5 shipping each, paid up front.',
  'Orders = base demand × (reference price ÷ your price)^elasticity × marketing reach × supplier quality × sample photo boost × satisfaction factor, rounded.',
  'Marketing reach: organic 0.55 → 0.75 → 0.95 over three months; paid ads 1.35 ($250/month); creator seeding 0.7–1.3 depending on commission (0–30%).',
  'Creator seeding sends 5 free products a month (unit cost + shipping each). Creators drive 60% of orders under seeding, 10% otherwise if commission > 0.',
  `Costs each month: COGS, $${SHIPPING_PER_ORDER} shipping per order, reprints for misprints (unit cost + shipping), refunds for returns, payment fees (${PAYMENT_FEE_RATE * 100}% + $${PAYMENT_FEE_FIXED.toFixed(2)} per order), marketing, commission, and a $${STORE_PLAN_PER_MONTH} store plan.`,
  'Misprint rate = supplier defect rate × sample factor (1 sample ×0.6, 3 samples ×0.35).',
  `Fulfillment time = supplier production days + ${TRANSIT_DAYS} transit days.`,
  'Satisfaction = 92 − misprint rate×400 − 4 per day of fulfillment beyond 6 − return rate×100, −8 if price is >30% above typical, +3 if >20% below. Next month’s demand × (0.7 + satisfaction/100 × 0.4).',
];
