import type { DkpTransactionType, PrismaClient } from "@prisma/client";

export interface CreateDkpTransaction {
  guildId: string;
  memberId: string;
  amount: number;
  type: DkpTransactionType;
  reason: string;
  createdBy: string;
  sourceRef?: string;
}

export function createDkpService(database: PrismaClient) {
  return {
    async createTransaction(input: CreateDkpTransaction) {
      if (!Number.isInteger(input.amount) || input.amount === 0) {
        throw new Error("DKP transaction amount must be a non-zero integer");
      }
      if (input.reason.trim().length < 3) {
        throw new Error("DKP transaction reason must be at least 3 characters");
      }

      return database.dkpTransaction.create({
        data: {
          guildId: input.guildId,
          memberId: input.memberId,
          amount: input.amount,
          type: input.type,
          reason: input.reason.trim(),
          createdBy: input.createdBy,
          sourceRef: input.sourceRef ?? null
        }
      });
    },

    async getBalance(memberId: string): Promise<number> {
      const result = await database.dkpTransaction.aggregate({
        where: { memberId },
        _sum: { amount: true }
      });
      return result._sum.amount ?? 0;
    },

    getHistory(memberId: string, limit = 10) {
      return database.dkpTransaction.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: limit
      });
    },

    async getLeaderboard(guildId: string, limit = 10) {
      const members = await database.member.findMany({
        where: { guildId, status: "ACTIVE" },
        include: { transactions: { select: { amount: true } } }
      });
      return members
        .map((member) => ({
          member,
          balance: member.transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
        }))
        .sort((left, right) => right.balance - left.balance)
        .slice(0, limit);
    }
  };
}
