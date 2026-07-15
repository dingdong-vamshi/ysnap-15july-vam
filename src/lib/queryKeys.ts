export const queryKeys = {
  profile: (userId?: string) => ['profile', userId] as const,
  preferences: (userId?: string) => ['preferences', userId] as const,
  historyList: (userId?: string, filters?: { tool?: string; operation_type?: string }) => 
    ['historyList', userId, filters] as const,
  historyDetail: (id: string) => ['historyDetail', id] as const,
  practiceAnalytics: (userId?: string, rangeDays?: number) => ['practiceAnalytics', userId, rangeDays] as const,
  practiceAttempts: (userId?: string) => ['practiceAttempts', userId] as const,
  savedBookmarks: (userId?: string) => ['saved_bookmarks', userId] as const,
};
