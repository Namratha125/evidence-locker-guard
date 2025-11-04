import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SearchFilters {
  query: string;
  status: string;
  priority: string;
  assignedTo: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  type: 'cases' | 'evidence';
  caseId?: string;
  tagId?: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  type: 'cases' | 'evidence';
  users?: Array<{ id: string; full_name: string }>;
  cases?: Array<{ id: string; case_number: string; title: string }>;
  tags?: Array<{ id: string; name: string; color: string }>;
}

export default function AdvancedSearch({ onSearch, type, users = [], cases = [], tags = [] }: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: 'all',
    priority: 'all',
    assignedTo: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    type,
    caseId: 'all',
    tagId: 'all',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearch = () => {
    onSearch(filters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      query: '',
      status: 'all',
      priority: 'all',
      assignedTo: 'all',
      dateFrom: undefined,
      dateTo: undefined,
      type,
      caseId: 'all',
      tagId: 'all',
    };
    setFilters(clearedFilters);
    onSearch(clearedFilters);
  };

  const hasActiveFilters = (filters.status && filters.status !== 'all') || (filters.priority && filters.priority !== 'all') || (filters.assignedTo && filters.assignedTo !== 'all') || (filters.caseId && filters.caseId !== 'all') || (filters.tagId && filters.tagId !== 'all') || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder={`Search ${type}...`}
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} size="sm">
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Less' : 'More'} Filters
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {type === 'cases' && (
                <>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </>
              )}
              {type === 'evidence' && (
                <>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          {type === 'cases' && (
            <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          )}

          {type === 'cases' && users.length > 0 && (
            <Select value={filters.assignedTo} onValueChange={(value) => setFilters({ ...filters, assignedTo: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {type === 'evidence' && cases.length > 0 && (
            <Select value={filters.caseId || 'all'} onValueChange={(value) => setFilters({ ...filters, caseId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Case" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases</SelectItem>
                {cases.map((case_) => (
                  <SelectItem key={case_.id} value={case_.id}>
                    {case_.case_number} - {case_.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {type === 'evidence' && tags.length > 0 && (
            <Select value={filters.tagId || 'all'} onValueChange={(value) => setFilters({ ...filters, tagId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, "PPP") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => {
                    if (date) {
                      // Set to start of day
                      date.setHours(0, 0, 0, 0);
                    }
                    setFilters({ ...filters, dateFrom: date });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, "PPP") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => {
                    if (date) {
                      // Set to end of day
                      date.setHours(23, 59, 59, 999);
                    }
                    setFilters({ ...filters, dateTo: date });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}