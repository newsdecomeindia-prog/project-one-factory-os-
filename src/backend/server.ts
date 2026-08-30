import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { correlationMiddleware, rateLimiter } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import companyRoutes from './routes/companyRoutes';
import plantRoutes from './routes/plantRoutes';
import departmentRoutes from './routes/departmentRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import auditRoutes from './routes/auditRoutes';
import foundationRoutes from './routes/foundationRoutes';
import bomRoutes from './routes/bomRoutes';
import workOrderRoutes from './routes/workOrderRoutes';
import materialIssueRoutes from './routes/materialIssueRoutes';
import productionExecutionRoutes from './routes/productionExecutionRoutes';
import productionReceiptRoutes from './routes/productionReceiptRoutes';
import productionReportRoutes from './routes/productionReportRoutes';
import ipqcRoutes from './routes/ipqcRoutes';
import ncrRoutes from './routes/ncrRoutes';
import stockTransferRoutes from './routes/stockTransferRoutes';
import customerRoutes from './routes/customerRoutes';
import salesRoutes from './routes/salesRoutes';
import { dispatchRoutes } from './routes/dispatchRoutes';
import { invoiceRoutes } from './routes/invoiceRoutes';
import { gateOutRoutes } from './routes/gateOutRoutes';
import { financeRoutes } from './routes/financeRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationMiddleware);
app.use(rateLimiter(200, 60 * 1000)); // Rate limit 200 req/min

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/plants', plantRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/foundation', foundationRoutes);

// Sprint 03 Production Golden Flow Routes
app.use('/api/v1/boms', bomRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/material-issues', materialIssueRoutes);
app.use('/api/v1/production-executions', productionExecutionRoutes);
app.use('/api/v1/production-receipts', productionReceiptRoutes);
app.use('/api/v1/production-reports', productionReportRoutes);

// Sprint 04 Routes
app.use('/api/v1/ipqc', ipqcRoutes);
app.use('/api/v1/ncr', ncrRoutes);
app.use('/api/v1/stock-transfers', stockTransferRoutes);

// Sprint 05 Sales & Demand Management Routes
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/sales', salesRoutes);

// Sprint 06 Dispatch, Sales Invoicing, Gate Out & Finance Routes
app.use('/api/v1/sales/dispatches', dispatchRoutes);
app.use('/api/v1/sales/invoices', invoiceRoutes);
app.use('/api/v1/sales/gate-out', gateOutRoutes);
app.use('/api/v1/finance', financeRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'Project ONE Factory OS Foundation', timestamp: new Date() });
});

// Centralized Error Handling
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[PROJECT ONE] Backend running on port ${PORT}`);
  });
}

export default app;
