import { MajikMoney } from "@thezelijah/majik-money";
import {
  RateUnit,
  ServiceStatus,
  ServiceType,
  ServiceVisibility,
} from "./enums";

export type ObjectType = "class" | "json";
export type ServiceID = string;
export type ServiceSKU = string;

export type ISODateString = string;
export type YYYYMM = `${number}${number}${number}${number}-${number}${number}`;
export type StartDateInput = Date | ISODateString | YYYYMM;

/**
 * Represents a Cost of Service (COS) item.
 * Similar to COGS for products, e.g., labor, materials, subcontractor fees.
 */
export interface COSItem {
  id: string;
  item: string;
  unitCost: MajikMoney;
  quantity: number; // e.g., hours or units of resource used
  subtotal: MajikMoney;
  unit?: string; // e.g., "hour", "day", "session"
}

/**
 * Represents monthly capacity plan entry.
 */
export interface MonthlyCapacity {
  month: YYYYMM;
  capacity: number; // total hours/days available
  adjustment?: number; // optional extra or reduced hours
}

/**
 * Value with margin ratio for finance snapshots.
 */
export interface ValueRatio {
  value: MajikMoney;
  marginRatio: number;
}

/**
 * Service finance information.
 */
export interface ServiceFinance {
  profit: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  revenue: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  income: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  cos: {
    // cost of service
    gross: ValueRatio;
    net: ValueRatio;
  };
}

/**
 * Service rate object: amount + unit.
 */
export interface ServiceRate {
  amount: MajikMoney; // monetary value
  unit: RateUnit; // billing unit
}

/**
 * Metadata of a service.
 */
export interface ServiceMetadata {
  sku?: ServiceSKU;
  description: {
    text: string;
    html?: string;
    seo?: string;
  };
  photos?: string[];
  type: ServiceType; // Could later add a ServiceType enum
  category: string;
  rate: ServiceRate; // rate per hour/day/session
  cos: COSItem[];
  capacityPlan?: MonthlyCapacity[];

  /** Cached finance snapshot */
  finance: ServiceFinance;
}

/**
 * Service settings including visibility and status.
 */
export interface ServiceSettings {
  status: ServiceStatus;
  visibility: ServiceVisibility;
  system?: { isRestricted: boolean; restrictedUntil?: ISODateString };
}
