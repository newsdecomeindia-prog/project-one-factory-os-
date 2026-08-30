import { PrismaClient } from '@prisma/client';

export interface TaxCalculationResult {
  taxMasterId: string | null;
  taxRate: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  subtotalAmount: number;
  totalAmount: number;
}

export class TaxEngine {
  /**
   * Calculates dynamic GST taxes based on TaxMaster configuration.
   */
  static async calculateTax(
    prisma: PrismaClient,
    companyId: string,
    subtotalAmount: number,
    taxCodeOrId?: string
  ): Promise<TaxCalculationResult> {
    const round2 = (num: number) => Math.round(num * 100) / 100;

    if (!taxCodeOrId) {
      return {
        taxMasterId: null,
        taxRate: 0,
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        subtotalAmount: round2(subtotalAmount),
        totalAmount: round2(subtotalAmount),
      };
    }

    const taxMaster = await prisma.taxMaster.findFirst({
      where: {
        companyId,
        OR: [{ id: taxCodeOrId }, { taxCode: taxCodeOrId }],
        status: 'ACTIVE',
      },
    });

    if (!taxMaster) {
      throw new Error(`Tax Master code/id '${taxCodeOrId}' not found or inactive for company.`);
    }

    const taxRate = taxMaster.taxRate;
    const taxAmount = round2((subtotalAmount * taxRate) / 100);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (taxMaster.taxType === 'INTRA_STATE') {
      cgstAmount = round2((subtotalAmount * (taxMaster.cgstRate || taxRate / 2)) / 100);
      sgstAmount = round2((subtotalAmount * (taxMaster.sgstRate || taxRate / 2)) / 100);
    } else {
      igstAmount = round2((subtotalAmount * (taxMaster.igstRate || taxRate)) / 100);
    }

    const totalAmount = round2(subtotalAmount + taxAmount);

    return {
      taxMasterId: taxMaster.id,
      taxRate,
      taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      subtotalAmount: round2(subtotalAmount),
      totalAmount,
    };
  }
}
