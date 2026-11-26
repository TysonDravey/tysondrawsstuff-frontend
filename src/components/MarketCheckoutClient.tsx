'use client';

import { useState } from 'react';
import Image from 'next/image';

const PRESET_AMOUNTS = [15, 30, 40, 50, 75, 100];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 2000;

interface MarketCheckoutClientProps {
  market?: string;
}

// Big tap targets: this page is held out to customers at a market table.
const tile =
  'rounded-lg border border-line-strong bg-card text-foreground font-display transition-colors hover:border-primary active:scale-95 active:bg-primary active:text-primary-foreground';
const primaryButton =
  'w-full py-5 sm:py-6 rounded-lg bg-primary text-primary-foreground text-xl sm:text-2xl font-bold transition-colors hover:bg-[#F4B868] active:scale-95';
const outlineButton =
  'w-full py-5 sm:py-6 rounded-lg border border-primary text-primary text-xl sm:text-2xl font-bold transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95';
const errorBox =
  'text-center text-base font-semibold text-foreground bg-burgundy border border-[#F6C9A0]/30 rounded-lg py-3 px-4';

export default function MarketCheckoutClient({ market }: MarketCheckoutClientProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherAmount, setOtherAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (amount: number) => {
    if (redirecting) return;
    setError(null);
    setRedirecting(true);

    try {
      const response = await fetch('/api/market-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, market }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
        setRedirecting(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setRedirecting(false);
    }
  };

  const handleOtherAmountSubmit = () => {
    const amount = parseFloat(otherAmount);
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      setError(`Enter an amount between $${MIN_AMOUNT} and $${MAX_AMOUNT}`);
      return;
    }
    startCheckout(amount);
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-14 h-14 border-4 border-primary/25 border-t-primary rounded-full animate-spin" />
        <p className="font-display text-2xl text-foreground">Opening secure checkout…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-burgundy px-4 py-6 sm:py-8 text-center border-b border-[#F6C9A0]/20">
        <Image
          src="/brand/tds-wordmark-dark.webp"
          alt="Tyson Draws Stuff"
          width={2529}
          height={219}
          className="h-7 sm:h-9 w-auto mx-auto"
          priority
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#F6C9A0]">
          Market checkout
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground mt-1">Quick Pay</h1>
      </header>

      <main className="flex-1 flex flex-col px-4 py-8 sm:py-12">
        {!showOther ? (
          <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => startCheckout(amount)}
                  className={`${tile} aspect-square sm:aspect-[4/3] flex items-center justify-center text-3xl sm:text-5xl`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <button onClick={() => setShowOther(true)} className={`mt-5 sm:mt-6 ${outlineButton}`}>
              Other amount
            </button>

            {error && <p className={`mt-4 ${errorBox}`}>{error}</p>}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
            <label htmlFor="market-amount" className="eyebrow text-center mb-3">
              Enter amount
            </label>
            <div className="flex items-center justify-center rounded-lg border border-line-strong bg-card px-4 py-6 mb-5 focus-within:border-primary">
              <span className="font-display text-4xl sm:text-5xl text-primary mr-2">$</span>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                id="market-amount"
                autoFocus
                inputMode="decimal"
                type="text"
                value={otherAmount}
                onChange={(e) => setOtherAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOtherAmountSubmit();
                }}
                placeholder="0"
                className="w-full bg-transparent font-display text-5xl sm:text-6xl text-foreground text-center outline-none placeholder:text-muted-foreground/40"
              />
            </div>

            {error && <p className={`mb-4 ${errorBox}`}>{error}</p>}

            <button onClick={handleOtherAmountSubmit} className={primaryButton}>
              Pay{otherAmount ? ` $${otherAmount}` : ''}
            </button>

            <button
              onClick={() => {
                setShowOther(false);
                setError(null);
                setOtherAmount('');
              }}
              className="mt-3 w-full py-4 text-soft text-lg font-semibold hover:text-primary transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </main>

      <footer className="text-center pb-6 px-4">
        <p className="eyebrow">Secure payment via Stripe</p>
      </footer>
    </div>
  );
}
