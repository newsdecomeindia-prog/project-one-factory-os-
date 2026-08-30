"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const companyRoutes_1 = __importDefault(require("./routes/companyRoutes"));
const plantRoutes_1 = __importDefault(require("./routes/plantRoutes"));
const departmentRoutes_1 = __importDefault(require("./routes/departmentRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const roleRoutes_1 = __importDefault(require("./routes/roleRoutes"));
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
const foundationRoutes_1 = __importDefault(require("./routes/foundationRoutes"));
const bomRoutes_1 = __importDefault(require("./routes/bomRoutes"));
const workOrderRoutes_1 = __importDefault(require("./routes/workOrderRoutes"));
const materialIssueRoutes_1 = __importDefault(require("./routes/materialIssueRoutes"));
const productionExecutionRoutes_1 = __importDefault(require("./routes/productionExecutionRoutes"));
const productionReceiptRoutes_1 = __importDefault(require("./routes/productionReceiptRoutes"));
const productionReportRoutes_1 = __importDefault(require("./routes/productionReportRoutes"));
const ipqcRoutes_1 = __importDefault(require("./routes/ipqcRoutes"));
const ncrRoutes_1 = __importDefault(require("./routes/ncrRoutes"));
const stockTransferRoutes_1 = __importDefault(require("./routes/stockTransferRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const salesRoutes_1 = __importDefault(require("./routes/salesRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(auth_1.correlationMiddleware);
app.use((0, auth_1.rateLimiter)(200, 60 * 1000)); // Rate limit 200 req/min
// API Routes
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1/companies', companyRoutes_1.default);
app.use('/api/v1/plants', plantRoutes_1.default);
app.use('/api/v1/departments', departmentRoutes_1.default);
app.use('/api/v1/users', userRoutes_1.default);
app.use('/api/v1/roles', roleRoutes_1.default);
app.use('/api/v1/audit-logs', auditRoutes_1.default);
app.use('/api/v1/foundation', foundationRoutes_1.default);
// Sprint 03 Production Golden Flow Routes
app.use('/api/v1/boms', bomRoutes_1.default);
app.use('/api/v1/work-orders', workOrderRoutes_1.default);
app.use('/api/v1/material-issues', materialIssueRoutes_1.default);
app.use('/api/v1/production-executions', productionExecutionRoutes_1.default);
app.use('/api/v1/production-receipts', productionReceiptRoutes_1.default);
app.use('/api/v1/production-reports', productionReportRoutes_1.default);
// Sprint 04 Routes
app.use('/api/v1/ipqc', ipqcRoutes_1.default);
app.use('/api/v1/ncr', ncrRoutes_1.default);
app.use('/api/v1/stock-transfers', stockTransferRoutes_1.default);
// Sprint 05 Sales & Demand Management Routes
app.use('/api/v1/customers', customerRoutes_1.default);
app.use('/api/v1/sales', salesRoutes_1.default);
// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', system: 'Project ONE Factory OS Foundation', timestamp: new Date() });
});
// Centralized Error Handling
app.use(errorHandler_1.errorHandler);
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`[PROJECT ONE] Backend running on port ${PORT}`);
    });
}
exports.default = app;
