import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("POST /api/auth/register", () => {
  it("creates a new user and returns a JWT token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "newuser@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.email).toBe("newuser@example.com");
  });

  it("rejects a duplicate email with 409", async () => {
    const creds = { email: "dupe@example.com", password: "password123" };
    await request(app).post("/api/auth/register").send(creds);

    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it("rejects a password shorter than 8 characters with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "abc123" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid email format with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
  });

  it("rejects a missing password field with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "missing@example.com" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a JWT token with valid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", password: "password123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.email).toBe("login@example.com");
  });

  it("rejects a wrong password with 401", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "wrongpass@example.com", password: "password123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrongpass@example.com", password: "wrongpassword1" });

    expect(res.status).toBe(401);
    // Same message as unknown-user — avoids user enumeration
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("returns the same error message for wrong password and unknown user (no enumeration)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "enum@example.com", password: "password123" });

    const wrongPass = await request(app)
      .post("/api/auth/login")
      .send({ email: "enum@example.com", password: "wrongpassword1" });

    const unknownUser = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody2@example.com", password: "password123" });

    expect(wrongPass.body.error).toBe(unknownUser.body.error);
  });
});
