import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Full-page skeleton shown while AppContext loads all data.
 * Mimics the Dashboard layout: header, stat cards, spending widget,
 * recent activity, portfolio overview, and upcoming bills.
 */
const DashboardSkeleton = () => {
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
        <main className="pt-24 px-6 pb-12 max-w-7xl mx-auto w-full max-md:pb-28 max-md:px-4">
          
          {/* Header: Balance + Buttons */}
          <section className="mb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-md:gap-4">
              <div>
                <Skeleton width={120} height={10} borderRadius={4} style={{ marginBottom: 12 }} />
                <Skeleton width={280} height={52} borderRadius={8} className="hidden md:block" />
                <Skeleton width={200} height={36} borderRadius={8} className="md:hidden" />
              </div>
              <div className="flex gap-3">
                <Skeleton width={120} height={48} borderRadius={12} />
                <Skeleton width={120} height={48} borderRadius={12} />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-md:gap-4">
            
            {/* LEFT COLUMN */}
            <div className="md:col-span-8 flex flex-col gap-6 max-md:gap-4">
              
              {/* Monthly Spending Widget */}
              <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <Skeleton width={160} height={20} borderRadius={6} />
                    <Skeleton width={220} height={12} borderRadius={4} style={{ marginTop: 6 }} />
                  </div>
                  <Skeleton width={90} height={28} borderRadius={6} />
                </div>
                {/* Category bars */}
                <div className="flex flex-col gap-4 mt-4">
                  {[100, 80, 60, 45].map((w, i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex justify-between">
                        <Skeleton width={90} height={12} borderRadius={4} />
                        <Skeleton width={60} height={12} borderRadius={4} />
                      </div>
                      <Skeleton height={8} borderRadius={999} style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity Widget */}
              <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <Skeleton width={140} height={20} borderRadius={6} />
                  <Skeleton width={60} height={14} borderRadius={4} />
                </div>
                <div className="flex flex-col gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-container-highest/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Skeleton width={40} height={40} borderRadius={8} />
                        <div>
                          <Skeleton width={100 + i * 10} height={14} borderRadius={4} />
                          <Skeleton width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
                        </div>
                      </div>
                      <Skeleton width={65} height={14} borderRadius={4} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="md:col-span-4 flex flex-col gap-6 max-md:gap-4">
              
              {/* Portfolio Overview */}
              <div className="bg-surface-container-lowest border border-outline/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <Skeleton width={140} height={12} borderRadius={4} style={{ marginBottom: 24 }} />
                <div className="flex flex-col gap-4">
                  <div>
                    <Skeleton width={80} height={10} borderRadius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width={160} height={32} borderRadius={6} />
                  </div>
                  <Skeleton height={48} borderRadius={12} style={{ marginTop: 8 }} />
                  <Skeleton height={48} borderRadius={12} />
                </div>
              </div>

              {/* Upcoming Bills */}
              <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Skeleton circle width={20} height={20} />
                  <Skeleton width={130} height={16} borderRadius={6} />
                </div>
                <div className="flex flex-col gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center pb-4 border-b border-outline/10 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Skeleton width={32} height={32} borderRadius={4} />
                        <div>
                          <Skeleton width={90} height={14} borderRadius={4} />
                          <Skeleton width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
                        </div>
                      </div>
                      <Skeleton width={55} height={12} borderRadius={4} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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

export default DashboardSkeleton;
