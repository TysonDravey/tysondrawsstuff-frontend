'use client';

import { useEffect, useState } from 'react';

interface MarketLocalTimeProps {
  epochSeconds: number;
}

export default function MarketLocalTime({ epochSeconds }: MarketLocalTimeProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(
      new Date(epochSeconds * 1000).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  }, [epochSeconds]);

  // Avoid a server/client mismatch: render nothing until the client formats
  // the time in the viewer's own timezone.
  if (!formatted) return null;

  return <>{formatted}</>;
}
