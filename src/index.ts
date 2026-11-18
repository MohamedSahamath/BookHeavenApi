import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import { connectDatabase } from './config/database';
import { errorHandler, notFound } from './middleware/errorHandler';
import { checkDelayedDeliveries } from './services/delivery.service';
import * as paymentController from './controllers/payment.controller';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import managerRoutes from './routes/manager.routes';
import bookRoutes from './routes/book.routes';
import authorRoutes from './routes/author.routes';
import categoryRoutes from './routes/category.routes';
import supplierRoutes from './routes/supplier.routes';
import inventoryRoutes from './routes/inventory.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import deliveryRoutes from './routes/delivery.routes';
import complaintRoutes from './routes/complaint.routes';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/report.routes';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: CLIENT_URL.split(',').map((url) => url.trim()), // only our frontend may call the API
    credentials: true, // allow the refresh-token cookie
  })
);

app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), paymentController.webhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'BookHaven API is running', version: '1.0.0' });
});
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'OK', time: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/manager', managerRoutes);
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/authors', authorRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => console.log(`🚀 BookHaven API running on port ${PORT}`));

    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(() => {
      checkDelayedDeliveries()
        .then((count) => count > 0 && console.log(`⏰ ${count} delayed order(s) notified`))
        .catch((err) => console.error('Delay check failed:', err.message));
    }, ONE_HOUR);
  } catch (error) {
    console.error('❌ Failed to start server:', (error as Error).message);
    process.exit(1);
  }
};

start();

export default app;