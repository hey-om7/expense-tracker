import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// Mirrors the /settings hub: header, then grouped rows.
const GROUPS = [3, 1, 2];

const SettingsSkeleton = () => (
  <SkeletonTheme baseColor="#221a13" highlightColor="#3d332b">
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl w-full mx-auto min-h-screen" aria-busy="true" aria-label="Loading settings">
      <Skeleton width={180} height={40} borderRadius={8} />
      <Skeleton width={200} height={12} borderRadius={4} style={{ marginTop: 8, marginBottom: 32 }} />

      <div className="flex flex-col gap-8">
        {GROUPS.map((rows, g) => (
          <div key={g}>
            <Skeleton width={160} height={10} borderRadius={4} style={{ marginBottom: 10 }} />
            <div className="bg-surface-container-low border border-outline/10 rounded-2xl divide-y divide-outline/10">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton width={40} height={40} borderRadius={12} />
                  <div className="flex-1 min-w-0">
                    <Skeleton width={140} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width="70%" height={11} borderRadius={4} />
                  </div>
                  <Skeleton width={44} height={24} borderRadius={12} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  </SkeletonTheme>
);

export default SettingsSkeleton;
