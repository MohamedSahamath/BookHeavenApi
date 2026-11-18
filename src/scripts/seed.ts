import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { User } from '../models/user.model';
import { Category } from '../models/category.model';
import { Author } from '../models/author.model';
import { Book } from '../models/book.model';
import { Supplier } from '../models/supplier.model';
import { createInventoryForBook } from '../services/inventory.service';
import { slugify } from '../services/book.service';

const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

const categories = [
  { name: 'Fiction', description: 'Novels and classic literature' },
  { name: 'Fantasy', description: 'Magic, adventure and other worlds' },
  { name: 'Science', description: 'Popular science and discovery' },
  { name: 'History', description: 'The story of humanity' },
  { name: 'Self-Help', description: 'Personal growth and habits' },
  { name: 'Business', description: 'Money, careers and management' },
  { name: 'Technology', description: 'Programming and software engineering' },
  { name: 'Children', description: 'Books for young readers' },
];

const authors = [
  'Harper Lee', 'George Orwell', 'Jane Austen', 'F. Scott Fitzgerald', 'J.R.R. Tolkien', 'Paulo Coelho',
  'Stephen Hawking', 'Yuval Noah Harari', 'James Clear', 'Robert Kiyosaki', 'Robert C. Martin',
  'Andrew Hunt', 'David Thomas', 'E.B. White', 'J.K. Rowling',
];

const books = [
  { title: 'To Kill a Mockingbird', isbn: '9780061120084', authors: ['Harper Lee'], category: 'Fiction', price: 2450, cost: 1500, year: 1960, publisher: 'Harper Perennial', pages: 336, stock: 25, featured: true },
  { title: '1984', isbn: '9780451524935', authors: ['George Orwell'], category: 'Fiction', price: 1950, cost: 1150, year: 1949, publisher: 'Signet Classic', pages: 328, stock: 30, featured: true },
  { title: 'Animal Farm', isbn: '9780451526342', authors: ['George Orwell'], category: 'Fiction', price: 1450, cost: 850, year: 1945, publisher: 'Signet Classic', pages: 140, stock: 4, discount: 10 },
  { title: 'Pride and Prejudice', isbn: '9780141439518', authors: ['Jane Austen'], category: 'Fiction', price: 1650, cost: 950, year: 1813, publisher: 'Penguin Classics', pages: 480, stock: 18 },
  { title: 'The Great Gatsby', isbn: '9780743273565', authors: ['F. Scott Fitzgerald'], category: 'Fiction', price: 1850, cost: 1100, year: 1925, publisher: 'Scribner', pages: 180, stock: 0 },
  { title: 'The Hobbit', isbn: '9780547928227', authors: ['J.R.R. Tolkien'], category: 'Fantasy', price: 2950, cost: 1800, year: 1937, publisher: 'Mariner Books', pages: 300, stock: 22, featured: true },
  { title: 'The Lord of the Rings', isbn: '9780618640157', authors: ['J.R.R. Tolkien'], category: 'Fantasy', price: 6500, cost: 4200, year: 1954, publisher: 'Mariner Books', pages: 1216, stock: 8, discount: 15 },
  { title: "Harry Potter and the Sorcerer's Stone", isbn: '9780439708180', authors: ['J.K. Rowling'], category: 'Fantasy', price: 2750, cost: 1700, year: 1997, publisher: 'Scholastic', pages: 309, stock: 40, featured: true },
  { title: 'The Alchemist', isbn: '9780062315007', authors: ['Paulo Coelho'], category: 'Fiction', price: 2150, cost: 1300, year: 1988, publisher: 'HarperOne', pages: 208, stock: 35 },
  { title: 'A Brief History of Time', isbn: '9780553380163', authors: ['Stephen Hawking'], category: 'Science', price: 2850, cost: 1750, year: 1988, publisher: 'Bantam', pages: 212, stock: 12 },
  { title: 'Sapiens: A Brief History of Humankind', isbn: '9780062316097', authors: ['Yuval Noah Harari'], category: 'History', price: 3650, cost: 2300, year: 2011, publisher: 'Harper', pages: 464, stock: 20, featured: true },
  { title: 'Atomic Habits', isbn: '9780735211292', authors: ['James Clear'], category: 'Self-Help', price: 3250, cost: 2000, year: 2018, publisher: 'Avery', pages: 320, stock: 45, featured: true, discount: 10 },
  { title: 'Rich Dad Poor Dad', isbn: '9781612680194', authors: ['Robert Kiyosaki'], category: 'Business', price: 2350, cost: 1400, year: 1997, publisher: 'Plata Publishing', pages: 336, stock: 3 },
  { title: 'Clean Code', isbn: '9780132350884', authors: ['Robert C. Martin'], category: 'Technology', price: 5950, cost: 3900, year: 2008, publisher: 'Prentice Hall', pages: 464, stock: 10 },
  { title: 'The Pragmatic Programmer', isbn: '9780201616224', authors: ['Andrew Hunt', 'David Thomas'], category: 'Technology', price: 5450, cost: 3500, year: 1999, publisher: 'Addison-Wesley', pages: 352, stock: 9 },
  { title: "Charlotte's Web", isbn: '9780064400558', authors: ['E.B. White'], category: 'Children', price: 1350, cost: 800, year: 1952, publisher: 'HarperCollins', pages: 192, stock: 28 },
];

const description = (title: string, author: string, category: string) =>
  `${title} by ${author} is one of the most loved ${category.toLowerCase()} titles in the BookHaven collection. ` +
  'A great choice for readers of all levels, delivered to your doorstep anywhere in Sri Lanka within 5 days.';

const run = async () => {
  await connectDatabase();

  // 1) Admin 
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bookhaven.lk').toLowerCase();
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      fullName: process.env.ADMIN_NAME || 'BookHaven Admin',
      email: adminEmail,
      phone: process.env.ADMIN_PHONE || '0771234567',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'ADMIN',
    });
    console.log(`👑 Admin created: ${adminEmail}`);
  } else {
    console.log('👑 Admin already exists');
  }

  // 2) Demo manager + customer
  if (!(await User.findOne({ email: 'manager@bookhaven.lk' }))) {
    await User.create({ fullName: 'Nimal Perera', email: 'manager@bookhaven.lk', phone: '0712345678', password: 'Manager@123', role: 'MANAGER' });
    console.log('🧑‍💼 Manager created: manager@bookhaven.lk / Manager@123');
  }
  if (!(await User.findOne({ email: 'customer@bookhaven.lk' }))) {
    await User.create({
      fullName: 'Kasun Silva',
      email: 'customer@bookhaven.lk',
      phone: '0761234567',
      password: 'Customer@123',
      role: 'CUSTOMER',
      addresses: [{ label: 'Home', recipientName: 'Kasun Silva', phone: '0761234567', addressLine1: '45 Temple Road', city: 'Kandy', district: 'Kandy', postalCode: '20000', isDefault: true }],
    });
    console.log('🙂 Customer created: customer@bookhaven.lk / Customer@123');
  }

  // 3) Catalog (only if there are no books yet)
  if ((await Book.countDocuments()) > 0) {
    console.log('📚 Books already exist - catalog seeding skipped');
  } else {
    const categoryMap = new Map<string, mongoose.Types.ObjectId>();
    for (const c of categories) {
      const doc = await Category.findOneAndUpdate(
        { slug: slugify(c.name) },
        { ...c, slug: slugify(c.name) },
        { upsert: true, new: true }
      );
      categoryMap.set(c.name, doc!._id);
    }

    const authorMap = new Map<string, mongoose.Types.ObjectId>();
    for (const name of authors) {
      const doc = await Author.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
      authorMap.set(name, doc!._id);
    }

    for (const b of books) {
      const book = await Book.create({
        title: b.title,
        isbn: b.isbn,
        description: description(b.title, b.authors.join(' & '), b.category),
        authors: b.authors.map((a) => authorMap.get(a)),
        category: categoryMap.get(b.category),
        price: b.price,
        purchaseCost: b.cost,
        discountPercent: b.discount || 0,
        coverImage: cover(b.isbn),
        publisher: b.publisher,
        publicationYear: b.year,
        pages: b.pages,
        language: 'English',
        isFeatured: Boolean(b.featured),
      });
      await createInventoryForBook(book._id, b.stock, 5, admin._id);
    }
    console.log(`📚 ${books.length} books, ${categories.length} categories and ${authors.length} authors created`);
  }

  // 4) Suppliers
  if ((await Supplier.countDocuments()) === 0) {
    await Supplier.create([
      { name: 'Lanka Book Distributors', contactPerson: 'Sunil Fernando', email: 'orders@lankabooks.lk', phone: '0112345678', address: { street: '120 Main Street', city: 'Colombo 11', district: 'Colombo', postalCode: '01100' } },
      { name: 'Island Publishers', contactPerson: 'Dilani Jayasinghe', email: 'sales@islandpub.lk', phone: '0812233445', address: { street: '8 Peradeniya Road', city: 'Kandy', district: 'Kandy', postalCode: '20000' } },
    ]);
    console.log('🚚 2 suppliers created');
  }

  console.log('✅ Seeding finished');
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('❌ Seeding failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});