import { describe, expect, it } from "vitest";
import { createLootService } from "../src/services/loot.js";
import { createApplicationService } from "../src/services/application.js";

describe("loot and application validation", () => {
  it("rejects invalid auction settings before database access", async () => {
    const service = createLootService({} as never);
    await expect(service.createAuction({
      guildId: "guild", itemName: "Sword", minimumBid: 0, bidIncrement: 5,
      durationSeconds: 60, createdBy: "officer"
    })).rejects.toThrow("Minimum bid must be positive");
  });

  it("rejects invalid bids before database access", async () => {
    const service = createLootService({} as never);
    await expect(service.placeBid({ auctionId: "auction", memberId: "member", amount: 0 }))
      .rejects.toThrow("Bid must be a positive integer");
  });

  it("rejects incomplete applications before database access", async () => {
    const service = createApplicationService({} as never);
    await expect(service.create({
      guildId: "guild", memberId: "member", character: "Ace", className: "",
      spec: "Holy", experience: "Raids", availability: "Evenings"
    })).rejects.toThrow("className is required");
  });
});
