import { AuctionStatus, EpgpTransactionType, type PrismaClient } from "@prisma/client";

export interface CreateAuctionInput {
  guildId: string;
  itemName: string;
  minimumBid: number;
  bidIncrement: number;
  durationSeconds: number;
  createdBy: string;
}

export function createLootService(database: PrismaClient) {
  return {
    async createAuction(input: CreateAuctionInput) {
      if (!input.itemName.trim()) throw new Error("Item name is required");
      if (!Number.isInteger(input.minimumBid) || input.minimumBid < 1) throw new Error("Minimum bid must be positive");
      if (!Number.isInteger(input.bidIncrement) || input.bidIncrement < 1) throw new Error("Bid increment must be positive");
      if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 1) throw new Error("Auction duration must be positive");
      return database.auction.create({
        data: {
          guildId: input.guildId,
          itemName: input.itemName.trim(),
          minimumBid: input.minimumBid,
          bidIncrement: input.bidIncrement,
          closesAt: new Date(Date.now() + input.durationSeconds * 1000),
          createdBy: input.createdBy
        }
      });
    },

    async placeBid(input: { auctionId: string; memberId: string; amount: number }) {
      if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error("Bid must be a positive integer");
      return database.$transaction(async (tx) => {
        const auction = await tx.auction.findUnique({ where: { id: input.auctionId }, include: { bids: true } });
        if (!auction || auction.status !== AuctionStatus.ACTIVE || auction.closesAt <= new Date()) {
          throw new Error("Auction is not active");
        }
        const member = await tx.member.findUnique({ where: { id: input.memberId } });
        if (!member || member.guildId !== auction.guildId) throw new Error("You cannot bid in this guild");
        const highest = auction.bids.reduce((max, bid) => Math.max(max, bid.amount), 0);
        const minimum = Math.max(auction.minimumBid, highest ? highest + auction.bidIncrement : auction.minimumBid);
        if (input.amount < minimum) throw new Error(`Bid must be at least ${minimum} GP`);
        return tx.auctionBid.upsert({
          where: { auctionId_memberId: { auctionId: input.auctionId, memberId: input.memberId } },
          create: { auctionId: input.auctionId, memberId: input.memberId, amount: input.amount },
          update: { amount: input.amount }
        });
      });
    },

    async closeAuction(auctionId: string, closedBy: string) {
      return database.$transaction(async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          include: { bids: { orderBy: [{ amount: "desc" }, { createdAt: "asc" }] } }
        });
        if (!auction || auction.status !== AuctionStatus.ACTIVE) throw new Error("Auction is not active");
        const winner = auction.bids[0];
        const updated = await tx.auction.updateMany({
          where: { id: auctionId, status: AuctionStatus.ACTIVE },
          data: { status: AuctionStatus.CLOSED, closedAt: new Date() }
        });
        if (updated.count !== 1) throw new Error("Auction was already closed");
        if (!winner) return { auction, award: null };
        const transaction = await tx.epgpTransaction.create({
          data: {
            guildId: auction.guildId,
            memberId: winner.memberId,
            epAmount: 0,
            gpAmount: winner.amount,
            type: EpgpTransactionType.ITEM_AWARD,
            reason: `Loot auction: ${auction.itemName}`,
            sourceRef: auctionId,
            createdBy: closedBy
          }
        });
        const award = await tx.lootAward.create({
          data: {
            guildId: auction.guildId,
            auctionId,
            memberId: winner.memberId,
            itemName: auction.itemName,
            amount: winner.amount
          }
        });
        return { auction: { ...auction, status: AuctionStatus.CLOSED }, award, transaction };
      });
    },

    getActiveAuctions(guildId: string) {
      return database.auction.findMany({
        where: { guildId, status: AuctionStatus.ACTIVE },
        include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
        orderBy: { closesAt: "asc" }
      });
    },

    getHistory(guildId: string, limit = 20) {
      return database.lootAward.findMany({
        where: { guildId },
        include: { member: true, auction: true },
        orderBy: { awardedAt: "desc" },
        take: limit
      });
    }
  };
}
