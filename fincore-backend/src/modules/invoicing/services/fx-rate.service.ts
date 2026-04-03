/**
 * src/modules/invoicing/services/fx-rate.service.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import axios from 'axios';
import type { FxRateMap } from '../types/invoice.types';

const CACHE_KEY = 'fx:rates:latest';
const CACHE_TTL_SECS = 3600;
const OXR_BASE_URL = 'https://openexchangerates.org/api/latest.json';
const FALLBACK_RATES: Readonly<Record<string, number>> = {
  USD: 278.5,
  EUR: 302.1,
  GBP: 351.2,
  AED: 75.85,
  SAR: 74.25,
  CAD: 205.4,
  AUD: 181.6,
  CNY: 38.45,
};

@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getRate(currency: string): Promise<number> {
    const upper = currency.toUpperCase();
    if (upper === 'PKR') return 1;

    const rateMap = await this.fetchRates();
    const rate = rateMap.rates[upper];

    if (!rate) {
      this.logger.warn(`No FX rate found for ${upper}. Returning 1.`);
      return 1;
    }

    return rate;
  }

  async getRates(currencies: string[]): Promise<Readonly<Record<string, number>>> {
    const rateMap = await this.fetchRates();
    const result: Record<string, number> = { PKR: 1 };

    for (const c of currencies) {
      const upper = c.toUpperCase();
      result[upper] = upper === 'PKR' ? 1 : (rateMap.rates[upper] ?? 1);
    }

    return result;
  }

  async getAllRates(): Promise<FxRateMap> {
    return this.fetchRates();
  }

  private async fetchRates(): Promise<FxRateMap> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as FxRateMap;
        this.logger.debug('FX rates served from Redis cache');
        return parsed;
      }
    } catch (redisErr) {
      this.logger.warn('Redis unavailable for FX cache read', redisErr);
    }

    const appId = this.config.get<string>('OPEN_EXCHANGE_RATES_APP_ID');
    if (appId && appId !== 'get-free-key-at-openexchangerates.org') {
      try {
        const response = await axios.get<{ rates: Record<string, number>; timestamp: number }>(
          `${OXR_BASE_URL}?app_id=${appId}&base=USD&symbols=PKR,EUR,GBP,AED,SAR,CAD,AUD,CNY`,
          { timeout: 5000 },
        );

        const usdToData = response.data.rates;
        const usdToPkr = usdToData['PKR'] ?? 278.5;

        const pkrRates: Record<string, number> = { PKR: 1 };
        for (const [currency, usdRate] of Object.entries(usdToData)) {
          if (currency === 'PKR') continue;
          pkrRates[currency] = parseFloat((usdToPkr / usdRate).toFixed(4));
        }

        const rateMap: FxRateMap = {
          base: 'PKR',
          rates: pkrRates,
          timestamp: response.data.timestamp,
        };

        try {
          await this.redis.setex(CACHE_KEY, CACHE_TTL_SECS, JSON.stringify(rateMap));
        } catch (cacheErr) {
          this.logger.warn('Redis unavailable for FX cache write', cacheErr);
        }

        this.logger.log(
          `FX rates refreshed from Open Exchange Rates (${Object.keys(pkrRates).length} currencies)`,
        );
        return rateMap;
      } catch (apiErr) {
        this.logger.error(
          'Open Exchange Rates API unavailable — falling back to hardcoded rates',
          apiErr,
        );
      }
    }

    this.logger.warn(
      'Using hardcoded FX fallback rates. Configure OPEN_EXCHANGE_RATES_APP_ID for live rates.',
    );
    return {
      base: 'PKR',
      rates: { ...FALLBACK_RATES, PKR: 1 },
      timestamp: Date.now() / 1000,
    };
  }

  async invalidateCache(): Promise<void> {
    await this.redis.del(CACHE_KEY);
    this.logger.log('FX rate cache invalidated');
  }
}
