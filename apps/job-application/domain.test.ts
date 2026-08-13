import { describe, expect, it } from "vitest";
import { canTransition, extractUrl, newApplicationId, nextStatus, PIPELINE_ORDER, type JobStatus } from "./domain.js";

describe("state machine", () => {
  it("advances along the happy path to delivered", () => {
    let status: JobStatus = "received";
    const visited: JobStatus[] = [status];
    let next = nextStatus(status);
    while (next) {
      expect(canTransition(status, next)).toBe(true);
      status = next;
      visited.push(status);
      next = nextStatus(status);
    }
    expect(visited).toEqual([...PIPELINE_ORDER]);
    expect(status).toBe("delivered");
  });

  it("allows failing from any active state and retrying from failed", () => {
    expect(canTransition("analyzing", "failed")).toBe(true);
    expect(canTransition("generating", "failed")).toBe(true);
    expect(canTransition("failed", "analyzing")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("received", "delivered")).toBe(false);
    expect(canTransition("delivered", "analyzing")).toBe(false);
    expect(nextStatus("delivered")).toBeNull();
  });
});

describe("extractUrl", () => {
  it("finds the first URL in a message", () => {
    expect(extractUrl("check this https://jobs.example.com/123 please")).toBe("https://jobs.example.com/123");
    expect(extractUrl("http://a.co/x and http://b.co/y")).toBe("http://a.co/x");
  });

  it("returns null when there is no URL", () => {
    expect(extractUrl("hello there")).toBeNull();
    expect(extractUrl(undefined)).toBeNull();
    expect(extractUrl("")).toBeNull();
  });
});

describe("newApplicationId", () => {
  it("produces unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newApplicationId()));
    expect(ids.size).toBe(50);
  });
});
