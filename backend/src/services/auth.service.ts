import { User, SafeUser } from '../models/User.model.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.util.js';
import { AppError } from '../middleware/error.middleware.js';
import { RegisterInput, LoginInput } from '../validators/auth.validator.js';

export interface AuthResult {
  user: SafeUser;
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new AppError(
        'An account with this email address already exists.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const passwordHash = await hashPassword(input.password);

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const token = generateToken({ userId: user._id.toString() });

    return {
      user: user.toJSON() as unknown as SafeUser,
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    if (!user) {
      // Intentionally uniform error to prevent account enumeration
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken({ userId: user._id.toString() });

    return {
      user: user.toJSON() as unknown as SafeUser,
      token,
    };
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }
    return user.toJSON() as unknown as SafeUser;
  }
}

export const authService = new AuthService();
