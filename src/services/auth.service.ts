import crypto from 'crypto';
import { User, IUser, IAddress } from '../models/user.model';
import { PasswordResetToken } from '../models/passwordResetToken.model';
import { ApiError } from '../utils/apiError';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendEmail, sendSms, emailTemplate } from '../utils/email';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const issueTokens = async (user: IUser) => {
  const payload = { id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await User.updateOne(
    { _id: user._id },
    { refreshTokenHash: hashToken(refreshToken), lastLogin: new Date() }
  );

  return { accessToken, refreshToken };
};

export const registerCustomer = async (data: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) => {
  const existing = await User.findOne({ $or: [{ email: data.email }, { phone: data.phone }] });
  if (existing) {
    throw new ApiError(409, 'An account with this email or mobile number already exists');
  }

  const user = await User.create({ ...data, role: 'CUSTOMER' });

  await sendEmail(
    user.email,
    'Welcome to BookHaven',
    emailTemplate('Welcome!', `<p>Hi ${user.fullName}, your BookHaven account is ready. Happy reading!</p>`)
  );

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
  }

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

export const refreshTokens = async (refreshToken?: string) => {
  if (!refreshToken) throw new ApiError(401, 'No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Refresh token expired. Please log in again.');
  }

  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new ApiError(401, 'Invalid refresh token. Please log in again.');
  }

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

export const logout = async (userId: string) => {
  await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
};

// Forgot / Reset password 
export const forgotPassword = async (identifier: string) => {
  const value = identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: value }, { phone: value }] });


  if (!user || !user.isActive) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  await PasswordResetToken.deleteMany({ user: user._id }); // only one active link at a time
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  });

  const resetLink = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  await sendEmail(
    user.email,
    'Reset your BookHaven password',
    emailTemplate(
      'Password reset request',
      `<p>Click the button below to reset your password. This link expires in 15 minutes.</p>
       <p><a href="${resetLink}" style="background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset Password</a></p>
       <p>If you did not request this, you can ignore this email.</p>`
    )
  );
};

export const resetPassword = async (rawToken: string, newPassword: string) => {
  const tokenDoc = await PasswordResetToken.findOne({
    tokenHash: hashToken(rawToken),
    used: false,
    expiresAt: { $gt: new Date() },
  });
  if (!tokenDoc) throw new ApiError(400, 'Reset link is invalid or has expired');

  const user = await User.findById(tokenDoc.user);
  if (!user) throw new ApiError(404, 'User not found');

  user.password = newPassword; 
  user.refreshTokenHash = undefined; 
  await user.save();

  tokenDoc.used = true;
  await tokenDoc.save();
};

export const getProfile = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const updateProfile = async (userId: string, data: { fullName?: string }) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { fullName: data.fullName },
    { new: true, runValidators: true }
  );
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.password = newPassword;
  await user.save();
};

export const requestContactChange = async (userId: string, type: 'EMAIL' | 'PHONE', value: string) => {
  const newValue = type === 'EMAIL' ? value.trim().toLowerCase() : value.trim();

  if (type === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(newValue)) throw new ApiError(422, 'Invalid email');
  if (type === 'PHONE' && !/^0\d{9}$/.test(newValue)) throw new ApiError(422, 'Invalid mobile number');

  const field = type === 'EMAIL' ? 'email' : 'phone';
  const taken = await User.findOne({ [field]: newValue, _id: { $ne: userId } });
  if (taken) throw new ApiError(409, `This ${field} is already used by another account`);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await User.updateOne(
    { _id: userId },
    {
      pendingContact: {
        type,
        value: newValue,
        otpHash: hashToken(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    }
  );

  if (type === 'EMAIL') {
    await sendEmail(
      newValue,
      'Verify your new email',
      emailTemplate('Email verification', `<p>Your BookHaven verification code is <b style="font-size:20px">${otp}</b>. It expires in 10 minutes.</p>`)
    );
  } else {
    await sendSms(newValue, `Your BookHaven verification code is ${otp}`);
  }
};

// Step 2: check the OTP and save the new contact value
export const verifyContactChange = async (userId: string, otp: string) => {
  const user = await User.findById(userId);
  if (!user || !user.pendingContact || !user.pendingContact.otpHash) {
    throw new ApiError(400, 'No pending verification');
  }
  if (user.pendingContact.expiresAt < new Date()) throw new ApiError(400, 'Verification code expired');
  if (user.pendingContact.otpHash !== hashToken(otp)) throw new ApiError(400, 'Invalid verification code');

  if (user.pendingContact.type === 'EMAIL') user.email = user.pendingContact.value;
  else user.phone = user.pendingContact.value;

  user.pendingContact = undefined;
  await user.save();
  return user;
};

export const getAddresses = async (userId: string) => {
  const user = await getProfile(userId);
  return user.addresses;
};

export const addAddress = async (userId: string, data: IAddress) => {
  const user = await getProfile(userId);
  const makeDefault = data.isDefault || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push({ ...data, isDefault: makeDefault });
  await user.save();
  return user.addresses;
};

export const updateAddress = async (userId: string, addressId: string, data: Partial<IAddress>) => {
  const user = await getProfile(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw new ApiError(404, 'Address not found');

  if (data.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  address.set(data);
  await user.save();
  return user.addresses;
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const user = await getProfile(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw new ApiError(404, 'Address not found');

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length > 0) user.addresses[0].isDefault = true;
  await user.save();
  return user.addresses;
};