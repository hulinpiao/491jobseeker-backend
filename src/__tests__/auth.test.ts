import request from 'supertest';
import app from '../index';
import { connectDatabase, disconnectDatabase } from '../config/database';
import User from '../models/User';

/**
 * Auth API Integration Tests
 */
describe('Auth API', () => {
  beforeAll(async () => {
    await connectDatabase();
  }, 30000);

  afterAll(async () => {
    await disconnectDatabase();
  }, 30000);

  beforeEach(async () => {
    // Clean up users collection before each test
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', validUser.email);
      expect(response.body.data.user).toHaveProperty('emailVerified', false);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      expect(response.body.data).toHaveProperty('message');
    });

    it('should not store password in plain text', async () => {
      await request(app).post('/api/auth/register').send(validUser);

      const user = await User.findOne({ email: validUser.email }).select('+passwordHash');
      expect(user).toBeTruthy();
      expect(user?.passwordHash).not.toBe(validUser.password);
      expect(user?.passwordHash).toHaveLength(60); // bcrypt hash length
    });

    it('should return error for duplicate email', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(validUser);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'EMAIL_ALREADY_EXISTS');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should verify email with correct code', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(validUser);

      // Get the user with verification code
      const user = await User.findOne({ email: validUser.email })
        .select('+verificationCode');

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: user?.verificationCode,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user).toHaveProperty('emailVerified', true);
    });

    it('should return error for invalid code', async () => {
      await request(app).post('/api/auth/register').send(validUser);

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'INVALID_CODE');
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'nonexistent@example.com',
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'USER_NOT_FOUND');
    });

    it('should validate code format (6 digits)', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: '12345',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    beforeEach(async () => {
      // Register and verify user
      await request(app).post('/api/auth/register').send(validUser);
      const user = await User.findOne({ email: validUser.email })
        .select('+verificationCode');
      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: user?.verificationCode,
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(validUser);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', validUser.email);
      expect(response.body.data.user).toHaveProperty('emailVerified', true);
    });

    it('should return error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: validUser.password,
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should return error for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should not allow login without email verification', async () => {
      // Create unverified user
      const unverifiedUser = {
        email: 'unverified@example.com',
        password: 'Password123!',
      };
      await request(app).post('/api/auth/register').send(unverifiedUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(unverifiedUser);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'EMAIL_NOT_VERIFIED');
    });

    it('should return a valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(validUser);

      const token = response.body.data.token;
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify token structure (JWT has 3 parts separated by dots)
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });
  });

  describe('GET /api/auth/me', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    let authToken: string;

    beforeEach(async () => {
      // Register, verify, and login
      await request(app).post('/api/auth/register').send(validUser);
      const user = await User.findOne({ email: validUser.email })
        .select('+verificationCode');
      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: user?.verificationCode,
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(validUser);
      authToken = loginResponse.body.data.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user).toHaveProperty('email', validUser.email);
      expect(response.body.data.user).toHaveProperty('emailVerified', true);
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return error with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authToken); // Missing 'Bearer' prefix

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return success message for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should resend verification code', async () => {
      await request(app).post('/api/auth/register').send(validUser);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: validUser.email });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('message');
    });

    it('should return error for already verified email', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const user = await User.findOne({ email: validUser.email })
        .select('+verificationCode');
      await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: validUser.email,
          code: user?.verificationCode,
        });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: validUser.email });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'EMAIL_ALREADY_VERIFIED');
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'USER_NOT_FOUND');
    });
  });

  describe('Auth Flow Integration Test', () => {
    it('should complete full auth flow: register -> verify -> login -> get profile', async () => {
      const userData = {
        email: 'flowtest@example.com',
        password: 'Password123!',
      };

      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.user.emailVerified).toBe(false);

      // Step 2: Get verification code from DB (in real flow, user gets email)
      const user = await User.findOne({ email: userData.email })
        .select('+verificationCode');

      // Step 3: Verify email
      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: userData.email,
          code: user?.verificationCode,
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.user.emailVerified).toBe(true);

      // Step 4: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.token).toBeTruthy();

      const token = loginResponse.body.data.token;

      // Step 5: Access protected route
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.email).toBe(userData.email);
    });
  });
});
