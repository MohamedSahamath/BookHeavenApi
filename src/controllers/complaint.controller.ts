import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as complaintService from '../services/complaint.service';

export const createComplaint = asyncHandler(async (req: AuthRequest, res) => {
  const { orderId, type, subject, description } = req.body;
  const complaint = await complaintService.createComplaint(req.user!.id, { orderId, type, subject, description });
  sendSuccess(res, complaint, 'Complaint submitted', 201);
});

export const getMyComplaints = asyncHandler(async (req: AuthRequest, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);
  const result = await complaintService.getMyComplaints(req.user!.id, page, limit, skip);
  sendSuccess(res, result.complaints, 'Complaints loaded', 200, buildPagination(page, limit, result.total));
});

export const getComplaint = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await complaintService.getComplaintById(req.params.id, req.user!), 'Complaint loaded');
});

export const getAllComplaints = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 15);
  const result = await complaintService.listComplaints(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.complaints, 'Complaints loaded', 200, buildPagination(page, limit, result.total));
});

export const updateStatus = asyncHandler(async (req: AuthRequest, res) => {
  const complaint = await complaintService.updateComplaintStatus(req.params.id, req.body.status, req.body.note, req.user!);
  sendSuccess(res, complaint, 'Complaint status updated');
});

export const addResponse = asyncHandler(async (req: AuthRequest, res) => {
  const complaint = await complaintService.addResponse(req.params.id, req.user!, req.body.message);
  sendSuccess(res, complaint, 'Reply sent', 201);
});