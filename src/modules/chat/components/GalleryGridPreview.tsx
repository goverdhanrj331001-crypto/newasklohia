'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { LayoutGrid, Maximize2, MoreHorizontal } from 'lucide-react';
import { searchGallery, GalleryItem } from '../services/collegeDataService';
import { GallerySlider } from './GallerySlider';
import { GalleryExplorer } from './GalleryExplorer';

interface GalleryGridPreviewProps {
  query: string;
}

export const GalleryGridPreview = ({ query }: GalleryGridPreviewProps) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullSliderOpen, setIsFullSliderOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      const results = await searchGallery({ query });
      setItems(results);
      setLoading(false);
    };
    loadItems();
  }, [query]);

  if (loading) {
    return (
      <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse ${i === 1 ? 'aspect-video col-span-2' : 'aspect-square'}`} />
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  // Extract up to 5 unique images from the items
  const allMedia: { url: string; itemIdx: number; mediaIdx: number; title: string }[] = [];
  items.forEach((item, itemIdx) => {
    item.media_urls.forEach((url, mediaIdx) => {
      if (allMedia.length < 5) {
        allMedia.push({ url, itemIdx, mediaIdx, title: item.title });
      }
    });
  });

  const handleImageClick = (idx: number) => {
    setSelectedIndex(allMedia[idx].itemIdx);
    setSelectedMediaIndex(allMedia[idx].mediaIdx);
    setIsFullSliderOpen(true);
  };

  return (
    <div className="mt-4 w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-xl">
        {allMedia.map((media, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`relative group overflow-hidden cursor-pointer ${idx === 0 ? 'col-span-2 aspect-video' : 'aspect-square'}`}
            onClick={() => handleImageClick(idx)}
          >
            <Image 
              src={media.url} 
              alt={media.title}
              fill
              referrerPolicy="no-referrer"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Maximize2 className="text-white w-6 h-6" />
            </div>
            {idx === 0 && (
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] text-white font-bold uppercase tracking-wider">
                {media.title}
              </div>
            )}
          </motion.div>
        ))}

        {/* See All Button */}
        <button
          onClick={() => setIsExplorerOpen(true)}
          className="col-span-1 aspect-square bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <LayoutGrid className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">See All</span>
        </button>
      </div>

      <GallerySlider
        items={items}
        initialIndex={selectedIndex}
        initialMediaIndex={selectedMediaIndex}
        isOpen={isFullSliderOpen}
        onClose={() => setIsFullSliderOpen(false)}
      />

      <AnimatePresence>
        {isExplorerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[150] bg-white dark:bg-black p-4 md:p-8"
          >
            <GalleryExplorer onClose={() => setIsExplorerOpen(false)} isInline={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
