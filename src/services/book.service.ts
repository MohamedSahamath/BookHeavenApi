
import { FilterQuery, Types } from 'mongoose';
import { Book, IBook, getSellingPrice } from '../models/book.model';
import { Author } from '../models/author.model';
import { Category } from '../models/category.model';
import { Inventory } from '../models/inventory.model';
import { StockMovement } from '../models/stockMovement.model';
import { Order } from '../models/order.model';
import { ApiError } from '../utils/apiError';
import { uploadImage } from '../config/cloudinary';
import { createInventoryForBook, getStockMap } from './inventory.service';

//Helpers 
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseAuthors = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {

    }
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
};

const toBool = (value: unknown): boolean => value === true || value === 'true';

export const attachStock = async (books: IBook[]) => {
  const stockMap = await getStockMap(books.map((b) => b._id));
  return books.map((book) => {
    const stockInfo = stockMap.get(book._id.toString()) || { quantity: 0, lowStockLevel: 0 };
    const stock = stockInfo.quantity;
    return {
      ...book.toObject(),
      stock,
      lowStockLevel: stockInfo.lowStockLevel,
      sellingPrice: getSellingPrice(book),
      availability: stock === 0 ? 'OUT_OF_STOCK' : stock <= stockInfo.lowStockLevel ? 'LOW_STOCK' : 'IN_STOCK',
    };
  });
};

//Books
export interface BookListQuery {
  search?: string;
  category?: string;
  author?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  featured?: string;
  sort?: string;
  includeInactive?: boolean;
}

export const listBooks = async (query: BookListQuery, page: number, limit: number, skip: number) => {
  const filter: FilterQuery<IBook> = {};
  if (!query.includeInactive) filter.isActive = true;

  if (query.search && query.search.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    const [authors, categories] = await Promise.all([
      Author.find({ name: regex }).select('_id'),
      Category.find({ name: regex }).select('_id'),
    ]);
    filter.$or = [
      { title: regex },
      { isbn: regex },
      { authors: { $in: authors.map((a) => a._id) } },
      { category: { $in: categories.map((c) => c._id) } },
    ];
  }

  if (query.category && Types.ObjectId.isValid(query.category)) filter.category = query.category;
  if (query.author && Types.ObjectId.isValid(query.author)) filter.authors = query.author;
  if (query.featured === 'true') filter.isFeatured = true;

  if (query.minPrice || query.maxPrice) {
    const priceFilter: { $gte?: number; $lte?: number } = {};
    if (query.minPrice) priceFilter.$gte = Number(query.minPrice);
    if (query.maxPrice) priceFilter.$lte = Number(query.maxPrice);
    filter.price = priceFilter;
  }

  if (query.inStock === 'true') {
    const inStock = await Inventory.find({ quantity: { $gt: 0 } }).select('book');
    filter._id = { $in: inStock.map((i) => i.book) };
  }

  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    popular: { soldCount: -1, viewCount: -1 },
    title: { title: 1 },
  };
  const sort = sortOptions[query.sort || 'newest'] || sortOptions.newest;

  const [books, total] = await Promise.all([
    Book.find(filter)
      .populate('authors', 'name')
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Book.countDocuments(filter),
  ]);

  return { books: await attachStock(books), total, page, limit };
};

export const getBookById = async (bookId: string, options: { countView?: boolean } = {}) => {
  const book = await Book.findById(bookId)
    .populate('authors', 'name biography nationality')
    .populate('category', 'name slug');
  if (!book) throw new ApiError(404, 'Book not found');

  if (options.countView) {
    await Book.updateOne({ _id: bookId }, { $inc: { viewCount: 1 } });
  }

  const [withStock] = await attachStock([book]);
  return withStock;
};

export const getHomeData = async () => {
  const active = { isActive: true };
  const populate = [
    { path: 'authors', select: 'name' },
    { path: 'category', select: 'name slug' },
  ];

  const [featured, latest, bestSellers, popular, offers, categories, authors] = await Promise.all([
    Book.find({ ...active, isFeatured: true }).populate(populate).limit(8),
    Book.find(active).populate(populate).sort({ createdAt: -1 }).limit(8),
    Book.find({ ...active, soldCount: { $gt: 0 } }).populate(populate).sort({ soldCount: -1 }).limit(8),
    Book.find(active).populate(populate).sort({ viewCount: -1 }).limit(8),
    Book.find({ ...active, discountPercent: { $gt: 0 } }).populate(populate).sort({ discountPercent: -1 }).limit(8),
    getCategoriesWithCounts(),
    Author.find({ isActive: true }).sort({ name: 1 }).limit(12),
  ]);

  return {
    featured: await attachStock(featured),
    latest: await attachStock(latest),
    bestSellers: await attachStock(bestSellers),
    popular: await attachStock(popular),
    offers: await attachStock(offers),
    categories,
    authors,
  };
};

interface BookInput {
  title?: string;
  isbn?: string;
  description?: string;
  authors?: unknown;
  category?: string;
  price?: string | number;
  discountPercent?: string | number;
  purchaseCost?: string | number;
  coverImageUrl?: string;
  publisher?: string;
  publicationYear?: string | number;
  language?: string;
  pages?: string | number;
  isFeatured?: unknown;
  isActive?: unknown;
  initialStock?: string | number;
  lowStockLevel?: string | number;
}

const buildBookFields = (data: BookInput): Partial<IBook> => {
  const fields: Record<string, unknown> = {};
  if (data.title !== undefined) fields.title = data.title;
  if (data.isbn !== undefined) fields.isbn = String(data.isbn).replace(/-/g, '');
  if (data.description !== undefined) fields.description = data.description;
  if (data.category !== undefined) fields.category = data.category;
  if (data.price !== undefined) fields.price = Number(data.price);
  if (data.discountPercent !== undefined) fields.discountPercent = Number(data.discountPercent) || 0;
  if (data.purchaseCost !== undefined) fields.purchaseCost = Number(data.purchaseCost);
  if (data.publisher !== undefined) fields.publisher = data.publisher;
  if (data.publicationYear) fields.publicationYear = Number(data.publicationYear);
  if (data.language !== undefined) fields.language = data.language;
  if (data.pages) fields.pages = Number(data.pages);
  if (data.isFeatured !== undefined) fields.isFeatured = toBool(data.isFeatured);
  if (data.isActive !== undefined) fields.isActive = toBool(data.isActive);
  if (data.coverImageUrl) fields.coverImage = data.coverImageUrl;
  if (data.authors !== undefined) fields.authors = parseAuthors(data.authors);
  return fields as Partial<IBook>;
};

const checkCatalogLinks = async (fields: Partial<IBook>) => {
  if (fields.category) {
    const category = await Category.findById(fields.category);
    if (!category) throw new ApiError(400, 'Category not found');
  }
  if (fields.authors) {
    if (fields.authors.length === 0) throw new ApiError(400, 'At least one author is required');
    const count = await Author.countDocuments({ _id: { $in: fields.authors } });
    if (count !== fields.authors.length) throw new ApiError(400, 'One or more authors were not found');
  }
};

export const createBook = async (
  data: BookInput,
  file: Express.Multer.File | undefined,
  baseUrl: string,
  userId: string
) => {
  const fields = buildBookFields(data);
  await checkCatalogLinks(fields);

  if (file) fields.coverImage = await uploadImage(file, baseUrl);

  const book = await Book.create(fields);

  await createInventoryForBook(
    book._id,
    Number(data.initialStock) || 0,
    data.lowStockLevel !== undefined ? Number(data.lowStockLevel) : undefined,
    userId
  );

  return getBookById(book._id.toString());
};

export const updateBook = async (
  bookId: string,
  data: BookInput,
  file: Express.Multer.File | undefined,
  baseUrl: string
) => {
  const fields = buildBookFields(data);
  await checkCatalogLinks(fields);
  if (file) fields.coverImage = await uploadImage(file, baseUrl);

  const book = await Book.findByIdAndUpdate(bookId, fields, { new: true, runValidators: true });
  if (!book) throw new ApiError(404, 'Book not found');

  if (data.lowStockLevel !== undefined) {
    await Inventory.updateOne({ book: bookId }, { lowStockLevel: Number(data.lowStockLevel) });
  }
  return getBookById(bookId);
};

export const deleteBook = async (bookId: string) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Book not found');

  const [orderCount, movementCount] = await Promise.all([
    Order.countDocuments({ 'items.book': bookId }),
    StockMovement.countDocuments({ book: bookId, type: { $ne: 'INITIAL' } }),
  ]);

  if (orderCount > 0 || movementCount > 0) {
    book.isActive = false;
    await book.save();
    return { softDeleted: true, message: 'Book has order or stock history, so it was deactivated instead of deleted' };
  }

  await Promise.all([
    Book.deleteOne({ _id: bookId }),
    Inventory.deleteOne({ book: bookId }),
    StockMovement.deleteMany({ book: bookId }),
  ]);
  return { softDeleted: false, message: 'Book deleted' };
};

//Categories
export const getCategoriesWithCounts = async () => {
  const [categories, counts] = await Promise.all([
    Category.find({ isActive: true }).sort({ name: 1 }),
    Book.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c: { _id: Types.ObjectId; count: number }) => [c._id.toString(), c.count]));
  return categories.map((c) => ({ ...c.toObject(), bookCount: countMap.get(c._id.toString()) || 0 }));
};

export const listAllCategories = () => Category.find().sort({ name: 1 });

export const createCategory = (data: { name: string; description?: string }) =>
  Category.create({ name: data.name, description: data.description, slug: slugify(data.name) });

export const updateCategory = async (id: string, data: { name?: string; description?: string; isActive?: boolean }) => {
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name);
  const category = await Category.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
};

export const deleteCategory = async (id: string) => {
  const used = await Book.countDocuments({ category: id });
  if (used > 0) throw new ApiError(409, `Cannot delete: ${used} book(s) use this category. Deactivate it instead.`);
  const result = await Category.findByIdAndDelete(id);
  if (!result) throw new ApiError(404, 'Category not found');
};

//Authors
export const listAuthors = async (search: string | undefined, page: number, limit: number, skip: number) => {
  const filter: Record<string, unknown> = {};
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');

  const [authors, total, counts] = await Promise.all([
    Author.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Author.countDocuments(filter),
    Book.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$authors' },
      { $group: { _id: '$authors', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(counts.map((c: { _id: Types.ObjectId; count: number }) => [c._id.toString(), c.count]));
  return {
    authors: authors.map((a) => ({ ...a.toObject(), bookCount: countMap.get(a._id.toString()) || 0 })),
    total,
    page,
    limit,
  };
};

export const getAuthorById = async (id: string) => {
  const author = await Author.findById(id);
  if (!author) throw new ApiError(404, 'Author not found');
  return author;
};

export const createAuthor = (data: { name: string; biography?: string; nationality?: string; photoUrl?: string }) =>
  Author.create(data);

export const updateAuthor = async (id: string, data: Record<string, unknown>) => {
  const author = await Author.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!author) throw new ApiError(404, 'Author not found');
  return author;
};

export const deleteAuthor = async (id: string) => {
  const used = await Book.countDocuments({ authors: id });
  if (used > 0) throw new ApiError(409, `Cannot delete: this author is linked to ${used} book(s).`);
  const result = await Author.findByIdAndDelete(id);
  if (!result) throw new ApiError(404, 'Author not found');
};