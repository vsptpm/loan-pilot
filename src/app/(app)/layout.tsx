
'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { SiteLogo } from '@/components/core/SiteLogo';
import { ThemeToggle } from '@/components/core/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Loader2,
  Landmark,
  Calculator, 
  NotebookPen,
  Lightbulb,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'; // Added Suspense
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan } from '@/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loans', label: 'Loans', icon: Landmark },
  { href: '/prepayment-simulator', label: 'Prepayment Simulator', icon: Calculator },
  { href: '/emi-calculator', label: 'EMI Calculator', icon: NotebookPen },
  { href: '/what-if-analyzer', label: 'What-if Analyzer', icon: Lightbulb },
  { href: '/loan-comparison', label: 'Loan Comparison', icon: Scale },
];

const generalItems = [
  { href: '/help', label: 'Help', icon: HelpCircle },
];

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-12rem)]"> {/* Adjusted height */}
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-3 text-muted-foreground">Loading content...</p>
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // All hooks are called unconditionally at the top
  const { user, loading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams(); // This hook needs Suspense
  const [searchTerm, setSearchTerm] = useState('');

  const [allLoansForSuggestions, setAllLoansForSuggestions] = useState<Pick<Loan, 'id' | 'name'>[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsContainerRef = useRef<HTMLUListElement>(null);
  const justSearchedRef = useRef(false);


  // Fetch all loans for suggestions
  useEffect(() => {
    if (!user) {
      setAllLoansForSuggestions([]);
      return;
    }
    const loansCol = collection(db, `users/${user.uid}/loans`);
    const q = query(loansCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userLoans = snapshot.docs.map(docSnap => ({ id: docSnap.id, name: (docSnap.data() as { name: string }).name }));
      setAllLoansForSuggestions(userLoans);
    }, (error) => {
      console.error("Error fetching loans for suggestions: ", error);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }
    return allLoansForSuggestions
      .filter(loan => loan.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 5); // Limit suggestions
  }, [searchTerm, allLoansForSuggestions]);

  // Effect for clicking outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchInputRef.current && !searchInputRef.current.contains(event.target as Node) &&
        suggestionsContainerRef.current && !suggestionsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionsContainerRef.current) {
      const selectedItem = suggestionsContainerRef.current.children[activeSuggestionIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggestionIndex]);

  useEffect(() => {
    const searchWasJustPerformed = justSearchedRef.current;
    if (justSearchedRef.current) {
      justSearchedRef.current = false;
    }
  
    if (!searchWasJustPerformed) {
      if (pathname === '/loans') {
        setSearchTerm(searchParams.get('search') || '');
      } else {
        setSearchTerm('');
      }
    }
  }, [pathname, searchParams]);


  useEffect(() => {
    if (searchTerm.trim() && filteredSuggestions.length > 0 && document.activeElement === searchInputRef.current) {
      setShowSuggestions(true);
    } else if (!searchTerm.trim() && showSuggestions) { 
      setShowSuggestions(false);
    }
  }, [searchTerm, filteredSuggestions, showSuggestions]);


  // Conditional rendering logic now happens after all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // This case should ideally be handled by AuthProvider redirecting,
    // but as a fallback, show loading or a redirect message.
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Redirecting to login...</p>
      </div>
    );
  }

  const getInitials = (nameOrEmail?: string | null) => {
    if (!nameOrEmail) return 'U';
    if (nameOrEmail.includes('@') && nameOrEmail.split(' ').length === 1) { // Check if it's likely an email
      return nameOrEmail.substring(0, 2).toUpperCase();
    }
    // Assume it's a name
    const names = nameOrEmail.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
  };


  const handleSearch = () => {
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm) {
      router.push(`/loans?search=${encodeURIComponent(trimmedSearchTerm)}`);
    } else {
      router.push('/loans');
    }
    justSearchedRef.current = true;
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    const currentFiltered = allLoansForSuggestions
      .filter(loan => loan.name.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);

    if (value.trim() && currentFiltered.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    setActiveSuggestionIndex(-1);
  };
  

  const handleSuggestionClick = (suggestionName: string) => {
    router.push(`/loans?search=${encodeURIComponent(suggestionName)}`);
    justSearchedRef.current = true;
    setSearchTerm('');
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleSearchFocus = () => {
    if (searchTerm.trim() && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
          handleSuggestionClick(filteredSuggestions[activeSuggestionIndex].name);
        } else {
          handleSearch();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <SiteLogo />
        </SidebarHeader>
        <SidebarContent className="flex-1 p-2">
          <SidebarGroup>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} legacyBehavior passHref>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || (item.href === "/loans" && pathname.startsWith("/loans")) || (item.href === "/prepayment-simulator" && pathname === "/prepayment-simulator") || (item.href === "/emi-calculator" && pathname === "/emi-calculator") || (item.href === "/what-if-analyzer" && pathname === "/what-if-analyzer") || (item.href === "/loan-comparison" && pathname === "/loan-comparison")}
                      tooltip={{ children: item.label, side: 'right', align: 'center' }}
                    >
                      <a>
                        <item.icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarMenu>
              {generalItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} legacyBehavior passHref>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={{ children: item.label, side: 'right', align: 'center' }}
                    >
                      <a>
                        <item.icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center gap-x-4 px-4 md:px-8">
            
            <SidebarTrigger className="md:hidden flex-shrink-0" />

            <div className="relative flex-grow">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search loans by name..."
                  className="pl-10 pr-4 h-10 w-full"
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={handleSearchFocus}
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions && filteredSuggestions.length > 0}
                  aria-controls="suggestions-listbox"
                  aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>F
                </kbd>
              </div>

              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul
                  ref={suggestionsContainerRef}
                  id="suggestions-listbox"
                  className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-y-auto"
                  role="listbox"
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`suggestion-${index}`}
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                      className={cn(
                        "px-3 py-2 text-sm cursor-pointer hover:bg-accent focus:bg-accent outline-none",
                        index === activeSuggestionIndex && "bg-accent"
                      )}
                      onMouseDown={() => handleSuggestionClick(suggestion.name)} 
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                    >
                      {suggestion.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              <ThemeToggle />
              <AlertDialog>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                        <AvatarFallback>{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                      </Avatar>
                       <span className="sr-only">Open user menu</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                        <AvatarFallback className="text-xl bg-muted">{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {user?.displayName || user?.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <Link href="/settings" legacyBehavior passHref>
                       <Button variant="ghost" className="w-full justify-start text-sm h-auto py-1.5 px-2">
                          <Settings className="mr-2 h-4 w-4" /> Account Settings
                       </Button>
                    </Link>
                    <AlertDialogTrigger asChild>
                     <Button variant="ghost" className="w-full justify-start text-sm text-destructive hover:text-destructive hover:bg-destructive/10 h-auto py-1.5 px-2">
                          <LogOut className="mr-2 h-4 w-4" /> Logout
                     </Button>
                    </AlertDialogTrigger>
                  </PopoverContent>
                </Popover>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to log out of LoanPilot?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={signOut} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Suspense fallback={<PageLoadingFallback />}>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

