import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(30),
    email: z.string().email(),
    password: z.string().min(6),
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    deviceIdentifier: z.string().optional(),
    deviceType: z.string().optional(),
    os: z.string().optional(),
    browser: z.string().optional()
  })
});

export const verify2FASchema = z.object({
  body: z.object({
    token: z.string().min(6).max(6), // The PIN typed by User
    userId: z.string().nonempty()   // Received after partial login
  })
});
