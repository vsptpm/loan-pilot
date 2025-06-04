
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, User as UserIcon, TrendingDown, TrendingUp as TrendingUpIcon, Percent, ListChecks, Activity, Flame, ShieldCheck, CalendarCheck } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <Skeleton className="h-8 w-64 mb-2 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card Skeleton */}
        <div className="lg:col-span-1 shadow-lg bg-card flex flex-col items-center p-6 rounded-xl">
          <Skeleton className="w-24 h-24 rounded-full mb-3" />
          <Skeleton className="h-6 w-32 mb-1 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>

        {/* Stats Cards Skeleton Container */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className={`shadow-md rounded-xl bg-card p-4 ${item === 5 ? 'sm:col-span-2' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-24 rounded" />
                {item === 1 && <TrendingDown className="h-4 w-4 text-muted-foreground" />}
                {item === 2 && <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />}
                {item === 3 && <Percent className="h-4 w-4 text-muted-foreground" />}
                {item === 4 && <Activity className="h-4 w-4 text-muted-foreground" />}
                {item === 5 && <ListChecks className="h-4 w-4 text-muted-foreground" />}
              </div>
              {item === 4 ? (
                <>
                  <Skeleton className="h-3 w-full mb-2 rounded-full" />
                  <Skeleton className="h-4 w-20 mx-auto rounded" />
                </>
              ) : (
                 <Skeleton className="h-8 w-3/4 rounded" />
              )}
               {item === 5 && <Skeleton className="h-4 w-5/6 mt-1 rounded" />}
            </div>
          ))}
        </div>
      </div>
      
      {/* Key Loan Information Skeleton (Insights & Milestones) */}
      <div className="mt-8">
        <Skeleton className="h-7 w-52 mb-4 rounded" /> {/* "Key Loan Information" Title */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Flame className="h-4 w-4 text-muted-foreground" />, title: "Highest Interest Loan" },
            { icon: <ShieldCheck className="h-4 w-4 text-muted-foreground" />, title: "Lowest Interest Loan" },
            { icon: <CalendarCheck className="h-4 w-4 text-muted-foreground" />, title: "Upcoming Milestone", fullWidthOnTablet: true }
          ].map((item, index) => (
            <div key={index} className={`shadow-md rounded-xl bg-card p-4 ${item.fullWidthOnTablet ? 'md:col-span-2 lg:col-span-1' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-3/5 rounded" /> {/* Insight Card Title */}
                {item.icon}
              </div>
              <Skeleton className="h-6 w-4/5 mb-1 rounded" /> {/* Loan Name */}
              <Skeleton className="h-8 w-1/2 mb-2 rounded" /> {/* Interest Rate / Date */}
              <Skeleton className="h-3 w-full rounded" /> {/* Description line / Time Remaining */}
            </div>
          ))}
        </div>
      </div>
      
      {/* Active Loans List Skeleton */}
      <div>
        <Skeleton className="h-8 w-48 mt-10 mb-6 rounded" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="shadow-lg bg-card p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-3/5 rounded" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-4/5 rounded" />
              <div className="flex justify-between text-sm">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-4 w-1/4 rounded" />
              </div>
              <div className="flex justify-between text-sm">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-4 w-1/4 rounded" />
              </div>
              <div>
                <Skeleton className="h-3 w-full mt-1 rounded-full" />
                <Skeleton className="h-3 w-1/4 mt-1 ml-auto rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

