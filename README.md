# Majik Service

**Majik Service** is a fully-featured class representing a service in the **Majik system**, designed for financial management, cost tracking, and capacity planning. It provides utilities for computing revenue, profit, margins, COS (Cost of Service), and net income on a per-month basis. Chainable setter methods make it easy to construct and update services fluently.

---

### Live Demo

[![Majik Runway Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Finance_MajikRunway.c4d2034e.webp)](https://www.thezelijah.world/tools/finance-majik-runway)

> Click the image to try Majik Service inside Majik Runway's revenue stream.

[![Price Genie Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Business_PriceGenie.dfab6d40.webp)](https://www.thezelijah.world/tools/business-price-genie)

> Click the image to try Majik Service inside Price Genie.

---

## Table of Contents

- [Overview](#-overview)
- [Installation](#-installation)
- [Usage](#usage)
  - [Create a Service Instance](#create-a-service-instance)
  - [Metadata Helpers](#metadata-helpers)
  - [COS Management](#cos-management)
  - [Capacity Management](#capacity-management)
  - [Finance Computation](#finance-computation)
  - [Utilities](#utilities)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)
- [Contact](#contact)

---

## ✨ Overview

MajikService manages:

- **Metadata:** `name`, `category`, `type`, `description`, `SKU`, `photos`, `rate`.
- **Settings:** `status`, `visibility`, `system` flags.
- **Finance:** `revenue`, `income`, `profit`, `cos`.
- **Capacity Plan:** Monthly availability, adjustments, generation, recomputation.
- **Cost of Service:** Detailed breakdown of labor, materials, and other costs.
- **Serialization/Deserialization:** Convert to/from JSON with full monetary support via [MajikMoney](https://www.npmjs.com/package/@thezelijah/majik-money).

---

## [Full API Docs](https://www.thezelijah.word/tools/finance-majik-service/docs)

---

## 📦 Installation

```bash
npm i @thezelijah/majik-service @thezelijah/majik-money@latest
```

---

## Usage

### Create a Service Instance

```ts
import { MajikService } from "@thezelijah/majik-service";
import { MajikMoney } from "@/SDK/tools/finance/majik-money";
import { ServiceType, RateUnit } from "@/SDK/tools/business/majik-service/enums";

const service = MajikService.initialize(
  "Video Editing",
  ServiceType.TIME_BASED,
  { amount: MajikMoney.fromMajor(50, "USD"), unit: RateUnit.PER_HOUR },
  "Post-production services",
  "VIDEDIT001"
);

```

Defaults:
status → ACTIVE
visibility → PRIVATE
Empty COS, empty capacity plan

### Example Usage

```ts
import { MajikService } from "@thezelijah/majik-service";
import { MajikMoney } from "@thezelijah/majik-money";
import { ServiceType, RateUnit, CapacityPeriodResizeMode } from "@thezelijah/majik-service/enums";

// Initialize a new service
const videoEditing = MajikService.initialize(
  "Video Editing",
  ServiceType.TIME_BASED,
  { amount: MajikMoney.fromMajor(50, "USD"), unit: RateUnit.PER_HOUR },
  "Professional post-production video editing",
  "VIDEDIT001"
)
  .setDescriptionHTML("<p>High-quality video editing for content creators.</p>")
  .setDescriptionSEO("Video editing service for YouTube, ads, and films")
  .addCOS("Editor Labor", MajikMoney.fromMajor(20, "USD"), 1, "hour")
  .addCOS("Software License", MajikMoney.fromMajor(5, "USD"), 1, "month")
  .generateCapacityPlan(12, 160) // 12 months, 160 hours per month
  .recomputeCapacityPeriod("2025-01", "2025-12", CapacityPeriodResizeMode.DISTRIBUTE);

// Query total capacity
console.log("Total Capacity:", videoEditing.totalCapacity); // 12 months * 160 hours = 1920

// Compute revenue and profit for a specific month
const month = "2025-06";
console.log(`${month} Revenue:`, videoEditing.getRevenue(month).value.toFormat());
console.log(`${month} COS:`, videoEditing.getCOS(month).value.toFormat());
console.log(`${month} Profit:`, videoEditing.getProfit(month).value.toFormat());
console.log(`${month} Margin:`, videoEditing.getMargin(month).toFixed(2) + "%");

// Serialize service for storage or API
const json = videoEditing.toJSON();

// Deserialize back into a functional service
const restoredService = MajikService.parseFromJSON(json);
console.log("Restored Service Name:", restoredService.metadata.description.text);

// Reduce capacity after usage
restoredService.reduceCapacity("2025-06", 10);
console.log("Remaining Capacity for June:", restoredService.capacityPlan.find(c => c.month === "2025-06")?.capacity);
```

### Metadata Helpers

Chainable methods to update service metadata:

| Method                             | Description                    |
| ---------------------------------- | ------------------------------ |
| `setName(name: string)`            | Updates service name and slug  |
| `setCategory(category: string)`    | Updates category               |
| `setType(type: ServiceType)`       | Updates service type           |
| `setRate(rate: ServiceRate)`       | Updates billing rate           |
| `setDescriptionText(text: string)` | Updates plain text description |
| `setDescriptionHTML(html: string)` | Updates HTML description       |
| `setDescriptionSEO(text: string)`  | Updates SEO text               |
| `setPhotos(urls: string[])`        | Sets photo URLs                |


### COS Management

Manage the Cost of Service per item:

| Method                                     | Description                             |
| ------------------------------------------ | --------------------------------------- |
| `addCOS(name, unitCost, quantity?, unit?)` | Add a new COS item                      |
| `pushCOS(item: COSItem)`                   | Push an externally constructed COS item |
| `updateCOS(id, updates)`                   | Update an existing COS item             |
| `removeCOS(id)`                            | Remove COS item by ID                   |
| `setCOS(items: COSItem[])`                 | Replace entire COS array                |
| `clearCOS()`                               | Remove all COS items                    |


### Capacity Management

Manage monthly capacity and service plan:

| Method                                                          | Description                            |
| --------------------------------------------------------------- | -------------------------------------- |
| `addCapacity(month: YYYYMM, capacity, adjustment?)`             | Add a monthly capacity entry           |
| `updateCapacityUnits(month, units)`                             | Update units for a month               |
| `updateCapacityAdjustment(month, adjustment?)`                  | Update adjustment                      |
| `removeCapacity(month)`                                         | Remove a month from the plan           |
| `clearCapacity()`                                               | Remove all capacity entries            |
| `generateCapacityPlan(months, amount, growthRate?, startDate?)` | Auto-generate a monthly plan           |
| `normalizeCapacityUnits(amount)`                                | Normalize all months to the same units |
| `recomputeCapacityPeriod(start, end, mode?)`                    | Resize or redistribute capacity plan   |


Capacity plan queries:

- `totalCapacity` → total units across all months
- `averageMonthlyCapacity` → average per month
- `maxCapacityMonth` / `minCapacityMonth` → highest/lowest monthly capacity

---

### Finance Computation

| Method              | Description                                   |
| ------------------- | --------------------------------------------- |
| `getRevenue(month)` | Returns gross revenue for the specified month |
| `getProfit(month)`  | Returns profit for the specified month        |
| `getCOS(month)`     | Returns total cost of service for month       |
| `getMargin(month)`  | Returns margin ratio                          |


Calculates revenue, costs, and profits per month or across all months.

- `grossRevenue`, `grossCost`, `grossProfit` → totals across capacity plan
- `netRevenue`(month, discounts?, returns?, allowances?) → net per month
- `netProfit`(month, operatingExpenses?, taxes?, discounts?, returns?, allowances?) → net profit per month
- `getRevenue`(month), getCOS(month), getProfit(month), getMargin(month) → month-specific
- `averageMonthlyRevenue`, `averageMonthlyProfit` → averages

All computations use **MajikMoney** and respect currency.

---

### Inventory Management

- metadata.inventory.stock → current stock
- reduceStock(units) → reduces stock safely
- isOutOfStock → boolean flag

Unit-level computations:

- `unitCost`, `unitProfit`, `unitMargin`, `price`

---

### Utilities

- `validateSelf`(throwError?: boolean) → validates all required fields
- `finalize`() → converts to JSON with auto-generated ID
- `toJSON`() → serialize with proper `MajikMoney` handling
- `parseFromJSON`(json: string | object) → reconstruct a `MajikService` instance

---

## Use Cases

**MajikService** is designed for applications that require structured, financial-aware service management. Typical use cases include:

1. Service-Based Businesses

- Track per-hour or per-project billing.
- Compute revenue, COS, and profit per month.
- Generate capacity plans for workforce or resources.

2. Financial Analysis & Reporting

- Monthly revenue, net income, and profit margin snapshots.
- Integrate with accounting modules for forecasting.

3. Resource & Capacity Planning

- Plan availability for staff, studios, or equipment.
- Adjust capacity with recomputeCapacityPeriod or normalizeCapacityUnits.

4. Data Serialization & Integration

- Export to JSON for APIs or database storage.
- Deserialize JSON into functional service instances.

---

## Best Practices

To maximize reliability, maintainability, and performance:

1. Use Chainable Setters

- Always modify products via setter methods (`setRate`, `addCOS`, `setCapacity`) to ensure timestamps and finance recalculations are handled automatically.

2. Validate Before Finalization

- Call `validateSelf`(true) before exporting or persisting the product to ensure all required fields are properly set.

3. Maintain Currency Consistency

- All monetary operations use MajikMoney. Avoid mixing currencies; setter methods validate against product Rate currency.

4. Leverage Supply Plan Utilities

- Use `generateCapacityPlan`, `normalizeCapacityUnits`, or `recomputeCapacityPeriod` to programmatically manage monthly supply rather than manually modifying arrays.

5. Keep COS Accurate

- Always ensure unitCost and subtotal calculations are correct. Prefer addCOS or pushCOS instead of direct array mutation.

6. Minimize Finance Recomputations for Bulk Updates

- When performing bulk updates to COS or supply, consider batching changes and calling recomputeFinance once at the end to avoid repeated expensive calculations.

7. Use Snapshots for Reporting

- Use `getMonthlySnapshot`(month) for consistent monthly financial reporting and dashboards.

8. Error Handling

- All setters throw on invalid input. Wrap critical updates in try/catch to handle edge cases gracefully.

9. Serialization & Deserialization

- Use `toJSON` / finalize for exporting, and parseFromJSON for reconstruction. Avoid manually modifying the serialized object to prevent integrity issues.

---

## Conclusion

**MajikService** provides a robust, chainable, financial-first approach to service management, suitable for enterprise-grade applications with detailed revenue, COS, and capacity planning needs.

## Contributing

Contributions, bug reports, and suggestions are welcome! Feel free to fork and open a pull request.

---

## License

[ISC](LICENSE) — free for personal and commercial use.

---

## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

## About the Developer

- **Developer**: Josef Elijah Fabian
- **GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)
- **Project Repository**: [https://github.com/jedlsf/majik-product](https://github.com/jedlsf/majik-product)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)

---
