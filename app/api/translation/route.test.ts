import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/translation", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/translation", () => {
  it("returns success with the provided text", async () => {
    const request = makeRequest({
      sourceLanguage: "es",
      targetLanguage: "en",
      text: "Hola mundo",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBe("Hola mundo");
  });
});
