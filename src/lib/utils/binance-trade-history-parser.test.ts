import { expect, test } from "vitest";
import { parseTradeHistoryCSV } from "./binance-trade-history-parser";

const header = "Time,Symbol,Side,Quantity,Price,Realized Profit,Fee,Order ID";
const row = "2026-11-10 08:21:37,BTCUSDT,SELL,0.009,69340.3,-100.25,0.1USDT,123";

test("reads explicit liquidation flags and preserves decimal prices and stable order IDs", () => {
  const [trade] = parseTradeHistoryCSV(header + ",Liquidated\n" + row + ",Yes");
  expect(trade).toMatchObject({ order_id: "BTCUSDT::123", liquidated: true, exit_price: 69340.3, time: "08:21:37" });
  expect(parseTradeHistoryCSV(header + ",Liquidated\n" + row + ",No")[0].liquidated).toBe(false);
});

test("losses and ordinary statuses do not imply liquidation", () => {
  expect(parseTradeHistoryCSV(header + "\n" + row)[0]).not.toHaveProperty("liquidated");
  expect(parseTradeHistoryCSV(header + ",Status\n" + row + ",FILLED")[0]).not.toHaveProperty("liquidated");
  expect(parseTradeHistoryCSV(header + ",Order Type\n" + row + ",LIQUIDATION")[0].liquidated).toBe(true);
});

test("groups order IDs by symbol and trims a BOM and header whitespace", () => {
  const csv = "\uFEFF" + header.replace('Time', ' Time ') + "\n" + row + "\n" + row.replace('BTCUSDT', 'ETHUSDT');
  expect(parseTradeHistoryCSV(csv).map(trade => trade.order_id)).toEqual(["BTCUSDT::123", "ETHUSDT::123"]);
});
