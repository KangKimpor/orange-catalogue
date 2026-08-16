import { expect, it } from "vitest";
import { storeRouter } from "./storeRouter";

it("requires an authenticated admin session before deleting a Cloudinary photo", async () => {
  const context = {
    req: { headers: { cookie: "" } },
    res: { cookie: () => undefined, clearCookie: () => undefined },
    user: null,
  } as any;
  await expect(storeRouter.createCaller(context).admin.deleteMedia({ mediaId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
