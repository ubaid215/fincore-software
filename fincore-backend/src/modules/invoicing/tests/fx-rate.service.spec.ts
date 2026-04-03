/**
 * src/modules/invoicing/tests/fx-rate.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FxRateService } from '../services/fx-rate.service';

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, def?: string): string => {
    if (key === 'OPEN_EXCHANGE_RATES_APP_ID') return 'test-app-id';
    return def ?? key;
  }),
};

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

import axios from 'axios';

// Cast once so ESLint sees a typed jest.Mock, not an unbound method
const axiosGetMock = axios.get as jest.Mock;

describe('FxRateService', () => {
  let service: FxRateService;

  const SAMPLE_RATES = {
    base: 'PKR' as const,
    rates: { PKR: 1, USD: 278.5, EUR: 302.1, GBP: 351.2 },
    timestamp: Date.now() / 1000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRateService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<FxRateService>(FxRateService);
    jest.clearAllMocks();
  });

  describe('getRate()', () => {
    it('returns 1 for PKR (base currency)', async () => {
      const rate = await service.getRate('PKR');
      expect(rate).toBe(1);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('returns rate from Redis cache when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_RATES));

      const rate = await service.getRate('USD');
      expect(rate).toBe(278.5);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      // Use the typed mock alias — no unbound-method warning
      expect(axiosGetMock).not.toHaveBeenCalled();
    });

    it('fetches from API on cache miss and caches the result', async () => {
      mockRedis.get.mockResolvedValue(null);
      axiosGetMock.mockResolvedValue({
        data: {
          rates: { PKR: 278.5, EUR: 0.92 },
          timestamp: Date.now() / 1000,
        },
      });

      const rate = await service.getRate('EUR');
      // Service: pkrRate['EUR'] = 278.5 / 0.92 ≈ 302.717
      expect(rate).toBeCloseTo(302.72, 2);

      expect(axiosGetMock).toHaveBeenCalledWith(
        expect.stringContaining('app_id=test-app-id&base=USD&symbols=PKR,EUR'),
        { timeout: 5000 },
      );
      expect(mockRedis.setex).toHaveBeenCalledWith('fx:rates:latest', 3600, expect.any(String));
    });

    it('falls back to exact hardcoded rates when API unavailable and cache empty', async () => {
      mockRedis.get.mockResolvedValue(null);
      axiosGetMock.mockRejectedValue(new Error('Network error'));

      const rate = await service.getRate('USD');
      expect(rate).toBe(278.5);

      const eurRate = await service.getRate('EUR');
      expect(eurRate).toBe(302.1);
    });

    it('returns 1 for unknown currency (with warning)', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_RATES));

      const rate = await service.getRate('XYZ');
      expect(rate).toBe(1);
    });

    it('is case-insensitive — usd and USD return the same rate', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_RATES));

      const rateUpper = await service.getRate('USD');
      const rateLower = await service.getRate('usd');
      expect(rateUpper).toBe(rateLower);
    });
  });

  describe('getRates()', () => {
    it('returns a map for multiple currencies including PKR=1', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_RATES));

      const rates = await service.getRates(['USD', 'EUR', 'PKR']);

      expect(rates['PKR']).toBe(1);
      expect(rates['USD']).toBe(278.5);
      expect(rates['EUR']).toBe(302.1);
    });

    it('deduplicates currencies — no double API calls', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_RATES));

      await service.getRates(['USD', 'USD', 'PKR']);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Redis error handling', () => {
    it('continues gracefully when Redis get() throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      axiosGetMock.mockResolvedValue({
        data: { rates: { PKR: 278.5 }, timestamp: Date.now() / 1000 },
      });

      await expect(service.getRate('USD')).resolves.toBeDefined();
    });

    it('continues gracefully when Redis setex() throws', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));
      axiosGetMock.mockResolvedValue({
        data: { rates: { PKR: 278.5, EUR: 0.92 }, timestamp: Date.now() / 1000 },
      });

      await expect(service.getRate('EUR')).resolves.toBeDefined();
    });
  });

  describe('invalidateCache()', () => {
    it('deletes the Redis cache key', async () => {
      await service.invalidateCache();
      expect(mockRedis.del).toHaveBeenCalledWith('fx:rates:latest');
    });
  });
});
