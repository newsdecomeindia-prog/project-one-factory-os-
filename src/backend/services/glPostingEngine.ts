export interface JournalLineInput {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  lineDescription?: string;
}

export interface PostJournalInput {
  sourceDocumentType: string;
  sourceDocumentId: string;
  postedById: string;
  companyId: string;
  plantId?: string;
  lines: JournalLineInput[];
}

export class GlPostingEngine {
  /**
   * Posts an immutable double-entry journal header with lines.
   * Total Debits MUST equal Total Credits.
   */
  static async postJournal(prismaClient: any, input: PostJournalInput) {
    const totalDebit = input.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    const roundDebit = Math.round(totalDebit * 100) / 100;
    const roundCredit = Math.round(totalCredit * 100) / 100;

    if (roundDebit !== roundCredit) {
      throw new Error(`Double-Entry GL Imbalance: Debits (${roundDebit}) do not equal Credits (${roundCredit}).`);
    }

    if (input.lines.length < 2) {
      throw new Error('Double-Entry GL Posting must contain at least 2 lines (1 Debit, 1 Credit).');
    }

    const journalNumber = `JRNL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const journal = await prismaClient.journalHeader.create({
      data: {
        journalNumber,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        postedById: input.postedById,
        companyId: input.companyId,
        plantId: input.plantId,
        status: 'POSTED',
        lines: {
          create: input.lines.map((line) => ({
            accountCode: line.accountCode,
            accountName: line.accountName,
            debitAmount: line.debitAmount || 0,
            creditAmount: line.creditAmount || 0,
            lineDescription: line.lineDescription || '',
            companyId: input.companyId,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    return journal;
  }

  /**
   * Reverses a posted journal entry immutably.
   */
  static async reverseJournal(
    prismaClient: any,
    originalJournalId: string,
    postedById: string,
    companyId: string,
    reason: string
  ) {
    const original = await prismaClient.journalHeader.findFirst({
      where: { id: originalJournalId, companyId },
      include: { lines: true },
    });

    if (!original) {
      throw new Error(`Journal ${originalJournalId} not found.`);
    }

    if (original.status === 'REVERSED') {
      throw new Error(`Journal ${originalJournalId} is already reversed.`);
    }

    // Mark original as REVERSED
    await prismaClient.journalHeader.update({
      where: { id: originalJournalId },
      data: { status: 'REVERSED' },
    });

    const reversalJournalNumber = `REV-${original.journalNumber}`;

    // Create reversal entry with swapped debits & credits
    const reversalJournal = await prismaClient.journalHeader.create({
      data: {
        journalNumber: reversalJournalNumber,
        sourceDocumentType: 'REVERSAL',
        sourceDocumentId: original.sourceDocumentId,
        postedById,
        companyId,
        plantId: original.plantId,
        status: 'POSTED',
        isReversal: true,
        reversingJournalId: originalJournalId,
        reversalReason: reason,
        lines: {
          create: original.lines.map((line: any) => ({
            accountCode: line.accountCode,
            accountName: line.accountName,
            debitAmount: line.creditAmount, // Swap Credit to Debit
            creditAmount: line.debitAmount, // Swap Debit to Credit
            lineDescription: `Reversal of ${line.lineDescription || original.journalNumber}: ${reason}`,
            companyId,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    return reversalJournal;
  }
}
