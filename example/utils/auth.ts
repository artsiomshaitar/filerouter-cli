import type { Middleware } from "filerouter-cli";

/**
 * Simulated login function
 */
export async function login(username: string, _password: string) {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 100));

  // For demo purposes, just return the username as name
  return {
    name: username,
    id: `user_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Check if user is authenticated
 * In a real app, this would check a token/session
 */
export function isAuthenticated(): boolean {
  // For demo, always return true
  // In a real app: check process.env.TOKEN or a config file
  return true;
}

/**
 * Authentication middleware
 * Throws an error if not authenticated
 */
export const authMiddleware: Middleware = async (_context, next) => {
  if (!isAuthenticated()) {
    throw new Error("Not authenticated. Please run: my-cli auth");
  }
  await next();
};
