'use client';

import { useState } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { StrapiImage } from '@/lib/api';
import { getProductImages } from '@/lib/images';

interface ImageGalleryProps {
  images: StrapiImage[];
  productTitle: string;
  productSlug: string;
  sold?: boolean;
}

export default function ImageGallery({ images, productTitle, productSlug, sold = false }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Get processed images (static or Strapi fallback)
  const processedImages = getProductImages(productSlug, images);

  if (!processedImages || processedImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">No images available</span>
      </div>
    );
  }

  const selectedImage = processedImages[selectedImageIndex];


  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div
        className="relative w-full bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          src={selectedImage.src}
          alt={selectedImage.alt || `${productTitle} - Image ${selectedImageIndex + 1}`}
          width={0}
          height={0}
          sizes="100vw"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '80vh',
            objectFit: 'contain'
          }}
          className="rounded-lg transition-opacity group-hover:opacity-90"
          priority={selectedImageIndex === 0}
        />

        {/* SOLD Watermark */}
        {sold === true && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-white text-6xl md:text-8xl font-bold opacity-40 transform -rotate-12 select-none">
              SOLD
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
            Click to expand
          </div>
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {processedImages.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
          {processedImages.map((image, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(index);
              }}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                index === selectedImageIndex
                  ? 'border-blue-500 ring-2 ring-blue-300 shadow-lg scale-105'
                  : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
              }`}
            >
              <Image
                src={image.src}
                alt={image.alt || `${productTitle} - Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Image Info */}
      {processedImages.length > 1 && (
        <div className="text-sm text-gray-600 text-center lg:text-left">
          <p>
            Image {selectedImageIndex + 1} of {processedImages.length}
          </p>
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={selectedImageIndex}
        slides={processedImages.map((img) => ({
          src: img.src,
          alt: img.alt || `${productTitle} - Image`,
          width: img.width,
          height: img.height,
        }))}
        on={{
          view: ({ index }: { index: number }) => setSelectedImageIndex(index),
        }}
        plugins={[Thumbnails]}
        thumbnails={{
          position: 'bottom',
          width: 120,
          height: 80,
          border: 1,
          borderRadius: 4,
          padding: 4,
          gap: 16,
        }}
      />
    </div>
  );
}