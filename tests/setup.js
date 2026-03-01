// ============================================================
// Vitest Global Setup
// ============================================================
// Stub environment variables and mocks used across all tests.
// ============================================================

// Provide default env vars so modules that read them at import time don't crash
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.JWT_SECRET = "test-jwt-secret-for-vitest";
process.env.NODE_ENV = "test";
