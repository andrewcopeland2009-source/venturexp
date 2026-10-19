import { describe, expect, it } from 'vitest';
import {
  applyMonth,
  priceFactor,
  product,
  reachFactor,
  sampleCost,
  simulateMonth,
  startSim,
  summarizeSim,
  unitCost,
  STARTING_CASH,
} from './simulation';

describe('POD simulation arithmetic', () => {
  const setup = { productId: 'tee', supplierId: 'standard', samples: 1 as const };

  it('computes unit and sample costs', () => {
    expect(unitCost(setup)).toBe(11);
    expect(sampleCost(setup)).toBe(16);
    expect(unitCost({ ...setup, supplierId: 'budget' })).toBe(9.35);
    expect(startSim(setup).cash).toBe(STARTING_CASH - 16);
  });

  it('a month balances: profit = revenue − every cost, and cash moves by profit', () => {
    const s = startSim(setup);
    const m = simulateMonth(s, { price: 28, marketing: 'ads', commission: 0 });
    const costs =
      m.refunds + m.cogs + m.reprintCost + m.shipping + m.paymentFees + m.marketingCost + m.seedingCost + m.commissionCost + m.fixedCost;
    expect(m.profit).toBeCloseTo(m.revenue - costs, 2);
    expect(m.cashEnd).toBeCloseTo(m.cashStart + m.profit, 2);
    expect(m.revenue).toBeCloseTo(m.orders * 28, 2);
    expect(m.cogs).toBeCloseTo(m.orders * 11, 2);
    expect(m.shipping).toBe(m.orders * 5);
    expect(m.paymentFees).toBeCloseTo(m.revenue * 0.03 + m.orders * 0.3, 2);
    expect(m.marketingCost).toBe(250);
  });

  it('is deterministic', () => {
    const a = simulateMonth(startSim(setup), { price: 30, marketing: 'creators', commission: 15 });
    const b = simulateMonth(startSim(setup), { price: 30, marketing: 'creators', commission: 15 });
    expect(a).toEqual(b);
  });

  it('higher price lowers orders; organic reach grows over months', () => {
    const p = product('tee');
    expect(priceFactor(p, 40)).toBeLessThan(priceFactor(p, 20));
    expect(reachFactor({ price: 28, marketing: 'organic', commission: 0 }, 3)).toBeGreaterThan(
      reachFactor({ price: 28, marketing: 'organic', commission: 0 }, 1),
    );
  });

  it('creator commission is paid only on creator-attributed orders', () => {
    const m = simulateMonth(startSim(setup), { price: 30, marketing: 'creators', commission: 20 });
    expect(m.commissionCost).toBeCloseTo(m.creatorOrders * 30 * 0.2, 2);
    expect(m.seedingCost).toBe(5 * (11 + 5));
  });

  it('premium supplier with samples has fewer defects and faster fulfillment than budget with none', () => {
    const good = simulateMonth(startSim({ productId: 'tee', supplierId: 'premium', samples: 3 }), { price: 28, marketing: 'ads', commission: 0 });
    const bad = simulateMonth(startSim({ productId: 'tee', supplierId: 'budget', samples: 0 }), { price: 28, marketing: 'ads', commission: 0 });
    expect(good.fulfillmentDays).toBeLessThan(bad.fulfillmentDays);
    expect(good.satisfaction).toBeGreaterThan(bad.satisfaction);
    expect(bad.defects).toBeGreaterThan(good.defects);
  });

  it('summary totals the months and subtracts sample cost', () => {
    let s = startSim(setup);
    for (let i = 0; i < 3; i++) s = applyMonth(s, simulateMonth(s, { price: 28, marketing: 'organic', commission: 0 }));
    const sum = summarizeSim(s);
    expect(sum.totalRevenue).toBeCloseTo(s.months.reduce((n, m) => n + m.revenue, 0), 2);
    expect(sum.totalProfit).toBeCloseTo(s.months.reduce((n, m) => n + m.profit, 0) - 16, 2);
    expect(sum.finalCash).toBeCloseTo(STARTING_CASH + sum.totalProfit, 2);
  });

  it('clamps out-of-range prices', () => {
    const m = simulateMonth(startSim(setup), { price: 1000, marketing: 'ads', commission: 0 });
    expect(m.choices.price).toBe(product('tee').maxPrice);
  });
});
