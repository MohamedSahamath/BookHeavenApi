import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as reportService from '../services/report.service';

export const getDashboard = asyncHandler(async (_req, res) => {
  sendSuccess(res, await reportService.getManagerDashboard(), 'Manager dashboard loaded');
});