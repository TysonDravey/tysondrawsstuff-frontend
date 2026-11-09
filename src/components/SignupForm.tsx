'use client';

// "First look at new work" email sign-up. Posts to /api/subscribe (MailerLite).
// `band` = a full-width section (home, About); `compact` = the small one in the footer.
import { useId, useState } from 'react';

type Status = 'idle' | 'sending' | 'done' | 'error';

function Form({ compact }: { compact?: boolean }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <p role="status" className={compact ? 'text-white' : 'text-lg'}>
        <strong>Almost done.</strong> Check your inbox and tap the link to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={`flex-1 min-w-0 h-12 px-4 rounded text-base text-foreground placeholder:text-muted-foreground border focus:outline-none focus:border-primary ${
            compact ? 'bg-black/25 border-white/25' : 'bg-background border-line-strong'
          }`}
        />
        {/* Hidden from people; bots fill it in */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="h-12 px-6 rounded bg-primary text-primary-foreground font-bold whitespace-nowrap hover:bg-[#F4B868] transition-colors disabled:opacity-60"
        >
          {status === 'sending' ? 'Signing up…' : 'Sign me up'}
        </button>
      </div>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-[#F6C9A0]">{message}</p>
      ) : (
        <p className={`text-sm ${compact ? 'text-[#F1DCCB]' : 'text-muted-foreground'}`}>
          Only when there’s new work or a show. Unsubscribe anytime.
        </p>
      )}
    </form>
  );
}

export function SignupBand() {
  return (
    <section aria-labelledby="signup-heading" className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-14 sm:py-16 flex flex-wrap items-center gap-x-14 gap-y-7">
        <div className="flex-[1_1_340px] min-w-0 flex flex-col gap-3">
          <p className="eyebrow">First look</p>
          <h2 id="signup-heading" className="font-display text-3xl sm:text-[36px] leading-[1.1]">
            See new paintings before anyone else.
          </h2>
          <p className="text-soft max-w-[46ch]">
            Originals sell once. Get an email when a new piece is finished or a show opens.
          </p>
        </div>
        <div className="flex-[1_1_380px] min-w-0 max-w-[520px]">
          <Form />
        </div>
      </div>
    </section>
  );
}

export function SignupCompact() {
  return (
    <div className="flex flex-col gap-3 max-w-[460px]">
      <p className="font-display text-xl text-white">First look at new work</p>
      <Form compact />
    </div>
  );
}
