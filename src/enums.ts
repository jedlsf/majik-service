
/* -------------------------------------------------------
   Service Types 
------------------------------------------------------- */
export enum ServiceType {
    TIME_BASED = "Time-Based",       // Billed per hour, day, session
    PROJECT_BASED = "Project-Based", // Fixed fee per project
    USAGE_BASED = "Usage-Based",     // Billed per unit of consumption
    OTHER = "Other"                  // Catch-all or hybrid
}


/* -------------------------------------------------------
   Status & Visibility
------------------------------------------------------- */
export enum ServiceStatus {
    DRAFT = "Draft",
    ACTIVE = "Active",
    FULLY_BOOKED = "Fully Booked",   // analogous to out-of-stock
    DISCONTINUED = "Discontinued",
}

export enum ServiceVisibility {
    PRIVATE = "Private",
    PUBLIC = "Public",
}


/**
 * Units for billing a service.
 */
export enum RateUnit {
    PER_HOUR = "Per Hour",
    PER_DAY = "Per Day",
    PER_SESSION = "Per Session",
    FIXED = "Per Fixed",
    PER_UNIT = "Per Unit" // e.g., usage-based
}

export enum CapacityPeriodResizeMode {
  DEFAULT = "default", // trim or pad, keep per-month units
  DISTRIBUTE = "distribute", // preserve total capacity, redistribute evenly
}
