import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const SettingsSkeleton = () => {
  return (
    <SkeletonTheme baseColor="#221a13" highlightColor="#3d332b">
      <main className="pt-24 pb-32 px-6 max-w-3xl mx-auto min-h-screen">
        <Skeleton width={180} height={40} borderRadius={8} className="mb-8" />

        <div className="flex flex-col gap-8">
          {/* Card 1: AI Assistant Settings */}
          <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton circle width={32} height={32} />
              <Skeleton width={220} height={24} borderRadius={6} />
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton width={140} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width={280} height={12} borderRadius={4} />
                </div>
                <Skeleton width={44} height={24} borderRadius={12} />
              </div>

              <div className="flex flex-col gap-6 border-t border-outline/10 pt-6">
                <div>
                  <Skeleton width={80} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width="100%" height={46} borderRadius={12} />
                </div>
                <div>
                  <Skeleton width={120} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width="100%" height={46} borderRadius={12} />
                  <div className="flex items-center justify-between mt-2 mt-4">
                    <Skeleton width={200} height={10} borderRadius={4} />
                    <Skeleton width={100} height={14} borderRadius={4} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Notification Settings */}
          <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton circle width={32} height={32} />
              <Skeleton width={220} height={24} borderRadius={6} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                <Skeleton width={260} height={12} borderRadius={4} />
              </div>
              <Skeleton width={44} height={24} borderRadius={12} />
            </div>
            <Skeleton width={180} height={10} borderRadius={4} style={{ marginTop: 16 }} />
          </section>

           {/* Card 3: Security Settings */}
           <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton circle width={32} height={32} />
              <Skeleton width={200} height={24} borderRadius={6} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Skeleton width={100} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                <Skeleton width={240} height={12} borderRadius={4} />
              </div>
              <Skeleton width={100} height={40} borderRadius={12} />
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end mt-4">
            <Skeleton width={140} height={48} borderRadius={12} />
          </div>
        </div>
      </main>
    </SkeletonTheme>
  );
};

export default SettingsSkeleton;
