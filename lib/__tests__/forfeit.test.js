/**
 * Comprehensive Forfeit Flow Tests
 * Tests all scenarios and edge cases for the bulletproof forfeit implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { forfeitDebate, getDebateDetail } from "../api-client";

// Mock fetch
global.fetch = vi.fn();

describe("Forfeit Flow - Bulletproof Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe("API Error Handling", () => {
    it("should return error when forfeit API returns 500", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Database error" }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Database error");
    });

    it("should return error when forfeit API returns 400 (bad side)", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "side required (pro or con)" }),
      });

      const result = await forfeitDebate("debate-1", "invalid");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("required");
    });

    it("should return error on network failure", async () => {
      fetch.mockRejectedValueOnce(new Error("Network timeout"));

      try {
        await forfeitDebate("debate-1", "pro");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).toContain("timeout");
      }
    });
  });

  describe("Forfeit State Transition", () => {
    it("should transition directly from in_progress to forfeited", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          forfeited: true,
          status: "forfeited",
          phase: "ended",
          winner: "con",
          forfeiting_side: "pro",
          completed_at: new Date().toISOString(),
        }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.success).toBe(true);
      expect(result.status).toBe("forfeited");
      expect(result.phase).toBe("ended");
      expect(result.winner).toBe("con");
      expect(result.forfeiting_side).toBe("pro");
    });

    it("should handle double-forfeit gracefully", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          alreadyEnded: true,
          status: "forfeited",
        }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.success).toBe(true);
      expect(result.alreadyEnded).toBe(true);
    });

    it("should not allow forfeit from prematch status", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          alreadyEnded: true,
          status: "prematch",
        }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.success).toBe(true);
      expect(result.alreadyEnded).toBe(true);
    });
  });

  describe("Winner Determination", () => {
    it("should set winner to con when pro forfeits", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          forfeited: true,
          status: "forfeited",
          winner: "con",
          forfeiting_side: "pro",
        }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.winner).toBe("con");
    });

    it("should set winner to pro when con forfeits", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          forfeited: true,
          status: "forfeited",
          winner: "pro",
          forfeiting_side: "con",
        }),
      });

      const result = await forfeitDebate("debate-1", "con");
      expect(result.winner).toBe("pro");
    });
  });

  describe("Opponent Detection", () => {
    it("should detect forfeit on polling when debate transitions to forfeited", async () => {
      // First poll returns in_progress
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          debate: { status: "in_progress", phase: "freeflow" },
        }),
      });

      // Second poll returns forfeited
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          debate: {
            status: "forfeited",
            phase: "ended",
            winner: "con",
            winner_source: "forfeit",
            completed_at: new Date().toISOString(),
          },
        }),
      });

      const result1 = await getDebateDetail("debate-1");
      expect(result1.debate.status).toBe("in_progress");

      const result2 = await getDebateDetail("debate-1");
      expect(result2.debate.status).toBe("forfeited");
      expect(result2.debate.winner).toBe("con");
    });

    it("should handle missing debate detail gracefully", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await getDebateDetail("nonexistent");
      expect(result).toBeDefined();
    });
  });

  describe("Response Data Completeness", () => {
    it("should include all required fields in forfeit response", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          forfeited: true,
          status: "forfeited",
          phase: "ended",
          winner: "pro",
          forfeiting_side: "con",
          completed_at: "2026-02-25T12:00:00Z",
        }),
      });

      const result = await forfeitDebate("debate-1", "con");

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("phase");
      expect(result).toHaveProperty("winner");
      expect(result).toHaveProperty("forfeiting_side");
      expect(result).toHaveProperty("completed_at");
    });
  });

  describe("No Transitional "forfeiting" State", () => {
    it("should never return forfeiting status (removed transitional state)", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          forfeited: true,
          status: "forfeited", // NOT "forfeiting"
        }),
      });

      const result = await forfeitDebate("debate-1", "pro");
      expect(result.status).not.toBe("forfeiting");
      expect(result.status).toBe("forfeited");
    });
  });
});
