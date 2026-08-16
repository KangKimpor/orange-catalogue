import { describe, expect, it } from "vitest";
import { MAX_POS_IMPORT_BASE64_LENGTH } from "./posImport";
import { storeRouter } from "./storeRouter";

function createContext() {
  return {
    req: { headers: {} },
    res: { cookie: () => undefined, clearCookie: () => undefined },
    user: null,
  } as any;
}

describe("POS import request boundaries", () => {
  it("rejects malformed base64 before the preview handler can parse a workbook", async () => {
    const caller = storeRouter.createCaller(createContext());
    await expect(caller.admin.previewImport({ filename: "catalogue.xlsx", base64: "not-a-valid-base64" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an overlong base64 payload before the apply handler can parse a workbook", async () => {
    const caller = storeRouter.createCaller(createContext());
    await expect(caller.admin.applyImport({ filename: "catalogue.xlsx", base64: "A".repeat(MAX_POS_IMPORT_BASE64_LENGTH + 1), importId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
