import {
  deserializeMoney,
  MajikMoney,
  serializeMoney,
} from "@thezelijah/majik-money";
import {
  COSItem,
  ISODateString,
  MonthlyCapacity,
  ObjectType,
  ServiceID,
  ServiceMetadata,
  ServiceRate,
  ServiceSettings,
  StartDateInput,
  YYYYMM,
} from "./types";
import {
  CapacityPeriodResizeMode,
  RateUnit,
  ServiceStatus,
  ServiceType,
  ServiceVisibility,
} from "./enums";

import {
  autogenerateID,
  createEmptyServiceFinance,
  generateSlug,
  isValidYYYYMM,
  monthsInPeriod,
  offsetMonthsToYYYYMM,
  normalizeStartDate,
} from "./utils";
/**
 * Represents a service in the Majik system.
 * Handles metadata, capacity, COS, and finance calculations (revenue, COS, profit, margins).
 */
export class MajikService {
  readonly __type = "MajikService";

  readonly __object: ObjectType = "class";
  /** Unique service ID */
  id: ServiceID;

  /** URL-friendly slug for the service name */
  slug: string;

  /** Name of the service */
  name: string;

  /** Category of the service */
  category: string;

  /** Service rate configuration (amount + unit) */
  rate: ServiceRate;

  /** Status of the service */
  status: ServiceStatus;

  /** Type of service */
  type: ServiceType;

  /** ISO timestamp of creation */
  timestamp: ISODateString;

  /** ISO timestamp of last update */
  last_update: ISODateString;

  /** Metadata containing description, COS, capacity plan, and finance */
  metadata: ServiceMetadata;

  /** Service settings including status, visibility, and system flags */
  settings: ServiceSettings;

  /** Internal flag for lazy finance recalculation */
  private financeDirty = true;

  /**
   * Creates a new `MajikService` instance.
   * @param id - Optional service ID. Auto-generated if undefined.
   * @param slug - Optional slug. Auto-generated from name if undefined.
   * @param name - Service name.
   * @param metadata - Service metadata including type, category, rate, description, COS, and capacity plan.
   * @param settings - Service settings including status, visibility, and system flags.
   * @param timestamp - Optional creation timestamp. Defaults to current time.
   * @param last_update - Optional last update timestamp. Defaults to current time.
   */
  constructor(
    id: ServiceID | undefined,
    slug: string | undefined,
    name: string,
    metadata: ServiceMetadata,
    settings: ServiceSettings,
    timestamp: ISODateString = new Date().toISOString(),
    last_update: ISODateString = new Date().toISOString()
  ) {
    this.id = id || autogenerateID("mjks");
    this.slug = slug || generateSlug(name);
    this.name = name;
    this.metadata = metadata;
    this.settings = settings ?? {
      status: ServiceStatus.ACTIVE,
      visibility: ServiceVisibility.PRIVATE,
      system: { isRestricted: false },
    };

    this.type = this.metadata.type;
    this.category = this.metadata.category;
    this.rate = this.metadata.rate;
    this.status = this.settings.status;

    this.timestamp = timestamp;
    this.last_update = last_update;
  }

  /** Marks finance calculations as dirty for lazy recomputation */
  private markFinanceDirty(): void {
    this.financeDirty = true;
  }

  /**
   * Returns a zero-value MajikMoney object in the service currency.
   * @param currencyCode - Optional currency code. Defaults to service rate currency or PHP.
   */
  private DEFAULT_ZERO(currencyCode?: string): MajikMoney {
    const code = currencyCode || this.rate?.amount?.currency?.code || "PHP";
    return MajikMoney.zero(code);
  }

  /**
   * Initializes and creates a new `MajikService` with default and null values.
   * @param type - The type of service to initialize. Defaults to `TIME_BASED`. Use Enum `ServiceType`.
   * @returns A new `MajikService` instance.
   */
  static initialize(
    name: string,
    type: ServiceType = ServiceType.TIME_BASED,
    rate: ServiceRate,
    category: string = "Other",
    descriptionText?: string,
    skuID?: string
  ): MajikService {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Name must be a valid non-empty string.");
    }

    if (!category || typeof category !== "string" || category.trim() === "") {
      throw new Error("Category must be a valid non-empty string.");
    }

    // Set default values for optional parameters
    const defaultMetadata: ServiceMetadata = {
      description: {
        text: descriptionText || "A new service.",
      },
      type: type,
      category: category,
      rate: rate,
      sku: skuID || undefined,
      cos: [],
      finance: createEmptyServiceFinance(rate.amount.currency.code),
    };

    const defaultSettings: ServiceSettings = {
      visibility: ServiceVisibility.PRIVATE,
      status: ServiceStatus.ACTIVE,
      system: {
        isRestricted: false,
      },
    };

    return new MajikService(
      undefined,
      undefined,
      name || "My Service",
      defaultMetadata,
      defaultSettings,
      undefined,
      undefined
    );
  }

  /* ------------------ METADATA HELPERS ------------------ */

  /**
   * Updates the service name and regenerates the slug.
   * @param name - New service name.
   */
  setName(name: string): this {
    this.name = name;
    this.slug = generateSlug(name);
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the service rate.
   * @param rate - New service rate object.
   */
  setRate(rate: ServiceRate): this {
    this.rate = rate;
    this.metadata.rate = rate;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the rate unit (per hour, per day, etc.).
   * @param unit - New rate unit.
   */
  setRateUnit(unit: RateUnit): this {
    this.rate.unit = unit;
    this.metadata.rate.unit = unit;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the numeric rate amount.
   * @param amount - New rate amount (must be positive).
   */
  setRateAmount(amount: number): this {
    if (amount <= 0) throw new Error("Rate Amount must be positive");
    this.rate.amount = MajikMoney.fromMajor(
      amount,
      this.rate.amount.currency.code
    );
    this.metadata.rate.amount = MajikMoney.fromMajor(
      amount,
      this.metadata.rate.amount.currency.code
    );
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the service category.
   * @param category - New category name.
   */
  setCategory(category: string): this {
    this.category = category;
    this.metadata.category = category;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the HTML and plain text of the Service Description.
   * @param html - The new html of the Description. Must be a non-empty string.
   * @param text - The new plain text of the Description. Must be a non-empty string.
   * @throws Will throw an error if either the `html` or `text` are not provided or are not a string.
   */
  setDescription(html: string, text: string): this {
    if (!html || typeof html !== "string" || html.trim() === "") {
      throw new Error("HTML must be a valid non-empty string.");
    }

    if (!text || typeof text !== "string" || text.trim() === "") {
      throw new Error("Text must be a valid non-empty string.");
    }

    this.metadata.description.html = html;
    this.metadata.description.text = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the Plain Text of the Service Description.
   * @param text - The new Description Text of the Service. Must be a non-empty string.
   * @throws Will throw an error if the `text` is not provided or is not a string.
   */
  setDescriptionText(text: string): this {
    if (!text || typeof text !== "string" || text.trim() === "") {
      throw new Error("Description Text must be a valid non-empty string.");
    }

    this.metadata.description.text = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the Description of the Service.
   * @param html - The new Description of the Service. Must be a non-empty string.
   * @throws Will throw an error if the `html` is not provided or is not a string.
   */
  setDescriptionHTML(html: string): this {
    if (!html || typeof html !== "string" || html.trim() === "") {
      throw new Error("Description HTML must be a valid non-empty string.");
    }

    this.metadata.description.html = html;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the SEO of the Service Description.
   * @param text - The new SEO Text of the Service. Must be a non-empty string.
   * @throws Will throw an error if the `text` is not provided or is not a string.
   */
  setDescriptionSEO(text: string): this {
    if (!text || typeof text !== "string" || text.trim() === "") {
      this.metadata.description.seo = undefined;
      this.updateTimestamp();
      return this;
    }

    this.metadata.description.seo = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the Type of the Service.
   * @param type - The new Type of the Service. Use Enum `ServiceType`.
   * @throws Will throw an error if the `type` is not provided or is not a string.
   */
  setType(type: ServiceType): this {
    if (!Object.values(ServiceType).includes(type)) {
      throw new Error("Invalid Service type.");
    }

    this.metadata.type = type;
    this.type = type;
    this.updateTimestamp();
    return this;
  }

  /**
   * Returns the SEO text for this service if available; otherwise the content plain text;
   */
  get seo(): string {
    if (!!this.metadata.description.seo?.trim())
      return this.metadata.description.seo;
    return this.metadata.description.text;
  }

  /* ------------------ COS MANAGEMENT ------------------ */

  /**
   * Returns true if the service has at least one COS (cost breakdown) item.
   */
  hasCostBreakdown(): boolean {
    return Array.isArray(this.metadata.cos) && this.metadata.cos.length > 0;
  }

  /**
   * Adds a new COS (Cost of Service) item.
   * @param name - COS item name.
   * @param unitCost - Cost per unit.
   * @param quantity - Number of units (default 1).
   * @param unit - Optional unit name (e.g., "hour").
   */
  addCOS(
    name: string,
    unitCost: MajikMoney,
    quantity: number = 1,
    unit?: string
  ): this {
    if (!name.trim()) throw new Error("COS name cannot be empty");
    if (quantity <= 0)
      throw new Error("COS quantity must be greater than zero");
    this.assertCurrency(unitCost);

    const newItem: COSItem = {
      id: autogenerateID("mjkscost"),
      item: name,
      quantity,
      unitCost,
      unit,
      subtotal: unitCost.multiply(quantity),
    };

    this.metadata.cos.push(newItem);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Pushes an existing COSItem into the metadata.
   * @param item - COSItem to add.
   */
  pushCOS(item: COSItem): this {
    if (!item.id) throw new Error("COS item must have an id");
    if (!item.item?.trim()) throw new Error("COS item must have a name");
    if (item.quantity <= 0)
      throw new Error("COS quantity must be greater than zero");

    this.assertCurrency(item.unitCost);
    item.subtotal = item.unitCost.multiply(item.quantity);

    this.metadata.cos.push(item);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates an existing COS item by ID.
   * @param id - COS item ID.
   * @param updates - Partial fields to update.
   */
  updateCOS(
    id: string,
    updates: Partial<Pick<COSItem, "quantity" | "unitCost" | "unit" | "item">>
  ): this {
    const item = this.metadata.cos.find((c) => c.id === id);
    if (!item) throw new Error(`COS item ${id} not found`);

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) throw new Error("Quantity must be positive");
      item.quantity = updates.quantity;
    }

    if (updates.unitCost) {
      this.assertCurrency(updates.unitCost);
      item.unitCost = updates.unitCost;
    }

    if (!!updates?.item?.trim()) {
      item.item = updates.item;
    }

    item.unit = updates.unit ?? item.unit;
    item.subtotal = item.unitCost.multiply(item.quantity);

    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Replaces all COS items with a new array.
   * @param items - Array of COSItem.
   */
  setCOS(items: COSItem[]): this {
    items.forEach((item) => {
      if (
        !item.id ||
        !item.item ||
        !item.unitCost ||
        item.quantity == null ||
        !item.subtotal
      ) {
        throw new Error(
          "Each COSItem must have id, item, unitCost, quantity, and subtotal"
        );
      }
      this.assertCurrency(item.unitCost);
    });
    this.metadata.cos = [...items];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Removes a COS item by ID */
  removeCOS(id: string): this {
    const index = this.metadata.cos.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`COS item with id ${id} not found`);
    this.metadata.cos.splice(index, 1);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Clears all COS items */
  clearCostBreakdown(): this {
    this.metadata.cos.length = 0;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /* ------------------ CAPACITY MANAGEMENT ------------------ */

  /**
   * Returns true if the service has at least one Capacity Plan item.
   */
  hasCapacity(): boolean {
    return (
      Array.isArray(this.metadata.capacityPlan) &&
      this.metadata.capacityPlan.length > 0
    );
  }

  /**
   * Returns the earliest (initial) YYYYMM from the capacity plan.
   */
  get earliestCapacityMonth(): YYYYMM | null {
    if (!this.hasCapacity()) return null;

    const supply = this.metadata.capacityPlan!;

    return supply.reduce(
      (earliest, current) =>
        current.month < earliest ? current.month : earliest,
      supply[0].month
    );
  }

  /**
   * Returns the most recent (latest) YYYYMM from the capacity plan.
   */
  get latestCapacityMonth(): YYYYMM | null {
    if (!this.hasCapacity()) return null;

    const supply = this.metadata.capacityPlan!;

    return supply.reduce(
      (latest, current) => (current.month > latest ? current.month : latest),
      supply[0].month
    );
  }

  get capacity(): MonthlyCapacity[] {
    return this.metadata?.capacityPlan || [];
  }

  /**
   * Returns the total capacity units across all months.
   */
  get totalCapacity(): number {
    const capacity = this.metadata.capacityPlan ?? [];
    return capacity.reduce(
      (sum, c) => sum + c.capacity + (c.adjustment ?? 0),
      0
    );
  }

  /**
   * Returns the average capacity per month.
   * Includes adjustments.
   */
  get averageMonthlyCapacity(): number {
    const capacity = this.metadata.capacityPlan ?? [];
    if (capacity.length === 0) return 0;

    return this.totalCapacity / capacity.length;
  }

  /**
   * Returns the MonthlyCapacity entry with the highest supply.
   * Includes adjustments.
   */
  get maxSupplyMonth(): MonthlyCapacity | null {
    const supply = this.metadata.capacityPlan ?? [];
    if (supply.length === 0) return null;

    return supply.reduce((max, current) => {
      const maxUnits = max.capacity + (max.adjustment ?? 0);
      const currUnits = current.capacity + (current.adjustment ?? 0);
      return currUnits > maxUnits ? current : max;
    });
  }

  /**
   * Returns the MonthlyCapacity entry with the lowest supply.
   * Includes adjustments.
   */
  get minSupplyMonth(): MonthlyCapacity | null {
    const supply = this.metadata.capacityPlan ?? [];
    if (supply.length === 0) return null;

    return supply.reduce((min, current) => {
      const minUnits = min.capacity + (min.adjustment ?? 0);
      const currUnits = current.capacity + (current.adjustment ?? 0);
      return currUnits < minUnits ? current : min;
    });
  }

  /**
   * Generates and replaces the capacity plan automatically.
   *
   * @param months - Number of months to generate from the start date.
   * @param amount - Base units for the first month.
   * @param growthRate - Optional growth rate per month (e.g. 0.03 = +3%).
   * @param startDate - Date | ISO date | YYYYMM. Defaults to current month.
   * @returns {this} Updated service instance.
   */
  generateCapacityPlan(
    months: number,
    amount: number,
    growthRate: number = 0,
    startDate?: StartDateInput
  ): this {
    if (!Number.isInteger(months) || months <= 0) {
      throw new Error("Months must be a positive integer");
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Amount must be a non-negative number");
    }

    if (growthRate < 0) {
      throw new Error("Growth rate cannot be negative");
    }

    const start = normalizeStartDate(startDate);
    const supplyPlan: MonthlyCapacity[] = [];

    let currentUnits = amount;

    for (let i = 0; i < months; i++) {
      const date = new Date(start.getFullYear(), start.getMonth() + i, 1);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const month = `${yyyy}-${mm}` as YYYYMM;

      supplyPlan.push({
        month,
        capacity: Math.round(currentUnits),
      });

      if (growthRate > 0) {
        currentUnits *= 1 + growthRate;
      }
    }

    return this.setCapacity(supplyPlan);
  }

  /**
   * Normalizes all supply plan entries to have the same unit amount.
   *
   * - Throws if supply plan is empty
   * - If only one entry exists, does nothing
   * - If multiple entries exist, sets all units to the provided amount
   *
   * @param amount - Unit amount to apply to all months
   * @returns {this} Updated subscription instance
   */
  normalizeCapacityUnits(amount: number): this {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Amount must be a non-negative number");
    }

    const supply = this.metadata.capacityPlan;

    if (!supply || supply.length === 0) {
      throw new Error("Supply plan is empty");
    }

    if (supply.length === 1) {
      return this;
    }

    supply.forEach((s) => {
      s.capacity = amount;
    });

    this.updateTimestamp();
    this.markFinanceDirty();

    return this;
  }

  recomputeCapacityPeriod(
    start: YYYYMM,
    end: YYYYMM,
    mode: CapacityPeriodResizeMode = CapacityPeriodResizeMode.DEFAULT
  ): this {
    if (!isValidYYYYMM(start) || !isValidYYYYMM(end)) {
      throw new Error("Invalid YYYYMM period");
    }

    if (!this.hasCapacity()) {
      throw new Error("No existing capacity plan to recompute");
    }

    if (start > end) {
      throw new Error("Start month must be <= end month");
    }

    const newLength = monthsInPeriod(start, end);
    const oldPlan = [...this.metadata.capacityPlan!];
    const oldLength = oldPlan.length;

    const newPlan: MonthlyCapacity[] = [];

    if (mode === CapacityPeriodResizeMode.DEFAULT) {
      for (let i = 0; i < newLength; i++) {
        const source = i < oldLength ? oldPlan[i] : oldPlan[oldLength - 1]; // extend using last known value

        newPlan.push({
          month: offsetMonthsToYYYYMM(start, i),
          capacity: source.capacity,
          adjustment: source.adjustment,
        });
      }
    }

    if (mode === CapacityPeriodResizeMode.DISTRIBUTE) {
      const total = this.totalCapacity;
      const base = Math.floor(total / newLength);
      let remainder = total % newLength;

      for (let i = 0; i < newLength; i++) {
        const extra = remainder > 0 ? 1 : 0;
        remainder--;

        newPlan.push({
          month: offsetMonthsToYYYYMM(start, i),
          capacity: base + extra,
        });
      }
    }

    this.metadata.capacityPlan = newPlan;
    this.updateTimestamp();
    this.markFinanceDirty();

    return this;
  }

  /**
   * Sets the entire monthly capacity plan.
   * @param capacityPlan - Array of MonthlyCapacity.
   */
  setCapacity(capacityPlan: MonthlyCapacity[]): this {
    capacityPlan.forEach((s) => {
      if (!isValidYYYYMM(s.month)) throw new Error(`Invalid month: ${s.month}`);
      if (typeof s.capacity !== "number")
        throw new Error("Capacity must be a number");
    });
    this.metadata.capacityPlan = [...capacityPlan];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Adds capacity for a specific month.
   * @param month - YYYYMM string.
   * @param hours - Number of hours.
   * @param adjustment - Optional adjustment.
   */
  addCapacity(month: YYYYMM, hours: number, adjustment?: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    this.metadata.capacityPlan ??= [];
    if (this.metadata.capacityPlan.some((s) => s.month === month)) {
      throw new Error(
        `Month ${month} already exists. Use updateCapacityHours or updateCapacityAdjustment`
      );
    }
    this.metadata.capacityPlan.push({ month, capacity: hours, adjustment });
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates capacity hours for a month.
   * @param month - YYYYMM string.
   * @param hours - New hours.
   */
  updateCapacityUnits(month: YYYYMM, hours: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) throw new Error(`Month ${month} not found`);
    plan.capacity = hours;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates capacity adjustment for a month.
   * @param month - YYYYMM string.
   * @param adjustment - Optional adjustment value.
   */
  updateCapacityAdjustment(month: YYYYMM, adjustment?: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) throw new Error(`Month ${month} not found`);
    plan.adjustment = adjustment;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Removes a month from the capacity plan */
  removeCapacity(month: YYYYMM): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const index = this.metadata.capacityPlan?.findIndex(
      (s) => s.month === month
    );
    if (index === undefined || index === -1)
      throw new Error(`Month ${month} not found`);
    this.metadata.capacityPlan!.splice(index, 1);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Clears the entire capacity plan */
  clearCapacity(): this {
    this.metadata.capacityPlan = [];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /* ------------------ FINANCE HELPERS ------------------ */

  /** Computes gross revenue across all months */
  private computeGrossRevenue(): MajikMoney {
    const plan = this.metadata.capacityPlan ?? [];
    return plan.reduce(
      (acc, s) =>
        acc.add(this.rate.amount.multiply(s.capacity + (s.adjustment ?? 0))),
      this.DEFAULT_ZERO()
    );
  }

  /** Computes gross COS across all months */
  private computeGrossCOS(): MajikMoney {
    const plan = this.metadata.capacityPlan ?? [];
    const unitCOS = this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );

    return plan.reduce(
      (acc, s) => acc.add(unitCOS.multiply(s.capacity + (s.adjustment ?? 0))),
      this.DEFAULT_ZERO()
    );
  }

  /** Computes gross profit (revenue - COS) */
  private computeGrossProfit(): MajikMoney {
    return this.computeGrossRevenue().subtract(this.computeGrossCOS());
  }

  /** Recomputes and stores aggregate finance info */
  private recomputeFinance(): void {
    if (!this.financeDirty) return;

    const grossRevenue = this.computeGrossRevenue();
    const grossCOS = this.computeGrossCOS();
    const grossProfit = this.computeGrossProfit();
    const grossIncome = grossProfit;

    const revenueMargin = grossRevenue.isZero()
      ? 0
      : grossProfit.ratio(grossRevenue);
    const cosMargin = grossRevenue.isZero() ? 0 : grossCOS.ratio(grossRevenue);

    this.metadata.finance = {
      revenue: {
        gross: { value: grossRevenue, marginRatio: 1 },
        net: { value: grossRevenue, marginRatio: 1 },
      },
      cos: {
        gross: { value: grossCOS, marginRatio: cosMargin },
        net: { value: grossCOS, marginRatio: cosMargin },
      },
      income: {
        gross: { value: grossIncome, marginRatio: revenueMargin },
        net: { value: grossIncome, marginRatio: revenueMargin },
      },
      profit: {
        gross: { value: grossProfit, marginRatio: revenueMargin },
        net: { value: grossProfit, marginRatio: revenueMargin },
      },
    };

    this.financeDirty = false;
  }

  /* ------------------ AGGREGATE FINANCE GETTERS ------------------ */

  get averageMonthlyRevenue(): MajikMoney {
    const months = this.metadata.capacityPlan?.length ?? 0;
    if (months === 0) return this.DEFAULT_ZERO();
    return this.grossRevenue.divide(months);
  }

  get averageMonthlyProfit(): MajikMoney {
    const months = this.metadata.capacityPlan?.length ?? 0;
    if (months === 0) return this.DEFAULT_ZERO();
    return this.grossProfit.divide(months);
  }

  /** Returns total gross revenue */
  get grossRevenue(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.revenue.gross.value;
  }

  /** Returns total gross COS */
  get grossCost(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.cos.gross.value;
  }

  /** Returns total gross profit */
  get grossProfit(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.profit.gross.value;
  }

  /** Returns net revenue */
  get netRevenue(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.revenue.net.value;
  }

  /** Returns net profit */
  get netProfit(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.profit.net.value;
  }

  get unitCost(): MajikMoney {
    return this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );
  }

  get unitProfit(): MajikMoney {
    return this.rate.amount.subtract(this.unitCost);
  }

  get unitMargin(): number {
    return this.rate.amount.isZero()
      ? 0
      : this.unitProfit.ratio(this.rate.amount);
  }

  get price(): MajikMoney {
    return this.rate.amount.isZero() ? this.DEFAULT_ZERO() : this.rate.amount;
  }

  getMonthlySnapshot(month: YYYYMM) {
    return {
      month,
      revenue: this.getRevenue(month),
      cogs: this.getCOS(month),
      profit: this.getProfit(month),
      margin: this.getMargin(month),
      netRevenue: this.getNetRevenue(month),
      netIncome: this.getNetIncome(month),
    };
  }

  /**
   * Calculates Net Revenue for a given month.
   * @param month - YYYYMM
   * @param discounts - Total discounts for the month (optional)
   * @param returns - Total returns for the month (optional)
   * @param allowances - Total allowances for the month (optional)
   * @returns {MajikMoney} Net Revenue
   */
  getNetRevenue(
    month: YYYYMM,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    let net = this.getRevenue(month);
    if (discounts) net = net.subtract(discounts);
    if (returns) net = net.subtract(returns);
    if (allowances) net = net.subtract(allowances);
    return net;
  }

  /**
   * Calculates Net Profit for a given month.
   * @param month - YYYYMM
   * @param operatingExpenses - Total operating expenses (optional)
   * @param taxes - Total taxes (optional)
   * @param discounts - Total discounts for the month (optional)
   * @param returns - Total returns for the month (optional)
   * @param allowances - Total allowances for the month (optional)
   * @returns {MajikMoney} Net Profit
   */
  getNetProfit(
    month: YYYYMM,
    operatingExpenses?: MajikMoney,
    taxes?: MajikMoney,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    let netRev = this.getNetRevenue(month, discounts, returns, allowances);
    if (operatingExpenses) netRev = netRev.subtract(operatingExpenses);
    if (taxes) netRev = netRev.subtract(taxes);
    return netRev;
  }

  /**
   * Alias for getNetProfit, same as Net Income
   */
  getNetIncome(
    month: YYYYMM,
    operatingExpenses?: MajikMoney,
    taxes?: MajikMoney,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    return this.getNetProfit(
      month,
      operatingExpenses,
      taxes,
      discounts,
      returns,
      allowances
    );
  }

  /* ------------------ MONTHLY FINANCE ------------------ */

  getRevenue(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    if (!this.metadata.capacityPlan) return this.DEFAULT_ZERO();
    const plan = this.metadata.capacityPlan.find((s) => s.month === month);
    if (!plan) return this.DEFAULT_ZERO();
    return this.rate.amount.multiply(plan.capacity + (plan.adjustment ?? 0));
  }

  get cos(): readonly COSItem[] {
    return this.metadata.cos;
  }

  getCOS(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    if (!this.metadata.capacityPlan) return this.DEFAULT_ZERO();
    const plan = this.metadata.capacityPlan.find((s) => s.month === month);
    if (!plan) return this.DEFAULT_ZERO();
    const perUnitCOS = this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );
    return perUnitCOS.multiply(plan.capacity + (plan.adjustment ?? 0));
  }

  /**
   * Alias for Get COS. Retrieves COS for a given month.
   * @param month - YYYYMM month.
   * @returns {MajikMoney} COS for the month.
   */
  getCost(month: YYYYMM): MajikMoney {
    return this.getCOS(month);
  }

  getProfit(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    return this.getRevenue(month).subtract(this.getCOS(month));
  }

  getMargin(month: YYYYMM): number {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const revenue = this.getRevenue(month);
    return revenue.isZero()
      ? 0
      : this.getProfit(month)
          .divideDecimal(revenue.toMajorDecimal())
          .toNumber();
  }

  /* ------------------ UTIL ------------------ */

  /**
   * Validates the `MajikService` instance to ensure that all required fields are set.
   * If any required field is missing or invalid, the method will either throw an error
   * or return `false`, depending on the `throwError` parameter.
   *
   * @param throwError - Optional. If true, throws an error for the first missing or invalid property.
   *                     Defaults to false, in which case it returns a boolean indicating validity.
   * @returns {boolean} - Returns true if the instance is valid, or false if not when `throwError` is false.
   * @throws {Error} - Throws an error when a required field is missing or invalid, and `throwError` is true.
   */
  validateSelf(throwError: boolean = false): boolean {
    const requiredFields = [
      { field: this.id, name: "ID" },
      { field: this.timestamp, name: "Timestamp" },

      // Personal Information
      { field: this.name, name: "Service Name" },
      { field: this.metadata.description.text, name: "Description" },
      { field: this.metadata.rate.amount.toMajor(), name: "Rate Amount" },
      { field: this.metadata.rate.unit, name: "Rate Unit" },
    ];

    for (const { field, name } of requiredFields) {
      if (field === null || field === undefined || field === "") {
        if (throwError) {
          throw new Error(
            `Validation failed: Missing or invalid property - ${name}`
          );
        }
        return false;
      }
    }

    return true;
  }

  /**
   * Converts the current `MajikService` class to a plain JSON object and automatically generates an ID.
   * @returns {object} - A plain JSON object representation of the Service with an autogenerated ID.
   */
  finalize(): object {
    return {
      ...this.toJSON(),
      id: autogenerateID("mjkp"),
    };
  }

  /**
   * Converts the current MajikService object to a plain JavaScript object (JSON).
   * @returns {object} - The plain object representation of the MajikService instance.
   */
  toJSON(): object {
    const preJSON = {
      __type: "MajikService",
      __object: "json",
      id: this.id,
      slug: this.slug,
      name: this.name,
      category: this.category,
      rate: this.rate,
      status: this.status,
      type: this.type,
      timestamp: this.timestamp,
      last_update: this.last_update,
      metadata: this.metadata,
      settings: this.settings,
    };

    const serializedMoney: object = serializeMoney(preJSON);

    return serializedMoney;
  }

  /**
   * Static method to parse a JSON string or object into a `MajikService` instance.
   *
   * @param json - A JSON string or plain object to be parsed.
   * @returns {MajikService} - A new MajikService instance based on the parsed JSON.
   * @throws Will throw an error if required properties are missing.
   */

  static parseFromJSON(json: string | object): MajikService {
    // If the input is a string, parse it as JSON
    const rawParse: MajikService =
      typeof json === "string"
        ? JSON.parse(json)
        : structuredClone
        ? structuredClone(json)
        : JSON.parse(JSON.stringify(json));

    const parsedData: MajikService = deserializeMoney(rawParse);
    // Validate required properties
    if (!parsedData.id) {
      throw new Error("Missing required property: 'id'");
    }

    if (!parsedData.timestamp) {
      throw new Error("Missing required property: 'timestamp'");
    }

    if (!parsedData.metadata) {
      throw new Error("Missing required property: 'Metadata'");
    }

    if (!parsedData.settings) {
      throw new Error("Missing required property: 'Settings'");
    }

    return new MajikService(
      parsedData.id,
      parsedData?.slug,
      parsedData.name,
      parsedData.metadata,
      parsedData.settings,
      parsedData?.timestamp,
      parsedData?.last_update
    );
  }

  /**
   * Updates the `last_update` timestamp to the current time.
   * This method should be called internally whenever a property is modified.
   */
  private updateTimestamp(): void {
    this.last_update = new Date().toISOString();
  }

  private assertCurrency(money: MajikMoney): void {
    if (money.currency.code !== this.rate.amount.currency.code) {
      throw new Error("Currency mismatch with product SRP");
    }
  }
}

export function isMajikServiceClass(item: MajikService): boolean {
  return item.__object === "class";
}

export function isMajikServiceJSON(item: MajikService): boolean {
  return item.__object === "json";
}
