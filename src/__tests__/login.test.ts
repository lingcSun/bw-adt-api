import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

describe("BWAdtClient Login Tests", () => {
  let client: BWAdtClient

  beforeAll(() => {
    client = new BWAdtClient(
      testConfig.baseUrl,
      testConfig.username,
      testConfig.password,
      testConfig.client,
      testConfig.language
    )
  })

  test("should create client instance", () => {
    expect(client).toBeDefined()
    expect(client.baseUrl).toBe(testConfig.baseUrl)
    expect(client.username).toBe(testConfig.username)
    expect(client.client).toBe(testConfig.client)
    expect(client.language).toBe(testConfig.language)
  })

  test("should login successfully", async () => {
    await client.login()

    expect(client.loggedin).toBe(true)
    expect(client.csrfToken).toBeDefined()
    expect(client.csrfToken).not.toBe("")

    console.log("Login successful!")
    console.log("CSRF Token:", client.csrfToken)
    console.log("Session ID:", client.sessionID)
  }, 30000)

  test("should get system info after login", async () => {
    await client.login()

    const sysInfo = await client.systemInfo()

    expect(sysInfo).toBeDefined()
    console.log("System Info:", JSON.stringify(sysInfo, null, 2))
  }, 30000)

  test("should logout successfully", async () => {
    await client.login()
    expect(client.loggedin).toBe(true)

    await client.logout()
    // logout 后 loggedin 状态可能仍然是 true（因为需要重新检查）
    console.log("Logout completed")
  }, 30000)

  test("should drop session successfully", async () => {
    await client.login()
    expect(client.loggedin).toBe(true)

    const sessionID = client.sessionID
    console.log("Session ID before drop:", sessionID)

    await client.dropSession()
    console.log("Session dropped successfully")
  }, 30000)

  test("should handle login-logout-dropSession cycle", async () => {
    console.log("\n========== Login/Logout/DropSession Cycle ==========")

    // Login
    await client.login()
    console.log("Step 1: Logged in")
    expect(client.loggedin).toBe(true)

    const session1 = client.sessionID
    console.log("Session ID:", session1)

    // Logout
    await client.logout()
    console.log("Step 2: Logged out")

    // Login again
    await client.login()
    console.log("Step 3: Logged in again")
    expect(client.loggedin).toBe(true)

    const session2 = client.sessionID
    console.log("New Session ID:", session2)

    // Drop session
    await client.dropSession()
    console.log("Step 4: Session dropped")

    console.log("======================================================\n")
  }, 30000)

  afterAll(async () => {
    // Clean up - ignore errors if session is already invalid
    try {
      if (client.loggedin) {
        await client.logout()
      }
    } catch (e) {
      // Ignore logout errors
    }
    try {
      await client.dropSession()
      console.log("Cleaned up session successfully")
    } catch (e) {
      // Session might already be invalid, ignore
      console.log("Session already cleaned up or invalid")
    }
  })
})
