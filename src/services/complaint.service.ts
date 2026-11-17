import { Types } from 'mongoose';
import { Complaint } from '../models/complaint.model';
import { Order } from '../models/order.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { ComplaintStatus, ComplaintType, JwtPayload } from '../types';
import { isOrderDelayed } from './delivery.service';
import { notifyUser, notifyRoles } from './notification.service';
import { sendEmail, emailTemplate } from '../utils/email';

const isStaff = (user: JwtPayload) => user.role === 'ADMIN' || user.role === 'MANAGER';

export const createComplaint = async (
  userId: string,
  data: { orderId: string; type: ComplaintType; subject: string; description: string }
) => {
  const order = await Order.findOne({ _id: data.orderId, customer: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status === 'PAYMENT_PENDING') {
    throw new ApiError(400, 'You can only complain about paid orders');
  }

  if (data.type === 'DELIVERY_DELAY') {
    const deliveredLate =
      order.deliveredAt && order.expectedDeliveryDate && order.deliveredAt > order.expectedDeliveryDate;
    if (!isOrderDelayed(order) && !deliveredLate) {
      throw new ApiError(400, 'This order is still within the 5-day delivery period');
    }
  }

  const complaint = await Complaint.create({
    complaintNumber: `CMP-${Date.now()}`,
    customer: userId,
    order: order._id,
    type: data.type,
    subject: data.subject,
    description: data.description,
    status: 'SUBMITTED',
    statusHistory: [{ status: 'SUBMITTED', changedAt: new Date(), changedBy: new Types.ObjectId(userId) }],
  });

  await notifyRoles(['MANAGER', 'ADMIN'], 'New complaint', `${complaint.complaintNumber}: ${data.subject} (order ${order.orderNumber})`, 'COMPLAINT', '/manager/complaints');
  return complaint;
};

export const getMyComplaints = async (userId: string, page: number, limit: number, skip: number) => {
  const filter = { customer: userId };
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).populate('order', 'orderNumber status').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);
  return { complaints, total, page, limit };
};

export const getComplaintById = async (id: string, user: JwtPayload) => {
  const complaint = await Complaint.findById(id)
    .populate('customer', 'fullName email phone')
    .populate('order', 'orderNumber status totalAmount items expectedDeliveryDate deliveredAt createdAt')
    .populate('responses.responder', 'fullName role');
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  const ownerId = (complaint.customer as unknown as { _id: Types.ObjectId })._id.toString();
  if (!isStaff(user) && ownerId !== user.id) {
    throw new ApiError(403, 'You can only view your own complaints');
  }
  return complaint;
};

export const listComplaints = async (
  query: { status?: string; type?: string; search?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ complaintNumber: regex }, { subject: regex }];
  }

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate('customer', 'fullName email')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Complaint.countDocuments(filter),
  ]);
  return { complaints, total, page, limit };
};

export const updateComplaintStatus = async (id: string, status: ComplaintStatus, note: string | undefined, staff: JwtPayload) => {
  const staffId = staff.id;
  const complaint = await Complaint.findById(id);
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  if (['RESOLVED', 'REJECTED'].includes(complaint.status)) {
    throw new ApiError(400, 'This complaint is already closed');
  }

  complaint.status = status;
  complaint.statusHistory.push({ status, changedAt: new Date(), changedBy: new Types.ObjectId(staffId), note });
  if (status === 'RESOLVED' || status === 'REJECTED') complaint.resolvedAt = new Date();
  if (note) {
    complaint.responses.push({ responder: new Types.ObjectId(staffId), responderRole: staff.role, message: note, createdAt: new Date() });
  }
  await complaint.save();

  await notifyUser(complaint.customer, 'Complaint update', `Your complaint ${complaint.complaintNumber} is now ${status.replace('_', ' ')}.`, 'COMPLAINT', `/complaints/${complaint._id}`);

  const customer = await User.findById(complaint.customer);
  if (customer) {
    await sendEmail(
      customer.email,
      `Complaint ${complaint.complaintNumber} updated`,
      emailTemplate('Complaint update', `<p>Status: <b>${status}</b></p>${note ? `<p>${note}</p>` : ''}`)
    );
  }
  return complaint;
};

export const addResponse = async (id: string, user: JwtPayload, message: string) => {
  const complaint = await Complaint.findById(id);
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  const staff = isStaff(user);
  if (!staff && complaint.customer.toString() !== user.id) {
    throw new ApiError(403, 'You can only reply to your own complaints');
  }
  if (['RESOLVED', 'REJECTED'].includes(complaint.status)) {
    throw new ApiError(400, 'This complaint is closed');
  }

  complaint.responses.push({ responder: new Types.ObjectId(user.id), responderRole: user.role, message, createdAt: new Date() });

  if (staff && complaint.status === 'SUBMITTED') {
    complaint.status = 'UNDER_REVIEW';
    complaint.statusHistory.push({ status: 'UNDER_REVIEW', changedAt: new Date(), changedBy: new Types.ObjectId(user.id) });
  }
  await complaint.save();

  if (staff) {
    await notifyUser(complaint.customer, 'New reply to your complaint', `BookHaven replied to ${complaint.complaintNumber}.`, 'COMPLAINT', `/complaints/${complaint._id}`);
  } else {
    await notifyRoles(['MANAGER'], 'Customer replied', `New customer reply on ${complaint.complaintNumber}.`, 'COMPLAINT', '/manager/complaints');
  }

  return getComplaintById(id, user);
};

export const getComplaintStats = async () => {
  const [submitted, underReview, resolved, rejected] = await Promise.all([
    Complaint.countDocuments({ status: 'SUBMITTED' }),
    Complaint.countDocuments({ status: 'UNDER_REVIEW' }),
    Complaint.countDocuments({ status: 'RESOLVED' }),
    Complaint.countDocuments({ status: 'REJECTED' }),
  ]);
  return { submitted, underReview, resolved, rejected, open: submitted + underReview };
};