import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Full-page skeleton shown while AppContext loads all data on the History page.
 * Mimics the History layout: header, filters, and transaction list.
 */
const HistorySkeleton = () => {
  return (
    <SkeletonTheme baseColor="#271e16" highlightColor="#3d332b">
      <div className="pb-24 md:pb-0 md:pl-72">
        {/* Fake Header Bar */}
        <header className="fixed top-0 left-0 right-0 md:left-72 z-40 h-16 bg-background/80 backdrop-blur-xl border-b border-outline/10 flex items-center px-6 justify-between">
          <Skeleton width={120} height={24} borderRadius={8} />
          <div className="flex items-center gap-3">
            <Skeleton circle width={36} height={36} />
            <Skeleton circle width={36} height={36} />
          </div>
        </header>

        {/* Fake Sidebar (desktop only) */}
        <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-72 bg-surface-container-low border-r border-outline/10 flex-col p-6 gap-6 z-50">
          <div className="mb-4">
            <Skeleton width={100} height={28} borderRadius={8} />
          </div>
          <div className="flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton circle width={24} height={24} />
                <Skeleton width={100 + Math.random() * 40} height={16} borderRadius={6} />
              </div>
            ))}
          </div>
          <div className="mt-auto">
            <Skeleton width={140} height={40} borderRadius={12} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <Skeleton width={120} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                <Skeleton width={200} height={48} borderRadius={8} />
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-6 shadow-sm border border-outline-variant/10">
                <div className="flex flex-col">
                  <Skeleton width={100} height={10} borderRadius={4} style={{ marginBottom: 4 }} />
                  <Skeleton width={140} height={24} borderRadius={6} />
                </div>
              </div>
            </div>
          </div>

          {/* ===== MOBILE: Search + Filter Toggle ===== */}
          <div className="md:hidden mb-4 flex flex-col gap-3">
            <Skeleton width="100%" height={48} borderRadius={8} />
            <div className="flex gap-2">
              <Skeleton width="50%" height={44} borderRadius={8} />
              <Skeleton width="50%" height={44} borderRadius={8} />
            </div>
          </div>

          {/* ===== DESKTOP: Unified filter bar ===== */}
          <section className="hidden md:block mb-8">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline/5 overflow-hidden">
              <div className="p-5 flex items-center gap-4">
                <div className="flex-[1.5]">
                  <Skeleton width="100%" height={44} borderRadius={8} />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <Skeleton width="100%" height={44} borderRadius={8} />
                  </div>
                  <div className="flex-1">
                    <Skeleton width="100%" height={44} borderRadius={8} />
                  </div>
                  <div className="flex-1">
                    <Skeleton width="100%" height={44} borderRadius={8} />
                  </div>
                </div>
              </div>
              <div className="h-px bg-outline/5 mx-5" />
              <div className="px-5 py-3 flex items-center gap-4">
                <Skeleton width={60} height={10} borderRadius={4} />
                <div className="flex items-center gap-3 flex-[0.5]">
                  <Skeleton width="100%" height={32} borderRadius={8} />
                  <Skeleton width={16} height={10} borderRadius={4} />
                  <Skeleton width="100%" height={32} borderRadius={8} />
                  <Skeleton width="100%" height={32} borderRadius={8} />
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton width={180} height={24} borderRadius={6} />
                </div>
                
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-surface-container-low rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="min-w-[3rem] h-12 flex-shrink-0">
                        <Skeleton width={48} height={48} borderRadius={16} />
                      </div>
                      <div>
                        <Skeleton width={150} height={20} borderRadius={6} style={{ marginBottom: 6 }} />
                        <Skeleton width={100} height={12} borderRadius={4} />
                      </div>
                    </div>
                    <div className="mt-2 md:mt-0 flex flex-col items-start md:items-end">
                      <Skeleton width={100} height={24} borderRadius={6} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* Fake Bottom Nav (mobile) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-surface-container-high border-t border-outline/10 flex items-center justify-around px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton circle width={24} height={24} />
              <Skeleton width={32} height={8} borderRadius={4} />
            </div>
          ))}
        </nav>
      </div>
    </SkeletonTheme>
  );
};

export default HistorySkeleton;
