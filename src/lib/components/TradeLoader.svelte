<script lang="ts">
  /** Optional label shown below the bars */
  let { label = '' }: { label?: string } = $props();
</script>

<!--
  TradeLoader — animated candlestick bars loading indicator.
  Three bars (wick + body) stagger-pulse to resemble a live chart.
  Usage: <TradeLoader />  or  <TradeLoader label="Loading…" />
-->
<div class="trade-loader" aria-label={label || 'Loading'} role="status">
  <div class="bars">
    <!-- Candle 1 (blue / accent — bullish) -->
    <div class="candle candle-1">
      <div class="wick wick-1"></div>
      <div class="body body-1"></div>
    </div>
    <!-- Candle 2 (red / loss — bearish) -->
    <div class="candle candle-2">
      <div class="wick wick-2"></div>
      <div class="body body-2"></div>
    </div>
    <!-- Candle 3 (green / win — bullish) -->
    <div class="candle candle-3">
      <div class="wick wick-3"></div>
      <div class="body body-3"></div>
    </div>
  </div>
  {#if label}
    <span class="lbl">{label}</span>
  {/if}
</div>

<style>
  .trade-loader {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  /* Container for all three candles, aligned to bottom */
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    height: 32px;
  }

  /* Each candle is a column: wick on top, body on bottom */
  .candle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 32px;
    animation: candle-pulse 1.2s ease-in-out infinite;
  }
  .candle-1 { animation-delay: 0s; }
  .candle-2 { animation-delay: 0.22s; }
  .candle-3 { animation-delay: 0.44s; }

  /* Thin wick above the body */
  .wick {
    width: 2px;
    border-radius: 1px;
    flex-shrink: 0;
  }
  .wick-1 { height: 8px;  background: var(--accent); }
  .wick-2 { height: 12px; background: var(--loss); }
  .wick-3 { height: 6px;  background: var(--win); }

  /* Wider rectangular body */
  .body {
    width: 9px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .body-1 { height: 16px; background: var(--accent); opacity: 0.9; }
  .body-2 { height: 22px; background: var(--loss);   opacity: 0.85; }
  .body-3 { height: 11px; background: var(--win);    opacity: 0.9; }

  /* Staggered scale-up gives the "live chart ticking" feel */
  @keyframes candle-pulse {
    0%, 100% { transform: scaleY(0.75); opacity: 0.55; }
    50%       { transform: scaleY(1);    opacity: 1; }
  }

  .lbl {
    font-size: 0.72rem;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
</style>
