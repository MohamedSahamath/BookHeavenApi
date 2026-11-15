import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { sendError } from '../utils/response';
import { SRI_LANKA_DISTRICTS } from '../utils/constants';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((e) => ({
      field: e.type === 'field' ? e.path : 'unknown',
      message: e.msg,
    }));
    return sendError(res, errors[0].message, 422, errors);
  }
  next();
};

// Reusable small rules
const phoneRule = (field: string) =>
  body(field).trim().matches(/^0\d{9}$/).withMessage('Mobile number must be 10 digits starting with 0');

const passwordRule = (field: string) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/\d/)
    .withMessage('Password must contain a number');

export const mongoIdParam = (name = 'id') => [param(name).isMongoId().withMessage(`Invalid ${name}`), validate];

// ---------- AUTH ----------
export const registerRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  phoneRule('phone'),
  passwordRule('password'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  validate,
];

export const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

export const forgotPasswordRules = [
  body('identifier').trim().notEmpty().withMessage('Email or mobile number is required'),
  validate,
];

export const resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token is required'),
  passwordRule('password'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  validate,
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordRule('newPassword'),
  validate,
];

export const updateProfileRules = [
  body('fullName').optional().trim().notEmpty().isLength({ max: 100 }),
  validate,
];

export const contactChangeRules = [
  body('type').isIn(['EMAIL', 'PHONE']).withMessage('Type must be EMAIL or PHONE'),
  body('value').trim().notEmpty().withMessage('New value is required'),
  validate,
];

export const addressRules = [
  body('recipientName').trim().notEmpty().withMessage('Recipient name is required'),
  phoneRule('phone'),
  body('addressLine1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('district').isIn(SRI_LANKA_DISTRICTS).withMessage('Select a valid district'),
  body('postalCode').trim().matches(/^\d{5}$/).withMessage('Postal code must be 5 digits'),
  validate,
];

// ---------- ADMIN: managers ----------
export const managerCreateRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  phoneRule('phone'),
  passwordRule('password'),
  validate,
];

export const managerUpdateRules = [
  body('fullName').optional().trim().notEmpty(),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().matches(/^0\d{9}$/).withMessage('Invalid mobile number'),
  validate,
];

export const expenseRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category')
    .isIn(['DELIVERY', 'SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'OTHER'])
    .withMessage('Invalid expense category'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('expenseDate').optional().isISO8601().withMessage('Invalid date'),
  validate,
];

// ---------- CATALOG ----------
export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 60 }),
  validate,
];

export const authorRules = [
  body('name').trim().notEmpty().withMessage('Author name is required').isLength({ max: 100 }),
  validate,
];

// Book data may arrive as multipart/form-data (with a cover image), so numbers come as strings
export const bookRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('isbn').trim().matches(/^(\d{10}|\d{13})$/).withMessage('ISBN must be 10 or 13 digits'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').isMongoId().withMessage('Select a valid category'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('purchaseCost').isFloat({ min: 0 }).withMessage('Purchase cost must be a positive number'),
  body('initialStock').optional().isInt({ min: 0 }).withMessage('Initial stock must be 0 or more'),
  body('lowStockLevel').optional().isInt({ min: 0 }).withMessage('Low stock level must be 0 or more'),
  body('discountPercent').optional().isFloat({ min: 0, max: 90 }).withMessage('Discount must be 0-90%'),
  validate,
];

// ---------- SUPPLIERS ----------
export const supplierRules = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('contactPerson').trim().notEmpty().withMessage('Contact person is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  phoneRule('phone'),
  body('address.street').trim().notEmpty().withMessage('Street is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.district').trim().notEmpty().withMessage('District is required'),
  validate,
];

export const supplierOrderRules = [
  body('supplier').isMongoId().withMessage('Select a valid supplier'),
  body('book').isMongoId().withMessage('Select a valid book'),
  body('orderedQuantity').isInt({ min: 1 }).withMessage('Ordered quantity must be at least 1'),
  body('unitCost').isFloat({ min: 0 }).withMessage('Unit cost must be a positive number'),
  body('expectedDeliveryDate').isISO8601().withMessage('Expected delivery date is required'),
  validate,
];

export const receiveSupplierOrderRules = [
  body('receivedQuantity').isInt({ min: 1 }).withMessage('Received quantity must be at least 1'),
  validate,
];

// ---------- INVENTORY ----------
export const stockAdjustRules = [
  body('type').isIn(['ADD', 'REMOVE']).withMessage('Type must be ADD or REMOVE'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  validate,
];

// ---------- CART / CHECKOUT ----------
export const cartItemRules = [
  body('bookId').isMongoId().withMessage('Invalid book'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  validate,
];

export const cartQuantityRules = [
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  validate,
];

export const checkoutRules = [
  body('addressId').isMongoId().withMessage('Select a delivery address'),
  validate,
];

// ---------- ORDERS / DELIVERY ----------
export const orderStatusRules = [
  body('status').isIn(['PROCESSING', 'CANCELLED']).withMessage('Invalid status'),
  body('note').optional().trim(),
  validate,
];

export const deliveryUpdateRules = [
  body('status').isIn(['DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED']).withMessage('Invalid delivery status'),
  body('courierName').optional().trim(),
  body('trackingNumber').optional().trim(),
  validate,
];

// ---------- COMPLAINTS ----------
export const complaintRules = [
  body('orderId').isMongoId().withMessage('Select a valid order'),
  body('type')
    .isIn(['DELIVERY_DELAY', 'DAMAGED_BOOK', 'WRONG_BOOK', 'PAYMENT_ISSUE', 'OTHER'])
    .withMessage('Invalid complaint type'),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 150 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 3000 }),
  validate,
];

export const complaintStatusRules = [
  body('status').isIn(['UNDER_REVIEW', 'RESOLVED', 'REJECTED']).withMessage('Invalid status'),
  body('note').optional().trim(),
  validate,
];

export const complaintResponseRules = [
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }),
  validate,
];