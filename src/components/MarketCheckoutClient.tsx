'use client';

import { useState } from 'react';
import Image from 'next/image';

const PRESET_AMOUNTS = [20, 30, 40, 50, 75, 100];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 2000;

interface MarketCheckoutClientProps {
  market?: string;
}

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
        <div className="w-16 h-16 border-4 border-[#E89B3B]/30 border-t-[#E89B3B] rounded-full animate-spin" />
        <p className="text-2xl font-black uppercase tracking-wide text-[#E89B3B]">
          Opening secure checkout…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 sm:py-10">
      <header className="text-center mb-6 sm:mb-8">
        <Image
          src="/static/logo.png"
          alt="Tyson Draws Stuff"
          width={418}
          height={200}
          className="h-20 sm:h-24 w-auto mx-auto"
          priority
        />
        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-[#E89B3B] mt-3">
          Quick Pay
        </h1>
      </header>

      {!showOther ? (
        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full">
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => startCheckout(amount)}
                className="aspect-square sm:aspect-[4/3] bg-black text-[#E89B3B] rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-5xl font-black shadow-lg active:scale-95 transition-transform"
              >
                ${amount}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowOther(true)}
            className="mt-6 sm:mt-8 w-full py-6 sm:py-7 rounded-3xl bg-black border-2 border-[#E89B3B] text-[#E89B3B] text-2xl sm:text-3xl font-black uppercase tracking-wide active:scale-95 transition-transform"
          >
            Other Amount
          </button>

          {error && (
            <p className="mt-4 text-center text-lg font-bold text-black bg-white/90 rounded-xl py-3 px-4">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <label className="text-center text-[#E89B3B]/80 text-lg font-bold uppercase tracking-wide mb-3">
            Enter Amount
          </label>
          <div className="flex items-center justify-center bg-black rounded-3xl px-4 py-6 mb-6">
            <span className="text-4xl sm:text-5xl font-black text-[#E89B3B] mr-2">$</span>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              inputMode="decimal"
              type="text"
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              className="w-full bg-transparent text-5xl sm:text-6xl font-black text-[#E89B3B] text-center outline-none placeholder:text-[#E89B3B]/40"
            />
          </div>

          {error && (
            <p className="mb-4 text-center text-lg font-bold text-black bg-white/90 rounded-xl py-3 px-4">
              {error}
            </p>
          )}

          <button
            onClick={handleOtherAmountSubmit}
            className="w-full py-6 sm:py-7 rounded-3xl bg-black text-[#E89B3B] text-2xl sm:text-3xl font-black uppercase tracking-wide active:scale-95 transition-transform"
          >
            Pay{otherAmount ? ` $${otherAmount}` : ''}
          </button>

          <button
            onClick={() => {
              setShowOther(false);
              setError(null);
              setOtherAmount('');
            }}
            className="mt-4 w-full py-4 text-[#E89B3B]/80 text-lg font-bold uppercase tracking-wide"
          >
            Back
          </button>
        </div>
      )}

      <footer className="text-center mt-8">
        <p className="text-[#E89B3B]/50 text-sm font-semibold uppercase tracking-wide">
          Secure payment via Stripe
        </p>
      </footer>
    </div>
  );
}
