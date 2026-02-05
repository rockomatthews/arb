import Database from "better-sqlite3";
import { Quote, Opportunity, OrderResult, Trade } from "../types/index.js";

export class SqliteStore {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists quotes (
        id integer primary key,
        venue_id text,
        base text,
        quote text,
        side text,
        price real,
        size real,
        fee_bps real,
        timestamp_ms integer
      );
      create table if not exists opportunities (
        id text primary key,
        buy_venue_id text,
        sell_venue_id text,
        base text,
        quote text,
        buy_price real,
        sell_price real,
        size real,
        expected_edge_bps real,
        expected_profit_usd real,
        timestamp_ms integer
      );
      create table if not exists orders (
        id integer primary key,
        order_id text,
        status text,
        filled_size real,
        avg_price real,
        fee_usd real,
        tx_hash text,
        error text,
        timestamp_ms integer
      );
      create table if not exists trades (
        id text primary key,
        venue_id text,
        base text,
        quote text,
        side text,
        size real,
        price real,
        fee_usd real,
        timestamp_ms integer
      );
      create table if not exists metrics (
        id integer primary key,
        name text,
        value real,
        timestamp_ms integer
      );
    `);
  }

  insertQuote(quote: Quote): void {
    const stmt = this.db.prepare(
      `insert into quotes
       (venue_id, base, quote, side, price, size, fee_bps, timestamp_ms)
       values (@venueId, @base, @quote, @side, @price, @size, @feeBps, @timestampMs)`
    );
    stmt.run(quote);
  }

  insertOpportunity(opportunity: Opportunity): void {
    const stmt = this.db.prepare(
      `insert or replace into opportunities
       (id, buy_venue_id, sell_venue_id, base, quote, buy_price, sell_price, size,
        expected_edge_bps, expected_profit_usd, timestamp_ms)
       values (@id, @buyVenueId, @sellVenueId, @base, @quote, @buyPrice, @sellPrice, @size,
        @expectedEdgeBps, @expectedProfitUsd, @timestampMs)`
    );
    stmt.run(opportunity);
  }

  insertOrder(order: OrderResult): void {
    const stmt = this.db.prepare(
      `insert into orders
       (order_id, status, filled_size, avg_price, fee_usd, tx_hash, error, timestamp_ms)
       values (@orderId, @status, @filledSize, @avgPrice, @feeUsd, @txHash, @error, @timestampMs)`
    );
    stmt.run({ ...order, timestampMs: Date.now() });
  }

  insertTrade(trade: Trade): void {
    const stmt = this.db.prepare(
      `insert or replace into trades
       (id, venue_id, base, quote, side, size, price, fee_usd, timestamp_ms)
       values (@id, @venueId, @base, @quote, @side, @size, @price, @feeUsd, @timestampMs)`
    );
    stmt.run(trade);
  }

  insertMetric(name: string, value: number): void {
    const stmt = this.db.prepare(
      `insert into metrics (name, value, timestamp_ms)
       values (?, ?, ?)`
    );
    stmt.run(name, value, Date.now());
  }
}
