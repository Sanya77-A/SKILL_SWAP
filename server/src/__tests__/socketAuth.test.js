import { authenticateSocket } from "../socket/index.js";

describe("Socket authentication", () => {
  test("rejects a socket without credentials", async () => {
    const socket = { handshake: { auth: {}, headers: {} } };
    let result;
    await authenticateSocket(socket, (error) => { result = error; });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Authentication required");
  });

  test("rejects a socket with an invalid JWT", async () => {
    const socket = { handshake: { auth: { token: "not-a-jwt" }, headers: {} } };
    let result;
    await authenticateSocket(socket, (error) => { result = error; });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Invalid token");
  });
});
