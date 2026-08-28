# PROJECT ONE — Manufacturing Factory Operating System
## Master Blueprint & Sprint 01 Specification

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

1. **Role-Based Permissions**: Action codes follow `<entity>:<action>` format (e.g., `company:reverse`, `plant:deactivate`, `user:manage`).
2. **Reversal Approvals**: Reversal and cancellation actions (`actionType: 'REVERSED'`) strictly enforce `*:reverse` permission codes.
3. **5-Minute Auto Session Lock**:
   - The application tracks user inactivity (mouse movement, keypress, touch events).
   - After 5 minutes (300,000 ms) of inactivity, the UI activates a lock overlay requiring password re-authentication.
   - Unlocking triggers a `SECURITY_UNLOCK` audit log entry.

---

### 4. Database Strategy

- **Development Database**: SQLite (`file:./dev.db`)
- **Production Database**: PostgreSQL (Prisma schema designed with PostgreSQL dialect compatibility for standard types, primary key UUIDs, indexes, and relations)

---

### 5. Mobile, Voice, QR & Offline Foundations

- **Responsive Web UI**: Built with Tailwind CSS supporting mobile (<640px), tablet (640px - 1024px), laptop (1024px - 1280px), and ultra-wide screens.
- **Voice Input Foundation (`VoiceInput`)**: Speech-to-text conversion for hands-free floor input.
- **QR Scanner Foundation (`QRScanner`)**: Camera stream barcode/QR code reader.
- **Offline Sync Queue**: Client-side queue capturing pending mutations when offline and syncing automatically upon reconnection.
