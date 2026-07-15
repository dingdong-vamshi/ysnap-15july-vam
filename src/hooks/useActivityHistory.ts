import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { historyService, ActivityHistory } from '../services/historyService';
import { queryKeys } from '../lib/queryKeys';
import { useAuth } from '../contexts/AuthContext';

export function useCreateActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activity: Omit<Partial<ActivityHistory>, 'user_id'> & { client_request_id: string; tool: ActivityHistory['tool']; operation_type: string }) => {
      return historyService.createActivity(activity);
    },
    onSuccess: (data) => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.historyList(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.practiceAnalytics(user.id) });
      }
    },
  });
}

export function useActivityHistoryList(options: {
  tool?: ActivityHistory['tool'];
  operation_type?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
} = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.historyList(user?.id, { tool: options.tool, operation_type: options.operation_type }),
    queryFn: () => {
      return historyService.listActivities({
        tool: options.tool,
        operation_type: options.operation_type,
        limit: options.limit,
        offset: options.offset,
      });
    },
    enabled: !!user?.id && (options.enabled ?? true),
  });
}

export function useActivityHistoryDetail(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.historyDetail(id),
    queryFn: () => historyService.getActivity(id),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useUpdateActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<ActivityHistory, 'id' | 'user_id' | 'client_request_id'>> }) => {
      return historyService.updateActivity(id, updates);
    },
    onSuccess: (data) => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.historyList(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.historyDetail(data.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.practiceAnalytics(user.id) });
      }
    },
  });
}

export function useDeleteActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      return historyService.deleteActivity(id);
    },
    onSuccess: (_, deletedId) => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.historyList(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.historyDetail(deletedId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.practiceAnalytics(user.id) });
      }
    },
  });
}
