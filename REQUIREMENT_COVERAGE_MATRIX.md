# Requirement Coverage Matrix — Project ONE (Sprint 04 Release Gate)

| ID | Requirement Area | Scope & Description | Implementation Details | Test & Database Evidence | Status |
|----|------------------|---------------------|------------------------|--------------------------|--------|
| R01 | Multi-Tenant Architecture | Strict Tenant/Company data isolation | Server-side `companyId` filtering on all queries | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R02 | Multi-Plant Architecture | Plant Master linked to Company, timezone, status | `Plant` table, APIs, UI screen | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R03 | Department Architecture | Department Master linked to Plant | `Department` table, APIs, UI screen | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R04 | User Management | Secure auth, hashed passwords, tenant access | `User`, `UserPlantAccess`, `UserDepartmentAccess` | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R05 | Configurable RBAC | Roles, Permissions, UserRole, RolePermission mapping | `Role`, `Permission` dynamic assignment | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R06 | Authentication & Sessions | JWT login, logout, password hashing, session revocation | `/api/v1/auth/*` REST endpoints & session revoke | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R07 | Plant & Department Security | Server-side plant/department boundary enforcement | Isolation middleware checking request scope | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R08 | Audit Trail & Record History | Central audit service & record timeline API | `AuditLog` table & `GET /foundation/history/*` | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R09 | No Destructive Delete | Soft deactivation/reversal with mandatory reason | Server-side delete block, status transition | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R10 | Reversal Permission Approval | Authorized reversal requiring explicit `*:reverse` permission | Server-side RBAC check on reversal actions | `foundation.test.ts` | IMPLEMENTED + VERIFIED |
| R11 | 5-Minute Inactivity Auto Lock | Auto lock screen after 5 minutes of inactivity | Client inactivity hook & password re-auth | Client Inactivity Verification | IMPLEMENTED + VERIFIED |
| R12 | Voice Input Foundation | Speech-to-text input component for mobile data entry | `VoiceInput` UI component using Web Speech API | Client UI Component | FOUNDATION ONLY |
| R13 | QR / Barcode Foundation | Camera stream QR & Barcode scanning reader | `QRScanner` UI component using MediaDevices | Client UI Component | FOUNDATION ONLY |
| R14 | Offline Queue & Sync | Sync queue manager and connectivity badge | Offline sync queue & retry mechanism | Client Offline Queue Manager | FOUNDATION ONLY |
| R15 | Rate Limiting & Security | Request rate limiting & security event logging | Rate limiter middleware & security audit events | Security Middleware Tests | IMPLEMENTED + VERIFIED |
| R16 | Database Backup Strategy | Automated database snapshot/backup script | Database backup documentation & utility | Database Snapshot Utility | FOUNDATION ONLY |
| R17 | Responsive UI Foundation | Mobile, Tablet, Laptop, Mobile layout | React + Vite + Tailwind CSS responsive shell | Responsive Layout Shell | IMPLEMENTED + VERIFIED |
| R18 | Multi-User Concurrency | Concurrent user access without data corruption | Database transaction safety & optimistic locks | Concurrency Tests | IMPLEMENTED + VERIFIED |
| R19 | Purchase to Stock Flow | Purchase Requisition, PO, Gate Entry, GRN, QA, Stock | Implemented in Sprint 02 baseline | Sprint 02 Golden Flow Tests | IMPLEMENTED + VERIFIED (Sprint 02) |
| R20 | Bill of Materials (BOM) | Multi-level BOM structures, versioning, scrap factors | `BomHeader`, `BomComponent`, REST APIs, BOM UI | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R21 | Work Order Lifecycle | Draft -> Released -> Material Reserved -> In Process -> Completed / Cancelled | `WorkOrder`, automated material requirement calculation, state machine | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R22 | Material Reservation | Automatic calculation from active BOM, plant/warehouse link | `MaterialReservation`, calculation engine | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R23 | Material Issue | Stock consumption against WO, stock deduction, negative stock prevention | `MaterialIssue`, atomic `StockBalance` update, `StockTransaction` ledger | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R24 | Production Execution | Shift production execution, operator, line, quantity reconciliation | `ProductionExecution`, `Executed = Good + Rejected + Hold` validation | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R25 | Production Receipt | FG Stock receipt posting ONLY for good/accepted production | `ProductionReceipt`, atomic FG stock addition, exclusion of rejected/hold qty | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R26 | Finished Goods Inventory | Real-time FG stock balances and transaction ledger | `StockBalance`, `StockTransaction`, FG Stock UI | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R27 | Integration Contracts | Explicit transaction references & outbox events | `TransactionReference`, `EventOutbox` for WO release, material issue, prod completion | `sprint03_golden_flow.test.ts` | IMPLEMENTED + VERIFIED (Sprint 03) |
| R28 | In-Process Quality Control (IPQC) | Mid-execution quality sampling, quantity reconciliation (`Inspected = Passed + Failed`) | `InProcessQaInspection`, `/api/v1/ipqc`, `IpqcManagement.tsx` | `sprint04_golden_flow.test.ts` (Cat 1-3) | IMPLEMENTED + VERIFIED (Sprint 04) |
| R29 | Non-Conformance & CAPA (NCR) | Defect tracking, automatic NCR trigger on IPQC defect, disposition workflow (SCRAP/REWORK/VARIANCE) | `NonConformanceReport`, `/api/v1/ncr`, `NcrManagement.tsx` | `sprint04_golden_flow.test.ts` (Cat 4-11) | IMPLEMENTED + VERIFIED (Sprint 04) |
| R30 | Internal Stock Transfer Operations | Transfer requisitions, approvals, two-step (`ISSUED` / `IN_TRANSIT` -> `COMPLETED`) posting | `InventoryTransferOrder`, `/api/v1/stock-transfers`, `StockTransferManagement.tsx` | `sprint04_golden_flow.test.ts` (Cat 12-21) | IMPLEMENTED + VERIFIED (Sprint 04) |
| R31 | Negative Stock & Concurrency Protection | Prevents source stock over-consumption during transfer issue, concurrent locks | `StockBalance` atomic updates, transaction safety | `sprint04_golden_flow.test.ts` (Cat 20-22) | IMPLEMENTED + VERIFIED (Sprint 04) |
| R32 | Integration Contracts & Outbox Events | Explicit transaction references (`IPQC_CREATED`, `NCR_CREATED`, `STOCK_TRANSFER_*`) and outbox alerts | `TransactionReference`, `EventOutbox`, `Notification` | `sprint04_golden_flow.test.ts` (Cat 26-27) | IMPLEMENTED + VERIFIED (Sprint 04) |
| R33 | Real Database Reporting | Real database reporting summaries for IPQC, NCR, and Stock Transfers | `/api/v1/production-reports/ipqc`, `ncr`, `transfers`, `ProductionReports.tsx` | `sprint04_golden_flow.test.ts` (Cat 30) | IMPLEMENTED + VERIFIED (Sprint 04) |
