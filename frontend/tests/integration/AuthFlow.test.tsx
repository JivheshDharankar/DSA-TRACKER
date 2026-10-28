import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '../../src/pages/LoginPage';
import { RegisterPage } from '../../src/pages/RegisterPage';
import { ProtectedRoute } from '../../src/components/common/ProtectedRoute';
import { GuestRoute } from '../../src/components/common/GuestRoute';
import * as authApi from '../../src/api/auth.api';
import { AuthProvider } from '../../src/context/AuthContext';
import { createMockUser } from '../fixtures/user.fixture';

vi.mock('../../src/api/auth.api', () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
}));

describe('Frontend Authentication Boundary & Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LoginPage', () => {
    it('renders login form elements and links to register', async () => {
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome Back');
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /create one now/i })).toHaveAttribute('href', '/register');
    });

    it('validates that email and password are required', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      const submitBtn = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitBtn);

      // In LoginPage, if user submits empty fields
      await waitFor(() => {
        expect(authApi.loginUser).not.toHaveBeenCalled();
      });
    });

    it('submits valid credentials and navigates on success', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser({ email: 'developer@example.com' });
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.loginUser).mockResolvedValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/email address/i), 'developer@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'securePassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(authApi.loginUser).toHaveBeenCalledWith({
          email: 'developer@example.com',
          password: 'securePassword123!',
        });
        expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
      });
    });

    it('displays error banner when login credentials fail', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.loginUser).mockRejectedValue({
        message: 'Invalid email or password.',
        code: 'AUTH_FAILED',
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'wrongPassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
      });
    });
  });

  describe('RegisterPage', () => {
    it('validates name length < 2 characters', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/full name/i), 'A');
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /get started/i }));

      expect(screen.getByText('Name must be at least 2 characters long.')).toBeInTheDocument();
      expect(authApi.registerUser).not.toHaveBeenCalled();
    });

    it('validates password length < 8 characters', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace');
      await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');

      await user.click(screen.getByRole('button', { name: /get started/i }));

      expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument();
      expect(authApi.registerUser).not.toHaveBeenCalled();
    });

    it('validates passwords match', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace');
      await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'longpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword123');

      await user.click(screen.getByRole('button', { name: /get started/i }));

      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
      expect(authApi.registerUser).not.toHaveBeenCalled();
    });

    it('submits valid registration and redirects to dashboard', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser({ name: 'Alan Turing', email: 'alan@example.com' });
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.registerUser).mockResolvedValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/full name/i), 'Alan Turing');
      await user.type(screen.getByLabelText(/email address/i), 'alan@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'turingMachine123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'turingMachine123!');

      await user.click(screen.getByRole('button', { name: /get started/i }));

      await waitFor(() => {
        expect(authApi.registerUser).toHaveBeenCalledWith({
          name: 'Alan Turing',
          email: 'alan@example.com',
          password: 'turingMachine123!',
        });
        expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
      });
    });
  });

  describe('ProtectedRoute', () => {
    it('renders child routes when user is authenticated', async () => {
      vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(createMockUser());

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/protected" element={<div>Secret Protected Content</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Secret Protected Content')).toBeInTheDocument();
      });
    });

    it('redirects unauthenticated user to /login', async () => {
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('No token'));

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/protected" element={<div>Secret Protected Content</div>} />
              </Route>
              <Route path="/login" element={<div>Login Page Form</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page Form')).toBeInTheDocument();
        expect(screen.queryByText('Secret Protected Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('GuestRoute', () => {
    it('renders guest route for unauthenticated user', async () => {
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('No session'));

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<div>Guest Login Page</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Guest Login Page')).toBeInTheDocument();
      });
    });

    it('redirects already authenticated user away from guest route to /dashboard', async () => {
      vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(createMockUser());

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<div>Guest Login Page</div>} />
              </Route>
              <Route path="/dashboard" element={<div>User Dashboard</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('User Dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Guest Login Page')).not.toBeInTheDocument();
      });
    });
  });

  describe('Auth mutation failures through the real route tree', () => {
    it('keeps the login page mounted and shows the error alert when login fails through GuestRoute', async () => {
      const user = userEvent.setup();
      let rejectLogin!: (reason?: unknown) => void;
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.loginUser).mockImplementation(
        () =>
          new Promise<never>((_resolve, reject) => {
            rejectLogin = reject;
          })
      );

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const loginEmail = await screen.findByLabelText(/email address/i);
      await user.type(loginEmail, 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'wrongPassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // In-flight: the guest page must stay mounted while the request is pending.
      expect(await screen.findByRole('button', { name: /authenticating/i })).toBeDisabled();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome Back');
      expect(authApi.loginUser).toHaveBeenCalledWith({
        email: 'wrong@example.com',
        password: 'wrongPassword123!',
      });

      await act(async () => {
        rejectLogin({ message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
      });

      // Mount proof: remounting would have cleared the entered values.
      expect(screen.getByLabelText(/email address/i)).toHaveValue('wrong@example.com');
      expect(screen.getByLabelText(/^password/i)).toHaveValue('wrongPassword123!');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome Back');
      expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();

      const submit = screen.getByRole('button', { name: /sign in/i });
      expect(submit).toBeEnabled();
      expect(submit).not.toHaveAttribute('aria-busy');
    });

    it('keeps the register page mounted and shows the fallback error when the server rejects registration through GuestRoute', async () => {
      const user = userEvent.setup();
      let rejectRegister!: (reason?: unknown) => void;
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.registerUser).mockImplementation(
        () =>
          new Promise<never>((_resolve, reject) => {
            rejectRegister = reject;
          })
      );

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const registerName = await screen.findByLabelText(/full name/i);
      await user.type(registerName, 'Ada Lovelace');
      await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'longpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'longpassword123');
      await user.click(screen.getByRole('button', { name: /get started/i }));

      // The request is actually issued (not blocked by client-side validation).
      expect(await screen.findByRole('button', { name: /creating account/i })).toBeDisabled();
      expect(authApi.registerUser).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'longpassword123',
      });
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Create Account');

      // A rejection with no usable `message` is what produces the page's own fallback copy.
      await act(async () => {
        rejectRegister({ status: 500 });
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Registration failed. Please try again.');
      });

      expect(screen.getByLabelText(/full name/i)).toHaveValue('Ada Lovelace');
      expect(screen.getByLabelText(/email address/i)).toHaveValue('ada@example.com');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Create Account');
      expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();

      const submit = screen.getByRole('button', { name: /get started/i });
      expect(submit).toBeEnabled();
      expect(submit).not.toHaveAttribute('aria-busy');
    });

    it('surfaces the backend duplicate-email message when registration is rejected through GuestRoute', async () => {
      const user = userEvent.setup();
      let rejectRegister!: (reason?: unknown) => void;
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.registerUser).mockImplementation(
        () =>
          new Promise<never>((_resolve, reject) => {
            rejectRegister = reject;
          })
      );

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const registerName = await screen.findByLabelText(/full name/i);
      await user.type(registerName, 'Ada Lovelace');
      await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'longpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'longpassword123');
      await user.click(screen.getByRole('button', { name: /get started/i }));

      expect(await screen.findByRole('button', { name: /creating account/i })).toBeDisabled();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Create Account');

      await act(async () => {
        rejectRegister({
          message: 'An account with this email address already exists.',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'An account with this email address already exists.'
        );
      });

      expect(screen.getByLabelText(/email address/i)).toHaveValue('ada@example.com');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Create Account');
      expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();

      const submit = screen.getByRole('button', { name: /get started/i });
      expect(submit).toBeEnabled();
      expect(submit).not.toHaveAttribute('aria-busy');
    });

    it('still reaches the dashboard through GuestRoute after a successful login', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('Unauthenticated'));
      vi.mocked(authApi.loginUser).mockResolvedValue(
        createMockUser({ email: 'developer@example.com' })
      );

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const loginEmail = await screen.findByLabelText(/email address/i);
      await user.type(loginEmail, 'developer@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'securePassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });
  });
});
