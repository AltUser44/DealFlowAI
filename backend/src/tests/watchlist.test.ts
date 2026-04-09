import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { Company } from "../models/Company.js";

async function registerAndGetToken(email: string, password = "password123"): Promise<string> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password });
  return res.body.token as string;
}

describe("GET /api/watchlist", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/watchlist");
    expect(res.status).toBe(401);
  });

  it("returns an empty watchlist for a new user", async () => {
    const token = await registerAndGetToken("empty@example.com");
    const res = await request(app)
      .get("/api/watchlist")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.watchlist).toEqual([]);
    expect(res.body.companies).toEqual([]);
  });
});

describe("POST /api/watchlist", () => {
  it("adds a symbol and uppercases it", async () => {
    const token = await registerAndGetToken("add@example.com");
    const res = await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "aapl" });

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe("AAPL");
  });

  it("the added symbol appears in GET /api/watchlist", async () => {
    const token = await registerAndGetToken("addget@example.com");
    await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "MSFT" });

    const list = await request(app)
      .get("/api/watchlist")
      .set("Authorization", `Bearer ${token}`);

    expect(list.body.watchlist).toContain("MSFT");
  });

  it("does not add duplicate symbols ($addToSet behaviour)", async () => {
    const token = await registerAndGetToken("dedup@example.com");
    await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "TSLA" });
    await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "TSLA" });

    const list = await request(app)
      .get("/api/watchlist")
      .set("Authorization", `Bearer ${token}`);

    const count = list.body.watchlist.filter((s: string) => s === "TSLA").length;
    expect(count).toBe(1);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/watchlist")
      .send({ symbol: "NVDA" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/watchlist/:symbol", () => {
  it("removes a symbol from the watchlist", async () => {
    const token = await registerAndGetToken("del@example.com");
    await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "GOOG" });

    const del = await request(app)
      .delete("/api/watchlist/GOOG")
      .set("Authorization", `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.symbol).toBe("GOOG");

    const list = await request(app)
      .get("/api/watchlist")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.watchlist).not.toContain("GOOG");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).delete("/api/watchlist/GOOG");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/watchlist/scenario", () => {
  it("returns recomputed scores for watchlist companies", async () => {
    const token = await registerAndGetToken("scenario@example.com");

    // Seed a company with known values
    await Company.create({
      symbol: "SCTEST",
      name: "Scenario Test Corp",
      growthRate: 0.2,
      profitMargin: 0.15,
      debtToEquity: 1.0,
      debtScore: 0.2,
      score: 0.065, // matches computeAcquisitionScore(0.2, 0.15, 0.2)
    });

    await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "SCTEST" });

    const res = await request(app)
      .post("/api/watchlist/scenario")
      .set("Authorization", `Bearer ${token}`)
      .send({ growthDelta: -0.05, marginDelta: 0, deDelta: 0 });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);

    const result = res.body.results[0];
    expect(result.symbol).toBe("SCTEST");
    // Lower growth → lower scenario score than base
    expect(result.scenarioScore).toBeLessThan(result.baseScore);
    // Delta should be negative
    expect(result.delta).toBeLessThan(0);
  });

  it("returns empty results when watchlist is empty", async () => {
    const token = await registerAndGetToken("emptysc@example.com");
    const res = await request(app)
      .post("/api/watchlist/scenario")
      .set("Authorization", `Bearer ${token}`)
      .send({ growthDelta: -0.1 });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/watchlist/scenario")
      .send({ growthDelta: -0.05 });
    expect(res.status).toBe(401);
  });

  it("echoes back the assumption deltas used", async () => {
    const token = await registerAndGetToken("assumptions@example.com");
    const res = await request(app)
      .post("/api/watchlist/scenario")
      .set("Authorization", `Bearer ${token}`)
      .send({ growthDelta: -0.05, marginDelta: 0.02, deDelta: 0.5 });

    expect(res.body.assumptions).toMatchObject({
      growthDelta: -0.05,
      marginDelta: 0.02,
      deDelta: 0.5,
    });
  });
});
