# PROJECT ONE — Manufacturing Factory Operating System
## Master Blueprint & Sprint Specifications (Sprint 01 – Sprint 06 Architecture)

---

### 1. Architectural Vision & Principles

Project ONE is a unified Manufacturing Factory Operating System designed for modern Indian and Global discrete/process manufacturing enterprises.

#### Core Principle: ONE-TIME DATA ENTRY
```
ONE-TIME DATA ENTRY
  └─> REUSE EVERYWHERE
        └─> AUTOMATIC VALIDATION
              └─> AUTOMATIC WORKFLOW
                    └─> APPROVAL ONLY WHERE REQUIRED
                          └─> COMPLETE AUDIT TRAIL
```

---

### 2. Multi-Tenant Architectural Isolation

- **Tenant Context**: Every enterprise company operating on Project ONE constitutes a strict multi-tenant boundary (`companyId` / `tenantId`).
- **Server-Side Context Binding**: Tenant identity is determined strictly server-side from the authenticated JWT session (`req.user.companyId`).
- **Query Filter Enforcement**: All database queries and mutations automatically apply tenant filters (`where: { companyId: req.user.companyId }`).
- **Cross-Tenant Protection**: Client code cannot manually alter or spoof tenant parameters in HTTP requests or query parameters.

---

### 3. Authorization & Security Chain

```
USER
 └── TENANT (Company ID)
       └── PLANT (Plant Access Isolation)
             └── DEPARTMENT (Department Access Isolation)
                   └── ROLE (Dynamic Roles)
                         └── PERMISSION (Fine-grained Action Codes)
```

1. **Role-Based Permissions**: Action codes follow `<entity>:<action>` format (e.g., `dispatch:create`, `invoice:create`, `gate_out:approve`, `journal:reverse`).
2. **Reversal Approvals**: Reversal and cancellation actions (`actionType: 'REVERSED'`) strictly enforce `*:reverse` permission codes.
3. **5-Minute Auto Session Lock**:
   - The application tracks user inactivity (mouse movement, keypress, touch events).
   - After 5 minutes (300,000 ms) of inactivity, the UI activates a lock overlay requiring password re-authentication.
   - Unlocking triggers a `SECURITY_UNLOCK` audit log entry.

---

### 4. Database Strategy

- **Development Database**: SQLite (`file:./dev.db`)
- **Production Database**: PostgreSQL (Prisma schema designed with PostgreSQL dialect compatibility for standard types, primary key UUIDs, indexes, and relations).

---

### 5. Mobile, Voice, QR & Offline Foundations

- **Responsive Web UI**: Built with Tailwind CSS supporting mobile (<640px), tablet (640px - 1024px), laptop (1024px - 1280px), and ultra-wide screens.
- **Voice Input Foundation (`VoiceInput`)**: Speech-to-text conversion for hands-free floor input.
- **QR Scanner Foundation (`QRScanner`)**: Camera stream barcode/QR code reader.
- **Offline Sync Queue**: Client-side queue capturing pending mutations when offline and syncing automatically upon reconnection.

---

### 6. Sprint 06 Architecture Blueprint & Technical Specifications

#### 6.1 Corrected Golden Flow (Resolving Stock Contradiction)
Previous contradiction: FG Stock = 95 units, Dispatch = 700 units.
**Corrected Logically Valid Flow**:
1. **FG Inventory Stock Balance**: 1,000 units of Finished Goods (FG-GEAR-01) available in `StockBalance` (inspected & QA-accepted).
2. **Customer & Sales Order**: Customer (CUST-001) places Sales Order (SO-2026-001) for 700 units @ ₹1,500/unit (Total ₹1,050,000 base).
3. **Delivery Plan**: Delivery Plan (DP-2026-001) generated for 700 units against SO-2026-001. Available QA-accepted stock (1,000 units) >= Planned Qty (700 units). Shortage = 0 units.
4. **Dispatch Advice**: Dispatch Note (DISP-2026-001) generated for 700 units against DP-2026-001.
5. **Sales Invoice Generation**: Invoice (INV-2026-001) generated for 700 units. Tax Rate applied dynamically via Tax Master (e.g. 18% GST: CGST 9% = ₹94,500, SGST 9% = ₹94,500). Total Invoice Amount = ₹1,239,000.
6. **Gate Out Execution**: Gate Out Entry (GO-2026-001) executed. QA-accepted FG stock atomically decremented by 700 units in `StockBalance` (1,000 - 700 = 300 units remaining).
7. **GL Journal Posting**: Automated double-entry journals posted for Revenue, Accounts Receivable, Inventory, and COGS.
8. **Customer Payment & Reconciliation**: Payment received (PAY-2026-001) for ₹1,239,000 and reconciled against INV-2026-001.

#### 6.2 QA-Accepted FG Quantity Enforcement
- **Strict Server-Side Validation**: Dispatch Advice creation and Gate Out execution **MUST** check that available FG stock has passed QA inspection (`qcStatus: 'ACCEPTED'`).
- Un-inspected stock or stock under QA Hold/Rejected status is strictly locked and cannot be allocated to Delivery Plans, Dispatch Notes, or Gate Out passes.

#### 6.3 FG Inventory Valuation & COGS Source
- **Costing Source**: Weighted Average Costing (WAC) recorded in `StockBalance` and `StockTransaction` ledgers.
- **COGS Calculation**: Upon Gate Out execution, COGS is calculated as:
  $$\text{COGS Amount} = \text{Dispatched Quantity} \times \text{Unit Weighted Average Cost (WAC)}$$
- **Journal Ledger Mapping**:
  - `DR: 5000 - Cost of Goods Sold (COGS)` (Amount = Dispatched Qty × Unit Cost)
  - `CR: 1400 - Finished Goods Inventory` (Amount = Dispatched Qty × Unit Cost)

#### 6.4 Configurable Tax Calculation Engine (Dynamic GST)
- Tax rates are **NEVER** hardcoded.
- A configurable `TaxMaster` entity defines tax slabs (e.g. 0%, 5%, 12%, 18%, 28%) and tax types (`INTRA_STATE` -> CGST + SGST, `INTER_STATE` -> IGST).
- Invoice engine dynamically evaluates customer location vs. plant location to apply CGST/SGST or IGST automatically.

#### 6.5 Invoice Cancellation & Reversal Rules
1. **Before Gate Out Execution (`status: 'ISSUED'`)**:
   - Invoice can be directly cancelled (`status: 'CANCELLED'`).
   - Associated GL Journal entries are automatically reversed using an immutable Reversal Journal Entry (`actionType: 'REVERSED'`).
   - Delivery Plan / Dispatch Advice status resets to allow re-invoicing or modification.
2. **After Gate Out Execution (`status: 'COMPLETED'`)**:
   - Direct Invoice cancellation is **STRICTLY FORBIDDEN**.
   - Physical stock has left the plant premises and stock deduction was committed.
   - Adjustments MUST be handled via a Credit Note / Sales Return workflow in accounting.

#### 6.6 Customer Payment Status Lifecycle & Reconciliation Scope
- **Payment Lifecycle**: `UNPAID` → `PARTIALLY_PAID` → `PAID` → `RECONCILED`.
- **Manual Reconciliation Scope**:
  - Payment Receipts (`CustomerPayment`) record payments received against Customer Accounts.
  - Manual Reconciliation links `CustomerPayment` entries to specific `SalesInvoice` records.
  - Generates GL Journal Entry:
    - `DR: 1010 - Bank / Cash Account`
    - `CR: 1200 - Accounts Receivable`
  - Partial payments update `outstandingBalance` and transition invoice status to `PARTIALLY_PAID`.

#### 6.7 Reusable Double-Entry GL Posting Engine Architecture
- Designed as a universal, atomic posting engine for Sprint 06 (Accounts Receivable & Sales) and extensible to Sprint 07 (Accounts Payable & Procurement).
- **Core Rules**:
  1. Every posted event creates a `JournalHeader` and minimum 2 `JournalLine` entries.
  2. Total Debits MUST equal Total Credits ($\sum \text{Debit} = \sum \text{Credit}$). Out-of-balance postings throw an unhandled `400 Bad Request` validation error.
  3. Every journal entry captures `companyId`, `plantId`, `sourceDocumentType`, `sourceDocumentId`, `postedBy`, and `postedAt`.

#### 6.8 Posted Journal Immutability Rules
- Posted journals (`status: 'POSTED'`) are **IMMUTABLE**. Updates (`UPDATE`) and direct deletions (`DELETE`) are blocked server-side.
- Any correction or cancellation MUST issue a new `Reversal Journal` (`isReversal: true`, `reversingJournalId: originalId`) with swapped Debits and Credits.

#### 6.9 Quantity Validation Chain
Strict server-side chain validation prevents quantity inflation or over-dispatch:
$$\text{SO Quantity} \ge \text{Delivery Plan Quantity} \ge \text{Dispatch Quantity} = \text{Invoice Quantity} = \text{Gate Out Quantity} \le \text{QA-Accepted Stock}$$

#### 6.10 Test Scenario Matrix & Requirements Coverage
Includes explicit test cases for:
- **Negative Scenarios**: Attempting Gate Out exceeding QA stock, applying invalid tax rates, modifying posted journals, cancelling post-Gate Out invoices.
- **Duplicate Scenarios**: Attempting duplicate invoice creation against same dispatch, duplicate payment reconciliation.
- **Concurrency Scenarios**: Simultaneous Gate Out attempts on same stock balance (atomic transactions & row-locking).
- **Idempotency Scenarios**: Retrying invoice generation or payment posting yields identical transaction references without duplicate GL postings.

---

### 7. Sprint 06 Dependency & Integration Map

```
+-----------------------------------------------------------------------------------+
|                                 UPSTREAM DEPENDENCIES                             |
|  +-----------------------+  +----------------------+  +------------------------+  |
|  | Customer & Sales Order|  | Finished Goods Stock |  |  QA Inspection Master  |  |
|  |      (Sprint 05)      |  |     (Sprint 03)      |  |  (qcStatus: ACCEPTED)  |  |
|  +-----------+-----------+  +----------+-----------+  +-----------+------------+  |
+--------------|-------------------------|--------------------------|---------------+
               |                         |                          |
               +-------------------------+--------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                 SPRINT 06 CORE ENGINE                             |
|                                                                                   |
|   +-------------------+       +--------------------+       +------------------+   |
|   |   Delivery Plan   | ----> |  Dispatch Advice   | ----> |  Sales Invoice   |   |
|   +-------------------+       +--------------------+       +--------+---------+   |
|                                                                     |             |
|                                                                     v             |
|   +-------------------+       +--------------------+       +------------------+   |
|   | Customer Payment  | <---- | Double-Entry GL    | <---- | Gate Out Pass    |   |
|   |  & Reconciliation |       |   Posting Engine   |       | (Stock Deduction)|   |
|   +-------------------+       +--------------------+       +------------------+   |
+----------------------------------------|------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                FUTURE EXTENSIONS                                  |
|  +-----------------------------------------------------------------------------+  |
|  | Sprint 07 Accounts Payable (AP) & Supplier General Ledger Posting Engine    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

### 8. Regression Matrix Breakdown (Sprint 01 – Sprint 05)

| Sprint Module | Focus Area | Existing Test File | Test Count | Status |
|---|---|---|---|---|
| Sprint 01 | Multi-Tenant, Plant/Dept Isolation, Auth, Audit, Soft-Delete | `tests/integration/foundation.test.ts` | 6 | PASSED |
| Sprint 02 | Purchase to Stock Flow (PR, PO, Gate Entry, GRN, QA, Stock) | `tests/integration/foundation.test.ts` (Included in flow integration) | 20 | PASSED |
| Sprint 03 | Production to FG Stock Flow (BOM, WO, Reservation, Issue, Receipt) | `tests/integration/sprint03_golden_flow.test.ts` | 32 | PASSED |
| Sprint 04 | IPQC, Non-Conformance (NCR/CAPA), Internal Stock Transfers | `tests/integration/sprint04_golden_flow.test.ts` | 30 | PASSED |
| Sprint 05 | Sales & Demand Management (Enquiry, Quotation, SO, Delivery Plan) | `tests/integration/sprint05_golden_flow.test.ts` | 30 | PASSED |
| **TOTAL EXISTING** | **Sprint 01 - Sprint 05 Baseline Integration Suite** | **4 Test Suites** | **118 Tests** | **ALL PASSED** |
