
import { Skeleton } from "@/components/ui/skeleton";
import { Edit3, ListChecks as RecordIcon, CircleDollarSign, Repeat, Wallet, ListChecks } from 'lucide-react'; // Using ListChecks for RecordIcon as well if it's similar.

export default function LoanDetailLoading() {
  return (
    <div className="container mx-auto py-8 space-y-8 animate-pulse">
      {/* Main Loan Info Card Skeleton */}
      <div className="shadow-lg bg-card rounded-xl">
        <div className="p-6">
          <div className="flex justify-between items-start gap-2 mb-1">
            <Skeleton className="h-8 w-3/4 sm:w-1/2 rounded" /> {/* Loan Title */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Skeleton className="h-9 w-20 rounded-md" /> {/* Edit Button */}
              <Skeleton className="h-9 w-44 rounded-md" /> {/* Record Prepayment Button */}
            </div>
          </div>
          <Skeleton className="h-4 w-full sm:w-3/4 rounded" /> {/* Card Description */}
        </div>
        <div className="p-6 pt-0 space-y-6">
          {/* Metric Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shadow-md rounded-xl bg-card p-4">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-5 w-28 rounded" /> {/* Metric Title */}
                  {i === 1 && <CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
                  {i === 2 && <Repeat className="h-4 w-4 text-muted-foreground" />}
                  {i === 3 && <Wallet className="h-4 w-4 text-muted-foreground" />}
                  {i === 4 && <ListChecks className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div>
                  <Skeleton className="h-7 w-3/4 rounded" /> {/* Metric Value */}
                  {i === 4 && <Skeleton className="h-3 w-1/2 mt-1 rounded" />} {/* Sub-text for EMIs Paid */}
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="h-px w-full bg-border rounded" /> {/* Separator */}

          {/* Other Details Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </div>
            ))}
            <div className="md:col-span-2">
                <div className="flex justify-between mb-1">
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <Skeleton className="h-4 w-1/6 rounded" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" /> {/* Progress Bar */}
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Prepayments Card Skeleton */}
      <div className="shadow-lg bg-card rounded-xl">
        <div className="p-6">
          <div className="flex items-center mb-1">
            <ListChecks className="mr-2 h-5 w-5 text-muted-foreground" />
            <Skeleton className="h-6 w-48 rounded" /> {/* Card Title */}
          </div>
          <Skeleton className="h-4 w-full sm:w-2/3 rounded" /> {/* Card Description */}
        </div>
        <div className="p-6 pt-0">
          <div className="border rounded-md">
            {/* Table Skeleton */}
            <div className="w-full">
              {/* Header */}
              <div className="flex border-b">
                <Skeleton className="h-10 flex-1 p-2 md:p-4 rounded-none" />
                <Skeleton className="h-10 flex-1 p-2 md:p-4 rounded-none" />
                <Skeleton className="h-10 flex-1 p-2 md:p-4 rounded-none" />
                <Skeleton className="h-10 w-20 p-2 md:p-4 rounded-none" />
              </div>
              {/* Body Rows */}
              {[1, 2].map((i) => (
                <div key={i} className="flex border-b">
                  <Skeleton className="h-12 flex-1 p-2 md:p-4 rounded-none" />
                  <Skeleton className="h-12 flex-1 p-2 md:p-4 rounded-none" />
                  <Skeleton className="h-12 flex-1 p-2 md:p-4 rounded-none" />
                  <Skeleton className="h-12 w-20 p-2 md:p-4 rounded-none flex items-center justify-center"><Skeleton className="h-8 w-8 rounded"/></Skeleton>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Repayment Schedule Card Skeleton */}
      <div className="shadow-lg bg-card rounded-xl">
        <div className="p-6">
          <Skeleton className="h-6 w-56 mb-1 rounded" /> {/* Card Title */}
          <Skeleton className="h-4 w-full rounded mb-1" /> {/* Card Description Line 1 */}
          <Skeleton className="h-4 w-2/3 rounded" /> {/* Card Description Line 2 */}
        </div>
        <div className="p-6 pt-0">
          <div className="border rounded-md">
            {/* Table Skeleton */}
             <div className="w-full">
              {/* Header */}
              <div className="flex border-b">
                {['w-[50px]', 'flex-1', 'flex-1', 'flex-1', 'flex-1', 'flex-1', 'w-24'].map((w, idx) => (
                    <Skeleton key={idx} className={`h-10 p-2 md:p-4 rounded-none ${w}`} />
                ))}
              </div>
              {/* Body Rows */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex border-b">
                    {['w-[50px]', 'flex-1', 'flex-1', 'flex-1', 'flex-1', 'flex-1', 'w-24'].map((w, idx) => (
                        <Skeleton key={idx} className={`h-12 p-2 md:p-4 rounded-none ${w} ${idx === 6 ? 'flex items-center justify-center' : ''}`}>
                           {idx === 6 && <Skeleton className="h-6 w-16 rounded-full" />}
                        </Skeleton>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
