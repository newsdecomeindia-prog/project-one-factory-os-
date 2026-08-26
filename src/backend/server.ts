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
