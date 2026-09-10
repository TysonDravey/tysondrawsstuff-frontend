import type { Metadata } from 'next';
import MarketCheckoutClient from '@/components/MarketCheckoutClient';

export const metadata: Metadata = {
  title: 'Market Checkout | Tyson Draws Stuff',
  description: 'Quick pay for in-person purchases at Tyson Draws Stuff markets and shows.',
  robots: {
    index: false,
    follow: false,
  },
};

interface MarketPageProps {
  searchParams: Promise<{ m?: string }>;
}

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const { m } = await searchParams;

  return (
    <div className="min-h-screen bg-background">
      <MarketCheckoutClient market={m} />
    </div>
  );
}
