/**
 * What the shell looks like before auth resolves.
 *
 * It draws the real chrome — Navy rail, topbar, header band — and skeletons
 * only the content, so the page does not visibly re-lay-out the moment the
 * session comes back.
 */

import { Skeleton } from "@/ds";

export function DashboardLayoutSkeleton() {
  return (
    <div className="ak-shell" aria-busy="true" aria-label="Loading">
      <nav className="nsb">
        <div className="nsb__brand">
          <span className="nsb__wordmark">numu</span>
        </div>
        <div className="nsb__scroll">
          {[0, 1, 2].map((group) => (
            <div key={group}>
              <div className="nsb__section">
                <Skeleton width="60%" />
              </div>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="nsb__item">
                  <Skeleton width="80%" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="ak-main">
        <header className="ntp">
          <div className="ntp__search">
            <Skeleton height={34} />
          </div>
          <div className="ntp__spacer" />
          <Skeleton width={120} height={28} />
        </header>

        <div className="nph">
          <Skeleton width={220} height={26} />
          <Skeleton width={340} />
        </div>

        <div className="ak-page">
          <div className="ak-metrics">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={92} variant="block" />
            ))}
          </div>
          <Skeleton height={280} variant="block" />
        </div>
      </div>
    </div>
  );
}
