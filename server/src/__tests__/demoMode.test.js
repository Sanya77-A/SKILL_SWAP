import request from "supertest";

const managedKeys = [
  "NODE_ENV", "DATABASE_MODE", "MONGO_URI", "VERCEL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET",
  "CLIENT_URL", "ANALYTICS_SALT", "AUTH_EXPOSE_ACCESS_TOKEN",
];
const ORIGIN = "https://skillswap-nine-jet.vercel.app";

describe("explicit read-only demo database mode", () => {
  const originalEnvironment = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
  let handler;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      DATABASE_MODE: "demo",
      VERCEL: "1",
      JWT_ACCESS_SECRET: "test-demo-access-secret-value-1234567890",
      JWT_REFRESH_SECRET: "test-demo-refresh-secret-value-0987654321",
      CLIENT_URL: ORIGIN,
      ANALYTICS_SALT: "test-demo-analytics-salt-value-1234567890",
      AUTH_EXPOSE_ACCESS_TOKEN: "false",
    });
    delete process.env.MONGO_URI;
    ({ default: handler } = await import(`../../../api/index.js?demo-mode=${Date.now()}`));
  });

  afterAll(() => {
    for (const key of managedKeys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  });

  test("boots through the Vercel entry without MongoDB", async () => {
    const response = await request(handler).get("/api/index?__path=health").expect(200);
    expect(response.body.data).toMatchObject({ status: "ok", database: "demo", databaseMode: "demo", persistence: false });
  });

  test("normal registration and login never fake persistence", async () => {
    const registration = await request(handler)
      .post("/api/index?__path=auth/register")
      .set("Origin", ORIGIN)
      .send({ name: "Not Persisted", email: "not-persisted@example.invalid", password: "password123" })
      .expect(503);
    expect(registration.body.error.code).toBe("PERSISTENCE_UNAVAILABLE");

    const login = await request(handler)
      .post("/api/index?__path=auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "not-persisted@example.invalid", password: "password123" })
      .expect(503);
    expect(login.body.error.code).toBe("PERSISTENCE_UNAVAILABLE");
  });

  test("serves a short-lived demo dashboard and deterministic marketplace", async () => {
    const login = await request(handler).post("/api/index?__path=demo/login").set("Origin", ORIGIN).send({ role: "user" }).expect(200);
    expect(login.body).toMatchObject({ demo: true, persistence: false });
    expect(login.headers["set-cookie"].join(";")).toMatch(/demoSession=.*HttpOnly/);
    const cookies = login.headers["set-cookie"];

    const me = await request(handler).get("/api/index?__path=demo/me").set("Cookie", cookies).expect(200);
    expect(me.body.user).toMatchObject({ _id: "demo-user", isDemo: true, role: "user" });

    const dashboard = await request(handler).get("/api/index?__path=demo/dashboard").set("Cookie", cookies).expect(200);
    expect(dashboard.body.data).toMatchObject({ demo: true, persistence: false });
    expect(dashboard.body.data.recommendations.length).toBeGreaterThan(0);
    expect(dashboard.body.data.nextBooking.isDemo).toBe(true);
    expect(dashboard.body.data.wallet.isDemo).toBe(true);

    const explore = await request(handler).get("/api/index?__path=demo/explore&q=Python").set("Cookie", cookies).expect(200);
    expect(explore.body.data.demo).toBe(true);
    expect(explore.body.data.mentors.some((mentor) => mentor.skillsOffered.includes("Python"))).toBe(true);
    const mentorId = explore.body.data.sections.topMentors[0]._id;
    const mentor = await request(handler).get(`/api/index?__path=demo/mentors/${mentorId}`).set("Cookie", cookies).expect(200);
    expect(mentor.body.data.mentor).toMatchObject({ _id: mentorId, isDemo: true });
  });

  test("demo admin cannot reach destructive production administration", async () => {
    const login = await request(handler).post("/api/index?__path=demo/login").set("Origin", ORIGIN).send({ role: "admin" }).expect(200);
    expect(login.body.user.role).toBe("demo_admin");
    const mutation = await request(handler)
      .patch("/api/index?__path=admin/users/demo-user/block")
      .set("Origin", ORIGIN)
      .set("Cookie", login.headers["set-cookie"])
      .send({})
      .expect(503);
    expect(mutation.body.error.code).toBe("PERSISTENCE_UNAVAILABLE");
  });
});
