import { Types } from 'mongoose';
import { Cart, ICart } from '../models/cart.model';
import { Book, IBook, getSellingPrice } from '../models/book.model';
import { ApiError } from '../utils/apiError';
import { calculateDeliveryCharge } from '../utils/constants';
import { getStockForBook, getStockMap } from './inventory.service';

const getOrCreateCart = async (userId: string): Promise<ICart> => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

export const buildCartSummary = async (userId: string) => {
  const cart = await getOrCreateCart(userId);
  const bookIds = cart.items.map((i) => i.book);

  const books = await Book.find({ _id: { $in: bookIds }, isActive: true }).populate('authors', 'name');
  const bookMap = new Map<string, IBook>(books.map((b) => [b._id.toString(), b]));
  const stockMap = await getStockMap(bookIds);

  const items = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const book = bookMap.get(item.book.toString());
    if (!book) continue; 

    const stock = stockMap.get(book._id.toString())?.quantity || 0;
    const unitPrice = getSellingPrice(book);
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    items.push({
      bookId: book._id,
      title: book.title,
      isbn: book.isbn,
      coverImage: book.coverImage,
      authorNames: (book.authors as unknown as { name: string }[]).map((a) => a.name),
      price: book.price,
      unitPrice,
      unitCost: book.purchaseCost,
      quantity: item.quantity,
      stock,
      lineTotal,
      isAvailable: stock >= item.quantity,
    });
  }

  const deliveryCharge = calculateDeliveryCharge(subtotal);
  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    hasStockProblems: items.some((i) => !i.isAvailable),
  };
};

export const addToCart = async (userId: string, bookId: string, quantity: number) => {
  const book = await Book.findById(bookId);
  if (!book || !book.isActive) throw new ApiError(404, 'Book not found');

  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((i) => i.book.toString() === bookId);
  const newQuantity = (existing ? existing.quantity : 0) + quantity;

  const stock = await getStockForBook(bookId);
  if (stock === 0) throw new ApiError(409, 'This book is out of stock');
  if (newQuantity > stock) throw new ApiError(409, `Only ${stock} copies available`);

  if (existing) existing.quantity = newQuantity;
  else cart.items.push({ book: new Types.ObjectId(bookId), quantity });

  await cart.save();
  return buildCartSummary(userId);
};

export const updateCartItem = async (userId: string, bookId: string, quantity: number) => {
  const cart = await getOrCreateCart(userId);
  const item = cart.items.find((i) => i.book.toString() === bookId);
  if (!item) throw new ApiError(404, 'Book is not in your cart');

  const stock = await getStockForBook(bookId);
  if (quantity > stock) throw new ApiError(409, `Only ${stock} copies available`);

  item.quantity = quantity;
  await cart.save();
  return buildCartSummary(userId);
};

export const removeCartItem = async (userId: string, bookId: string) => {
  await Cart.updateOne({ user: userId }, { $pull: { items: { book: bookId } } });
  return buildCartSummary(userId);
};

export const clearCart = async (userId: string) => {
  await Cart.updateOne({ user: userId }, { items: [] });
};