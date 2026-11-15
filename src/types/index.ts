import { Request } from 'express';

export type Role = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

export interface JwtPayload {
  id: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';

export type SupplierOrderStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'NOT_RECEIVED';

export type ComplaintStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type ComplaintType = 'DELIVERY_DELAY' | 'DAMAGED_BOOK' | 'WRONG_BOOK' | 'PAYMENT_ISSUE' | 'OTHER';

export type StockMovementType =
  | 'INITIAL'
  | 'SUPPLIER_DELIVERY'
  | 'MANUAL_ADD'
  | 'MANUAL_REMOVE'
  | 'SALE'
  | 'ORDER_CANCELLED';

export type ExpenseCategory =
  | 'SUPPLIER_PAYMENT'
  | 'DELIVERY'
  | 'SALARY'
  | 'RENT'
  | 'UTILITIES'
  | 'MARKETING'
  | 'OTHER';

export type NotificationType =
  | 'ORDER'
  | 'DELIVERY'
  | 'COMPLAINT'
  | 'STOCK'
  | 'SUPPLIER'
  | 'SYSTEM';

export interface PaginationQuery {
  page?: string;
  limit?: string;
}