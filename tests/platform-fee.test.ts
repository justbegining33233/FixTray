import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    platformConfig: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { getPlatformServiceFeeUsd } from '../src/lib/platformFee';

describe('getPlatformServiceFeeUsd', () => {
  it('reads PlatformConfig.serviceFee (cents) set by superadmin', async () => {
    (prisma.platformConfig.findUnique as jest.Mock).mockResolvedValue({ serviceFee: 750 });
    await expect(getPlatformServiceFeeUsd()).resolves.toBe(7.5);
  });

  it('falls back to the default $5 when config is missing', async () => {
    (prisma.platformConfig.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(getPlatformServiceFeeUsd()).resolves.toBe(5);
  });
});
