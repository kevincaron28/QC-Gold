import { EpgpTransactionType, type PrismaClient } from "@prisma/client";

export interface CreateEpgpTransaction {
  guildId: string;
  memberId: string;
  epAmount?: number;
  gpAmount?: number;
  type: EpgpTransactionType;
  reason: string;
  createdBy: string;
  sourceRef?: string;
}

export interface EpgpStanding {
  ep: number;
  gp: number;
  pr: number;
}

function validateAmount(value: number | undefined, name: string): number {
  const amount = value ?? 0;
  if (!Number.isInteger(amount)) {
    throw new Error(`${name} must be an integer`);
  }
  return amount;
}

export function createEpgpService(database: PrismaClient) {
  const createTransaction = async (input: CreateEpgpTransaction) => {
    const epAmount = validateAmount(input.epAmount, "EP amount");
    const gpAmount = validateAmount(input.gpAmount, "GP amount");
    if (epAmount === 0 && gpAmount === 0) {
      throw new Error("EPGP transaction must change EP or GP");
    }
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new Error("EPGP transaction reason must be at least 3 characters");
    }

    // The ledger is append-only: corrections use reverseTransaction rather than updates/deletes.
    return database.epgpTransaction.create({
      data: {
        guildId: input.guildId,
        memberId: input.memberId,
        epAmount,
        gpAmount,
        type: input.type,
        reason,
        createdBy: input.createdBy,
        sourceRef: input.sourceRef ?? null
      }
    });
  };

  const getStanding = async (memberId: string): Promise<EpgpStanding> => {
    const result = await database.epgpTransaction.aggregate({
      where: { memberId },
      _sum: { epAmount: true, gpAmount: true }
    });
    const ep = result._sum.epAmount ?? 0;
    const gp = result._sum.gpAmount ?? 0;
    return { ep, gp, pr: gp > 0 ? ep / gp : 0 };
  };

  return {
    createTransaction,

    awardEP(input: Omit<CreateEpgpTransaction, "epAmount" | "gpAmount" | "type"> & { amount: number }) {
      return createTransaction({ ...input, epAmount: input.amount, type: EpgpTransactionType.EP_AWARD });
    },

    awardItem(input: Omit<CreateEpgpTransaction, "epAmount" | "gpAmount" | "type"> & { gp: number }) {
      return createTransaction({ ...input, gpAmount: input.gp, type: EpgpTransactionType.ITEM_AWARD });
    },

    getStanding,

    async getHistory(memberId: string, limit = 10) {
      return database.epgpTransaction.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: limit
      });
    },

    async applyDecay(guildId: string, percent: number, createdBy: string) {
      if (!Number.isFinite(percent) || percent < 0 || percent > 1) {
        throw new Error("Decay percent must be between 0 and 1");
      }
      const members = await database.member.findMany({
        where: { guildId, status: "ACTIVE" },
        select: { id: true }
      });
      const transactions = [];
      for (const member of members) {
        const standing = await getStanding(member.id);
        const ep = -Math.floor(standing.ep * percent);
        const gp = -Math.floor(standing.gp * percent);
        if (ep !== 0 || gp !== 0) {
          transactions.push(createTransaction({
            guildId,
            memberId: member.id,
            epAmount: ep,
            gpAmount: gp,
            type: EpgpTransactionType.DECAY,
            reason: `EPGP decay (${percent * 100}%)`,
            createdBy
          }));
        }
      }
      return Promise.all(transactions);
    },

    async reverseTransaction(transactionId: string, createdBy: string, reason: string) {
      const original = await database.epgpTransaction.findUnique({ where: { id: transactionId } });
      if (!original) {
        throw new Error("EPGP transaction not found");
      }
      return createTransaction({
        guildId: original.guildId,
        memberId: original.memberId,
        epAmount: -original.epAmount,
        gpAmount: -original.gpAmount,
        type: EpgpTransactionType.REVERSAL,
        reason,
        createdBy,
        sourceRef: `reversal:${original.id}`
      });
    }
  };
}
