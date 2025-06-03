
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
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Mail,
  Bell,
  Loader2,
  Landmark,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan } from '@/types';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loans', label: 'Loans', icon: Landmark },
];

const generalItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');

  const [allLoansForSuggestions, setAllLoansForSuggestions] = useState<Pick<Loan, 'id' | 'name'>[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsContainerRef = useRef<HTMLUListElement>(null);


  useEffect(() => {
    if (pathname === '/loans') {
      setSearchTerm(searchParams.get('search') || '');
    }
  }, [pathname, searchParams]);

  // Fetch all loans for suggestions
  useEffect(() => {
    if (!user) {
      setAllLoansForSuggestions([]);
      return;
    }
    const loansCol = collection(db, `users/${user.uid}/loans`);
    const q = query(loansCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userLoans = snapshot.docs.map(doc => ({ id: doc.id, name: (doc.data() as { name: string }).name }));
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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Redirecting to login...</p>
      </div>
    );
  }

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  const handleSearch = () => {
    const trimmedSearchTerm = searchTerm.trim();
    setShowSuggestions(false);
    if (trimmedSearchTerm) {
      router.push(`/loans?search=${encodeURIComponent(trimmedSearchTerm)}`);
    } else {
      router.push('/loans');
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() && filteredSuggestions.length > 0) { // Check filteredSuggestions based on new value
      setShowSuggestions(true);
    } else if (!value.trim()){
      setShowSuggestions(false);
    }
    setActiveSuggestionIndex(-1);
  };
  
  useEffect(() => {
    if (searchTerm.trim() && filteredSuggestions.length > 0 && document.activeElement === searchInputRef.current) {
      setShowSuggestions(true);
    } else if (!searchTerm.trim()) {
      setShowSuggestions(false);
    }
  }, [searchTerm, filteredSuggestions]);


  const handleSuggestionClick = (suggestionName: string) => {
    setSearchTerm(suggestionName);
    setShowSuggestions(false);
    router.push(`/loans?search=${encodeURIComponent(suggestionName)}`);
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
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionsContainerRef.current) {
      const selectedItem = suggestionsContainerRef.current.children[activeSuggestionIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggestionIndex]);

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
                      isActive={pathname === item.href || (item.href === "/loans" && pathname.startsWith("/loans"))}
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
            <span className="px-3 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">General</span>
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
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip={{ children: 'Logout', side: 'right', align: 'center' }}>
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="relative hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search loans by name..."
                    className="pl-10 pr-4 h-10 w-64 lg:w-96"
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
                    className="absolute z-50 mt-1 w-64 lg:w-96 rounded-md border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-y-auto"
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
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Mail className="h-5 w-5" />
                <span className="sr-only">Messages</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.photoURL || `https://placehold.co/40x40.png`} alt={user?.displayName || 'User'} />
                  <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col text-xs">
                  <span className="font-semibold text-foreground">{user?.displayName || user?.email?.split('@')[0]}</span>
                  <span className="text-muted-foreground">{user?.email}</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
