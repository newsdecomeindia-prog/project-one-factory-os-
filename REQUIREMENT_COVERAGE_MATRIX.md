# Requirement Coverage Matrix — Project ONE (Sprint 01 Final Release Gate)

| ID | Requirement Area | Sprint 01 Scope | Implementation Details | Status |
|----|------------------|-----------------|------------------------|--------|
| R01 | Multi-Tenant Architecture | Strict Tenant/Company data isolation | Server-side `companyId` filtering on all queries | IMPLEMENTED + VERIFIED |
| R02 | Multi-Plant Architecture | Plant Master linked to Company, timezone, status | `Plant` table, APIs, UI screen | IMPLEMENTED + VERIFIED |
| R03 | Department Architecture | Department Master linked to Plant | `Department` table, APIs, UI screen | IMPLEMENTED + VERIFIED |
| R04 | User Management | Secure auth, hashed passwords, tenant access | `User`, `UserPlantAccess`, `UserDepartmentAccess` | IMPLEMENTED + VERIFIED |
| R05 | Configurable RBAC | Roles, Permissions, UserRole, RolePermission mapping | `Role`, `Permission` dynamic assignment | IMPLEMENTED + VERIFIED |
| R06 | Authentication & Sessions | JWT login, logout, password hashing, session revocation | `/api/v1/auth/*` REST endpoints & session revoke | IMPLEMENTED + VERIFIED |
| R07 | Plant & Department Security | Server-side plant/department boundary enforcement | Isolation middleware checking request scope | IMPLEMENTED + VERIFIED |
| R08 | Audit Trail & Record History | Central audit service & record timeline API | `AuditLog` table & `GET /foundation/history/*` | IMPLEMENTED + VERIFIED |
| R09 | No Destructive Delete | Soft deactivation/reversal with mandatory reason | Server-side delete block, status transition | IMPLEMENTED + VERIFIED |
| R10 | Reversal Permission Approval | Authorized reversal requiring explicit `*:reverse` permission | Server-side RBAC check on reversal actions | IMPLEMENTED + VERIFIED |
| R11 | 5-Minute Inactivity Auto Lock | Auto lock screen after 5 minutes of inactivity | Client inactivity hook & password re-auth | IMPLEMENTED + VERIFIED |
| R12 | Voice Input Foundation | Speech-to-text input component for mobile data entry | `VoiceInput` UI component using Web Speech API | FOUNDATION ONLY |
| R13 | QR / Barcode Foundation | Camera stream QR & Barcode scanning reader | `QRScanner` UI component using MediaDevices | FOUNDATION ONLY |
| R14 | Offline Queue & Sync | Sync queue manager and connectivity badge | Offline sync queue & retry mechanism | FOUNDATION ONLY |
| R15 | Rate Limiting & Security | Request rate limiting & security event logging | Rate limiter middleware & security audit events | IMPLEMENTED + VERIFIED |
| R16 | Database Backup Strategy | Automated database snapshot/backup script | Database backup documentation & utility | FOUNDATION ONLY |
| R17 | Responsive UI Foundation | Mobile, Tablet, Laptop, Mobile layout | React + Vite + Tailwind CSS responsive shell | IMPLEMENTED + VERIFIED |
| R18 | Multi-User Concurrency | Concurrent user access without data corruption | Database transaction safety & optimistic locks | IMPLEMENTED + VERIFIED |
| R19 | Purchase to Stock Flow | Purchase Requisition, PO, Gate Entry, GRN, QA, Stock | Implemented in Sprint 02 baseline | IMPLEMENTED + VERIFIED (Sprint 02) |
| R20 | Bill of Materials (BOM) | Multi-level BOM structures, versioning, scrap factors | `BomHeader`, `BomComponent`, REST APIs, BOM UI | IMPLEMENTED + VERIFIED (Sprint 03) |
| R21 | Work Order Lifecycle | Draft -> Released -> Material Reserved -> In Process -> Completed / Cancelled | `WorkOrder`, automated material requirement calculation, state machine | IMPLEMENTED + VERIFIED (Sprint 03) |
| R22 | Material Reservation | Automatic calculation from active BOM, plant/warehouse link | `MaterialReservation`, calculation engine | IMPLEMENTED + VERIFIED (Sprint 03) |
| R23 | Material Issue | Stock consumption against WO, stock deduction, negative stock prevention | `MaterialIssue`, atomic `StockBalance` update, `StockTransaction` ledger | IMPLEMENTED + VERIFIED (Sprint 03) |
| R24 | Production Execution | Shift production execution, operator, line, quantity reconciliation | `ProductionExecution`, `Executed = Good + Rejected + Hold` validation | IMPLEMENTED + VERIFIED (Sprint 03) |
| R25 | Production Receipt | FG Stock receipt posting ONLY for good/accepted production | `ProductionReceipt`, atomic FG stock addition, exclusion of rejected/hold qty | IMPLEMENTED + VERIFIED (Sprint 03) |
| R26 | Finished Goods Inventory | Real-time FG stock balances and transaction ledger | `StockBalance`, `StockTransaction`, FG Stock UI | IMPLEMENTED + VERIFIED (Sprint 03) |
| R27 | Integration Contracts | Explicit transaction references & outbox events | `TransactionReference`, `EventOutbox` for WO release, material issue, prod completion | IMPLEMENTED + VERIFIED (Sprint 03) |
