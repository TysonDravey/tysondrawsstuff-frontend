'use client';

import { useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import ProductCard from './ProductCard';
import { Product } from '@/lib/api';

interface FeaturedCarouselProps {
  products: Product[];
}

export default function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      slidesToScroll: 1,
      dragFree: false,
    },
    [
      Autoplay({
        delay: 4000, // 4 seconds between slides
        stopOnInteraction: true,
        stopOnMouseEnter: true,
      })
    ]
  );

  useEffect(() => {
    if (!emblaApi) return;

    // Log for debugging
    console.log('Embla Carousel initialized with', products.length, 'products');
  }, [emblaApi, products.length]);

  return (
    <div className="relative max-w-6xl mx-auto">
      {/* Carousel viewport */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-8">
          {products.map((product: Product) => (
            <div
              key={product.id}
              className="flex-[0_0_100%] sm:flex-[0_0_calc(50%-16px)] lg:flex-[0_0_calc(33.333%-22px)] min-w-0"
            >
              <ProductCard product={product} featured={true} />
            </div>
          ))}
        </div>
      </div>

      {/* Optional: Carousel indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {products.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === 0 ? 'bg-primary w-8' : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
