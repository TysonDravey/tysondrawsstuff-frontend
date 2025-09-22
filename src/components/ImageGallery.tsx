'use client';

import { useState } from 'react';
import Image from 'next/image';
import { StrapiImage, getStrapiImageUrl } from '@/lib/api';

interface ImageGalleryProps {
  images: StrapiImage[];
  productTitle: string;
}

export default function ImageGallery({ images, productTitle }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">No images available</span>
      </div>
    );
  }

  const selectedImage = images[selectedImageIndex];


  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="w-full bg-gray-100 rounded-lg overflow-hidden">
        <Image
          src={getStrapiImageUrl(selectedImage)}
          alt={selectedImage.alternativeText || `${productTitle} - Image ${selectedImageIndex + 1}`}
          width={0}
          height={0}
          sizes="100vw"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '80vh',
            objectFit: 'contain'
          }}
          className="rounded-lg"
          priority={selectedImageIndex === 0}
        />
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedImageIndex(index)}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                index === selectedImageIndex
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Image
                src={getStrapiImageUrl(image)}
                alt={image.alternativeText || `${productTitle} - Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />

              {/* Selected indicator */}
              {index === selectedImageIndex && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Image Info */}
      <div className="text-sm text-gray-600 text-center lg:text-left">
        {images.length > 1 && (
          <p>
            Image {selectedImageIndex + 1} of {images.length}
          </p>
        )}
        {selectedImage.width && selectedImage.height && (
          <p className="text-xs">
            {selectedImage.width} × {selectedImage.height} pixels
          </p>
        )}
      </div>
    </div>
  );
}