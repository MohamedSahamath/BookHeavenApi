import { Types, FilterQuery } from 'mongoose';
import { Inventory, IInventory } from '../models/inventory.model';
import { StockMovement } from '../models/stockMovement.model';
import { Book } from '../models/book.model';
import { ApiError } from '../utils/apiError';
import { StockMovementType } from '../types';
import { notifyRoles } from './notification.service';
import { DEFAULT_LOW_STOCK_LEVEL } from '../utils/constants';

type Id = string | Types.ObjectId;

interface MovementMeta {
  reason?: string;
  order?: Id;
  supplierOrder?: Id;
  performedBy?: Id;
}

const checkLowStock = async (inventory: IInventory) => {
  const isLow = inventory.quantity <= inventory.lowStockLevel;

  if (isLow && !inventory.lowStockNotified) {
    const book = await Book.findById(inventory.book).select('title');
    const title = book ? book.title : 'A book';
    const message =
      inventory.quantity === 0
        ? `"${title}" is OUT OF STOCK.`
        : `"${title}" is running low (${inventory.quantity} left).`;
    await notifyRoles(['MANAGER', 'ADMIN'], 'Low stock warning', message, 'STOCK', '/manager/inventory');
    await Inventory.updateOne({ _id: inventory._id }, { lowStockNotified: true });
  } else if (!isLow && inventory.lowStockNotified) {
    await Inventory.updateOne({ _id: inventory._id }, { lowStockNotified: false });
  }
};

export const createInventoryForBook = async (
  bookId: Id,
  initialQuantity: number,
  lowStockLevel: number = DEFAULT_LOW_STOCK_LEVEL,
  performedBy?: Id
) => {
  const inventory = await Inventory.create({ book: bookId, quantity: initialQuantity, lowStockLevel });

  if (initialQuantity > 0) {
    await StockMovement.create({
      book: bookId,
      type: 'INITIAL',
      quantity: initialQuantity,
      previousQuantity: 0,
      newQuantity: initialQuantity,
      reason: 'Initial stock when book was added',
      performedBy,
    });
  }
  await checkLowStock(inventory);
  return inventory;
};

export const increaseStock = async (bookId: Id, quantity: number, type: StockMovementType, meta: MovementMeta = {}) => {
  if (quantity <= 0) throw new ApiError(400, 'Quantity must be greater than 0');

  const inventory = await Inventory.findOneAndUpdate(
    { book: bookId },
    { $inc: { quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!inventory) throw new ApiError(500, 'Could not update stock');

  await StockMovement.create({
    book: bookId,
    type,
    quantity,
    previousQuantity: inventory.quantity - quantity,
    newQuantity: inventory.quantity,
    ...meta,
  });

  await checkLowStock(inventory);
  return inventory;
};

export const decreaseStock = async (bookId: Id, quantity: number, type: StockMovementType, meta: MovementMeta = {}) => {
  if (quantity <= 0) throw new ApiError(400, 'Quantity must be greater than 0');

  const inventory = await Inventory.findOneAndUpdate(
    { book: bookId, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } },
    { new: true }
  );

  if (!inventory) {
    throw new ApiError(409, 'Not enough stock available');
  }

  await StockMovement.create({
    book: bookId,
    type,
    quantity: -quantity,
    previousQuantity: inventory.quantity + quantity,
    newQuantity: inventory.quantity,
    ...meta,
  });

  await checkLowStock(inventory);
  return inventory;
};

export const getStockMap = async (bookIds: Id[]) => {
  const inventories = await Inventory.find({ book: { $in: bookIds } }).select('book quantity lowStockLevel');
  const map = new Map<string, { quantity: number; lowStockLevel: number }>();
  inventories.forEach((inv) => {
    map.set(inv.book.toString(), { quantity: inv.quantity, lowStockLevel: inv.lowStockLevel });
  });
  return map;
};

export const getStockForBook = async (bookId: Id) => {
  const inventory = await Inventory.findOne({ book: bookId });
  return inventory ? inventory.quantity : 0;
};

export const listInventory = async (
  query: { search?: string; status?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: FilterQuery<IInventory> = {};

  if (query.search) {
    const safeText = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeText, 'i');
    const books = await Book.find({ $or: [{ title: regex }, { isbn: regex }] }).select('_id');
    filter.book = { $in: books.map((b) => b._id) };
  }

  if (query.status === 'OUT_OF_STOCK') filter.quantity = 0;
  if (query.status === 'LOW_STOCK') {
    filter.$expr = { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockLevel'] }] };
  }
  if (query.status === 'IN_STOCK') {
    filter.$expr = { $gt: ['$quantity', '$lowStockLevel'] };
  }

  const [items, total] = await Promise.all([
    Inventory.find(filter)
      .populate('book', 'title isbn coverImage price isActive')
      .sort({ quantity: 1 })
      .skip(skip)
      .limit(limit),
    Inventory.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

export const getLowStockItems = () =>
  Inventory.find({ $expr: { $lte: ['$quantity', '$lowStockLevel'] } })
    .populate('book', 'title isbn coverImage')
    .sort({ quantity: 1 });

export const adjustStock = async (
  bookId: string,
  type: 'ADD' | 'REMOVE',
  quantity: number,
  reason: string,
  userId: string
) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Book not found');

  if (type === 'ADD') {
    return increaseStock(bookId, quantity, 'MANUAL_ADD', { reason, performedBy: userId });
  }
  return decreaseStock(bookId, quantity, 'MANUAL_REMOVE', { reason, performedBy: userId });
};

export const updateLowStockLevel = async (bookId: string, lowStockLevel: number) => {
  const inventory = await Inventory.findOneAndUpdate({ book: bookId }, { lowStockLevel }, { new: true });
  if (!inventory) throw new ApiError(404, 'Inventory record not found');
  await checkLowStock(inventory);
  return inventory;
};

export const getMovements = async (
  query: { book?: string; type?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.book) filter.book = query.book;
  if (query.type) filter.type = query.type;

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('book', 'title isbn')
      .populate('performedBy', 'fullName role')
      .populate('order', 'orderNumber')
      .populate('supplierOrder', 'referenceNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  return { movements, total, page, limit };
};

// Numbers for dashboards
export const getInventorySummary = async () => {
  const [totals] = await Inventory.aggregate([
    {
      $group: {
        _id: null,
        totalStock: { $sum: '$quantity' },
        outOfStock: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } },
        lowStock: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockLevel'] }] }, 1, 0],
          },
        },
        inStock: { $sum: { $cond: [{ $gt: ['$quantity', '$lowStockLevel'] }, 1, 0] } },
      },
    },
  ]);
  return totals || { totalStock: 0, outOfStock: 0, lowStock: 0, inStock: 0 };
};