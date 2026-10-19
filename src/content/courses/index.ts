import type { Course } from '@/domain/content';
import { ecommerceFundamentals } from './ecommerce-fundamentals';
import { shippingTerminology } from './shipping-terminology';
import { printOnDemand } from './print-on-demand';
import { tiktokShop } from './tiktok-shop';
import { creatorMarketing } from './creator-marketing';
import { businessFinance } from './business-finance';

/** Playable courses in recommended order. */
export const playableCourses: Course[] = [shippingTerminology, ecommerceFundamentals, businessFinance, printOnDemand, tiktokShop, creatorMarketing];
