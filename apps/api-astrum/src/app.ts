import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import corsOptions from './middlewares/corsOptions';
import cookieParser from 'cookie-parser';
import proxyOptions from './common/helpers/proxyOptions';
import authenticateToken from './middlewares/authenticateToken';
import userRoutes from './modules/user/user.routes';
import productRoutes from './modules/product/product.routes';
import wishlistRoutes from './modules/wishlist/wishlist.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes from './modules/order/order.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';

const app: Express = express();

app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(morgan('dev'));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use('/api/auth', proxyOptions(process.env.AUTH_SERVICE_URL!));

app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }),
);
app.use(cookieParser());

app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/wishlist', authenticateToken, wishlistRoutes);
app.use('/api/cart', authenticateToken, cartRoutes);
app.use('/api/orders', authenticateToken, orderRoutes);
app.use('/api/reviews', authenticateToken, reviewsRouter);

app.get('/', (_req, res) => {
  res.send('Astrum backend is running...');
});

export default app;
