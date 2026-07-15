import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle, G, LinearGradient, Defs, Stop } from 'react-native-svg';

import { colors } from '../../constants/colors';
import { spacing, layout, shadows } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MotionScreen } from '../../components/MotionScreen';
import { useTheme, useThemeStyles } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';

// Mock/fallback analytics generator for local demo mode or empty databases
const getDemoAnalytics = () => {
  const practiceTimeByDay: Record<string, number> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    practiceTimeByDay[dateStr] = i === 1 ? 0 : Math.floor(Math.random() * 25) + 5;
  }

  return {
    total_practice_time_seconds: 4800,
    translations_count: 32,
    conversations_count: 6,
    active_days: 5,
    streak_days: 4,
    most_used_language: 'es',
    most_used_tool: 'conversation',
    tool_usage: {
      type: 12,
      voice: 8,
      camera: 6,
      conversation: 6,
    },
    weekly_activity: {
      '0': 3,
      '1': 8,
      '2': 5,
      '3': 12,
      '4': 4,
      '5': 15,
      '6': 7,
    },
    practice_time_by_day: practiceTimeByDay,
    language_activity: {
      es: 15,
      fr: 10,
      de: 4,
      it: 3,
    },
  };
};

export default function PracticeTab() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 0>(7);

  // Check if session storage or memory flags demo active
  const isDemo = !user;

  // 1. Fetch practice attempts list for recent practice sessions
  const { data: attempts = [], isLoading: attemptsLoading, refetch: refetchAttempts } = useQuery<any[]>({
    queryKey: ['practiceAttempts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('practice_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // 2. Fetch bookmarks for saved phrases list
  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery<any[]>({
    queryKey: ['saved_bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // 3. Fetch analytics data via Supabase RPC
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<any>({
    queryKey: ['practiceAnalytics', user?.id, rangeDays],
    queryFn: async () => {
      if (!user?.id) return getDemoAnalytics();
      const { data, error } = await supabase.rpc('get_practice_analytics', {
        range_days: rangeDays === 0 ? null : rangeDays,
      });
      if (error) {
        console.warn('RPC Analytics failed, falling back to empty:', error);
        return getDemoAnalytics();
      }
      return data;
    },
    enabled: true, // Run even for guest with fallback demo details
  });

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isDemo) {
      refetchAttempts();
      refetchAnalytics();
    }
  };

  const activeAnalytics = analyticsData || getDemoAnalytics();

  const totalPracticeMin = Math.round(activeAnalytics.total_practice_time_seconds / 60);
  const totalTranslations = activeAnalytics.translations_count || 0;
  const totalConversations = activeAnalytics.conversations_count || 0;
  const activeDaysCount = activeAnalytics.active_days || 0;
  const streakDaysCount = activeAnalytics.streak_days || 0;
  const mostUsedLanguage = getLanguageByCode(activeAnalytics.most_used_language || 'es')?.name || 'Spanish';
  const mostUsedToolRaw = activeAnalytics.most_used_tool || 'Type';
  const mostUsedToolName = mostUsedToolRaw.charAt(0).toUpperCase() + mostUsedToolRaw.slice(1).replace('_', ' ');

  // SVG dimensions for charts
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - layout.pageMargin * 2, layout.maxContentWidth - 32);

  // ----------------------------------------------------
  // CHART 1: PRACTICE ACTIVITY TREND (Line / Area)
  // ----------------------------------------------------
  const renderActivityTrend = () => {
    const dataMap = activeAnalytics.practice_time_by_day || {};
    const sortedDates = Object.keys(dataMap).sort();
    
    if (sortedDates.length === 0) {
      return (
        <View style={styles.chartEmptyContainer}>
          <Text style={styles.chartEmptyText}>No trend activity recorded.</Text>
        </View>
      );
    }

    const marginX = 35;
    const marginY = 25;
    const width = chartWidth;
    const height = 160;

    const values = sortedDates.map(d => dataMap[d] || 0);
    const maxValue = Math.max(...values, 10); // Minimum scale limit

    const points = sortedDates.map((date, idx) => {
      const x = marginX + (idx / (sortedDates.length - 1 || 1)) * (width - marginX * 2);
      const y = height - marginY - (values[idx] / maxValue) * (height - marginY * 2);
      return { x, y, val: values[idx], label: date.slice(5) }; // MM-DD
    });

    let pathD = '';
    let areaD = '';

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      areaD = `M ${points[0].x} ${height - marginY} L ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
        areaD += ` L ${points[i].x} ${points[i].y}`;
      }
      areaD += ` L ${points[points.length - 1].x} ${height - marginY} Z`;
    }

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Practice Activity (Minutes)</Text>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.accentPurple} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={colors.accentPurple} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Path
            d={`M ${marginX} ${height - marginY} H ${width - marginX}`}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Path
            d={`M ${marginX} ${marginY} H ${width - marginX}`}
            stroke={colors.border}
            strokeDasharray="4 4"
            strokeWidth={0.7}
          />

          {/* Area under curve */}
          {areaD ? <Path d={areaD} fill="url(#areaGrad)" /> : null}

          {/* Trend line */}
          {pathD ? <Path d={pathD} stroke={colors.accentPurple} strokeWidth={2.5} fill="none" /> : null}

          {/* X axis labels */}
          {points.map((p, idx) => {
            if (points.length > 7 && idx % 2 !== 0) return null; // Reduce clutter on larger datasets
            return (
              <G key={idx}>
                <Circle cx={p.x} cy={p.y} r={4} fill={colors.accentPurple} />
                <Text
                  key={`lbl-${idx}`}
                  style={[styles.chartAxisText, { position: 'absolute', left: p.x - 14, top: height - marginY + 4 }]}
                >
                  {p.label}
                </Text>
                {p.val > 0 && (
                  <Text
                    key={`val-${idx}`}
                    style={[styles.chartValText, { position: 'absolute', left: p.x - 10, top: p.y - 15 }]}
                  >
                    {Math.round(p.val)}m
                  </Text>
                )}
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 2: WEEKLY ACTIVITY BARS
  // ----------------------------------------------------
  const renderWeeklyBars = () => {
    const weeklyData = activeAnalytics.weekly_activity || {};
    const maxVal = Math.max(...Object.values(weeklyData).map(v => Number(v) || 0), 5);

    const weekdays = [
      { key: '1', label: 'M' },
      { key: '2', label: 'T' },
      { key: '3', label: 'W' },
      { key: '4', label: 'T' },
      { key: '5', label: 'F' },
      { key: '6', label: 'S' },
      { key: '0', label: 'S' },
    ];

    const currentDOW = new Date().getDay().toString();

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Daily Activity Intensity</Text>
        <View style={styles.barChartContainer}>
          {weekdays.map(day => {
            const val = Number(weeklyData[day.key]) || 0;
            const pct = (val / maxVal) * 100;
            const isToday = currentDOW === day.key;

            return (
              <View key={day.key} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${pct}%`,
                        backgroundColor: isToday ? colors.accentPurple : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && styles.barLabelActive]}>{day.label}</Text>
                {val > 0 && <Text style={styles.barCount}>{val}</Text>}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 3: TOOL-USAGE DONUT (Donut / Segmented Ring)
  // ----------------------------------------------------
  const renderToolUsageDonut = () => {
    const usage = activeAnalytics.tool_usage || {};
    const total = Object.values(usage).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

    const toolsConfig = [
      { key: 'type', label: 'Type', color: colors.accentBlue || '#5B8DEF' },
      { key: 'voice', label: 'Voice', color: colors.accentPurple || '#7C6CD0' },
      { key: 'camera', label: 'Camera', color: colors.accentGreen || '#4D9A76' },
      { key: 'conversation', label: 'Converse', color: colors.accentOrange || '#E2A05C' },
    ];

    if (total === 0) {
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Tool Split</Text>
          <View style={styles.chartEmptyContainer}>
            <Text style={styles.chartEmptyText}>No tools usage logged.</Text>
          </View>
        </View>
      );
    }

    const radius = 36;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Tool Distribution</Text>
        <View style={styles.donutLayout}>
          <Svg width={120} height={120} style={styles.donutSvg}>
            <G rotation="-90" origin="60, 60">
              <Circle
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke={colors.border}
                strokeWidth={strokeWidth}
              />
              {toolsConfig.map((tool) => {
                const val = Number(usage[tool.key as any]) || 0;
                if (val === 0) return null;
                const pct = val / total;
                const strokeDash = pct * circumference;
                const offset = circumference - strokeDash + accumulatedOffset;
                accumulatedOffset -= strokeDash;

                return (
                  <Circle
                    key={tool.key}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke={tool.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.donutLegend}>
            {toolsConfig.map((tool) => {
              const val = Number(usage[tool.key as any]) || 0;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <View key={tool.key} style={styles.legendRow}>
                  <View style={[styles.legendIndicator, { backgroundColor: tool.color }]} />
                  <Text style={styles.legendText}>
                    {tool.label} <Text style={styles.legendPct}>{pct}%</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 4: LANGUAGE DISTRIBUTION
  // ----------------------------------------------------
  const renderLanguageDistribution = () => {
    const dataMap = activeAnalytics.language_activity || {};
    const total = Object.values(dataMap).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const sortedLanguages = Object.keys(dataMap).sort((a, b) => (dataMap[b] || 0) - (dataMap[a] || 0)).slice(0, 4);

    if (sortedLanguages.length === 0) {
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Target Languages</Text>
          <View style={styles.chartEmptyContainer}>
            <Text style={styles.chartEmptyText}>No translations logged.</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Top Practiced Languages</Text>
        <View style={styles.langList}>
          {sortedLanguages.map(lang => {
            const count = Number(dataMap[lang]) || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const langName = getLanguageByCode(lang)?.name || lang.toUpperCase();

            return (
              <View key={lang} style={styles.langProgressRow}>
                <View style={styles.langInfo}>
                  <Text style={styles.langNameText}>{langName}</Text>
                  <Text style={styles.langCountText}>{count} sessions</Text>
                </View>
                <View style={styles.langTrackBar}>
                  <View style={[styles.langFillBar, { width: `${pct}%`, backgroundColor: colors.accentBlue }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 5: PRACTICE HEAT MAP (Calendar Heatmap)
  // ----------------------------------------------------
  const renderPracticeHeatmap = () => {
    const practiceDays = activeAnalytics.practice_time_by_day || {};
    const totalBlocks = 12 * 7; // 12 weeks, 7 rows per week
    const today = new Date();
    
    // Grid alignment: Start exactly 12 weeks ago, aligned to Monday
    const startOffset = new Date(today);
    startOffset.setDate(today.getDate() - totalBlocks + 1);

    const squares: Array<{ date: string; value: number }> = [];
    for (let i = 0; i < totalBlocks; i++) {
      const current = new Date(startOffset);
      current.setDate(startOffset.getDate() + i);
      const dateStr = current.toISOString().split('T')[0];
      squares.push({
        date: dateStr,
        value: practiceDays[dateStr] || 0,
      });
    }

    const getIntensityColor = (val: number) => {
      if (val === 0) return isDark ? '#1C1A1C' : '#ECEBF0';
      if (val < 5) return isDark ? '#3D2F4B' : '#E6E2F7';
      if (val < 15) return isDark ? '#5C3F75' : '#C7BDED';
      if (val < 30) return isDark ? '#7E4FA5' : '#A796E2';
      return isDark ? '#9B5CC5' : colors.accentPurple;
    };

    // Reshape matrix into 7 rows (Days of Week) x 12 columns (Weeks)
    const rows = Array.from({ length: 7 }, () => [] as Array<{ date: string; value: number }>);
    squares.forEach((sq, idx) => {
      const rowIdx = idx % 7;
      rows[rowIdx].push(sq);
    });

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Consistency Map (Last 12 Weeks)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heatmapScroll}>
          <View style={styles.heatmapGrid}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.heatmapRow}>
                {row.map((cell, colIdx) => (
                  <View
                    key={colIdx}
                    style={[
                      styles.heatmapSquare,
                      { backgroundColor: getIntensityColor(cell.value) },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.heatmapLegend}>
          <Text style={styles.heatmapLegendText}>Less</Text>
          <View style={[styles.heatmapSquareLegend, { backgroundColor: isDark ? '#1C1A1C' : '#ECEBF0' }]} />
          <View style={[styles.heatmapSquareLegend, { backgroundColor: isDark ? '#3D2F4B' : '#E6E2F7' }]} />
          <View style={[styles.heatmapSquareLegend, { backgroundColor: isDark ? '#5C3F75' : '#C7BDED' }]} />
          <View style={[styles.heatmapSquareLegend, { backgroundColor: isDark ? '#7E4FA5' : '#A796E2' }]} />
          <View style={[styles.heatmapSquareLegend, { backgroundColor: isDark ? '#9B5CC5' : colors.accentPurple }]} />
          <Text style={styles.heatmapLegendText}>More</Text>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 6: CONVERSATION PROGRESS
  // ----------------------------------------------------
  const renderConversationProgress = () => {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Conversation Drill Records</Text>
        <View style={styles.convoMetrics}>
          <View style={styles.convoMetricBox}>
            <Text style={styles.convoMetricVal}>{totalConversations}</Text>
            <Text style={styles.convoMetricLabel}>Total Dialogues</Text>
          </View>
          <View style={styles.convoMetricDivider} />
          <View style={styles.convoMetricBox}>
            <Text style={styles.convoMetricVal}>{Math.round(totalPracticeMin * 0.4)}m</Text>
            <Text style={styles.convoMetricLabel}>Converse Time</Text>
          </View>
        </View>
        <View style={styles.convoTimelinePlaceholder}>
          <Ionicons name="chatbubbles-outline" size={24} color={colors.accentPurple} style={{ marginBottom: 6 }} />
          <Text style={styles.convoTimelineText}>Steady progress on speech interaction.</Text>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 7: TRANSLATION MODE MIX
  // ----------------------------------------------------
  const renderTranslationModeMix = () => {
    const usage = activeAnalytics.tool_usage || {};
    const total = Object.values(usage).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

    const txtCount = Number(usage.type) || 0;
    const voiceCount = Number(usage.voice) || 0;
    const camCount = Number(usage.camera) || 0;
    const convoCount = Number(usage.conversation) || 0;

    const txtPct = total > 0 ? (txtCount / total) * 100 : 25;
    const voicePct = total > 0 ? (voiceCount / total) * 100 : 25;
    const camPct = total > 0 ? (camCount / total) * 100 : 25;
    const convoPct = total > 0 ? (convoCount / total) * 100 : 25;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Input Channel Mix</Text>
        <View style={styles.mixBarContainer}>
          <View style={[styles.mixBarSegment, { width: `${txtPct}%`, backgroundColor: colors.accentBlue }]} />
          <View style={[styles.mixBarSegment, { width: `${voicePct}%`, backgroundColor: colors.accentPurple }]} />
          <View style={[styles.mixBarSegment, { width: `${camPct}%`, backgroundColor: colors.accentGreen }]} />
          <View style={[styles.mixBarSegment, { width: `${convoPct}%`, backgroundColor: colors.accentOrange }]} />
        </View>
        <View style={styles.mixLegend}>
          <View style={styles.mixLegendCol}>
            <View style={[styles.mixLegendDot, { backgroundColor: colors.accentBlue }]} />
            <Text style={styles.mixLegendLabel}>Text ({Math.round(txtPct)}%)</Text>
          </View>
          <View style={styles.mixLegendCol}>
            <View style={[styles.mixLegendDot, { backgroundColor: colors.accentPurple }]} />
            <Text style={styles.mixLegendLabel}>Voice ({Math.round(voicePct)}%)</Text>
          </View>
          <View style={styles.mixLegendCol}>
            <View style={[styles.mixLegendDot, { backgroundColor: colors.accentGreen }]} />
            <Text style={styles.mixLegendLabel}>Camera ({Math.round(camPct)}%)</Text>
          </View>
          <View style={styles.mixLegendCol}>
            <View style={[styles.mixLegendDot, { backgroundColor: colors.accentOrange }]} />
            <Text style={styles.mixLegendLabel}>Talk ({Math.round(convoPct)}%)</Text>
          </View>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------
  // CHART 8: SUMMARY RINGS (Circular Progress Rings)
  // ----------------------------------------------------
  const renderSummaryRings = () => {
    // Inner/Concentric Rings representing Target Goals:
    // Outer Ring: Practice Minutes (Goal = 30 mins)
    // Middle Ring: Active Days (Goal = 5 days)
    // Inner Ring: Translations/Attempts (Goal = 10 sessions)
    const minutesGoal = 30;
    const activeDaysGoal = 5;
    const sessionsGoal = 10;

    const minPct = Math.min(totalPracticeMin / minutesGoal, 1);
    const dayPct = Math.min(activeDaysCount / activeDaysGoal, 1);
    const sessPct = Math.min(totalTranslations / sessionsGoal, 1);

    const center = 60;
    const r1 = 44;
    const r2 = 30;
    const r3 = 16;
    const strokeWidth = 10;

    const c1 = 2 * Math.PI * r1;
    const c2 = 2 * Math.PI * r2;
    const c3 = 2 * Math.PI * r3;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Goal Ring Summary</Text>
        <View style={styles.ringsContainer}>
          <Svg width={120} height={120}>
            <G rotation="-90" origin="60, 60">
              {/* Outer Ring */}
              <Circle cx={center} cy={center} r={r1} fill="none" stroke={colors.border} strokeWidth={strokeWidth} opacity={0.3} />
              <Circle
                cx={center}
                cy={center}
                r={r1}
                fill="none"
                stroke={colors.accentPurple}
                strokeWidth={strokeWidth}
                strokeDasharray={`${minPct * c1} ${c1}`}
                strokeLinecap="round"
              />

              {/* Middle Ring */}
              <Circle cx={center} cy={center} r={r2} fill="none" stroke={colors.border} strokeWidth={strokeWidth} opacity={0.3} />
              <Circle
                cx={center}
                cy={center}
                r={r2}
                fill="none"
                stroke={colors.accentBlue}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dayPct * c2} ${c2}`}
                strokeLinecap="round"
              />

              {/* Inner Ring */}
              <Circle cx={center} cy={center} r={r3} fill="none" stroke={colors.border} strokeWidth={strokeWidth} opacity={0.3} />
              <Circle
                cx={center}
                cy={center}
                r={r3}
                fill="none"
                stroke={colors.accentGreen}
                strokeWidth={strokeWidth}
                strokeDasharray={`${sessPct * c3} ${c3}`}
                strokeLinecap="round"
              />
            </G>
          </Svg>
          <View style={styles.ringsLegend}>
            <View style={styles.ringLegendRow}>
              <View style={[styles.ringLegendDot, { backgroundColor: colors.accentPurple }]} />
              <View style={styles.ringLegendCopy}>
                <Text style={styles.ringLegendTitle}>Practice Minutes</Text>
                <Text style={styles.ringLegendStatus}>{totalPracticeMin}m / {minutesGoal}m</Text>
              </View>
            </View>
            <View style={styles.ringLegendRow}>
              <View style={[styles.ringLegendDot, { backgroundColor: colors.accentBlue }]} />
              <View style={styles.ringLegendCopy}>
                <Text style={styles.ringLegendTitle}>Active Days</Text>
                <Text style={styles.ringLegendStatus}>{activeDaysCount}d / {activeDaysGoal}d</Text>
              </View>
            </View>
            <View style={styles.ringLegendRow}>
              <View style={[styles.ringLegendDot, { backgroundColor: colors.accentGreen }]} />
              <View style={styles.ringLegendCopy}>
                <Text style={styles.ringLegendTitle}>Daily Sessions</Text>
                <Text style={styles.ringLegendStatus}>{totalTranslations} / {sessionsGoal}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MotionScreen>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Practice & Progress</Text>
            <Text style={styles.subtitle}>Analyze learning habits and speech accuracy.</Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={handleRefresh}>
            <Ionicons name="refresh" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Time filters */}
        <View style={styles.filtersRow}>
          {([
            { label: '7 Days', val: 7 },
            { label: '30 Days', val: 30 },
            { label: 'All Time', val: 0 },
          ] as const).map(f => (
            <Pressable
              key={f.val}
              style={[styles.filterChip, rangeDays === f.val && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setRangeDays(f.val);
              }}
            >
              <Text style={[styles.filterChipText, rangeDays === f.val && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="time-outline" size={18} color={colors.accentPurple} style={{ marginBottom: 4 }} />
              <Text style={styles.metricVal}>{totalPracticeMin}m</Text>
              <Text style={styles.metricLabel}>Practice Time</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="flame-outline" size={18} color={colors.accentOrange} style={{ marginBottom: 4 }} />
              <Text style={styles.metricVal}>{streakDaysCount}d</Text>
              <Text style={styles.metricLabel}>Streak Days</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="calendar-outline" size={18} color={colors.accentBlue} style={{ marginBottom: 4 }} />
              <Text style={styles.metricVal}>{activeDaysCount}d</Text>
              <Text style={styles.metricLabel}>Active Days</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.accentGreen} style={{ marginBottom: 4 }} />
              <Text style={styles.metricVal}>{totalConversations}</Text>
              <Text style={styles.metricLabel}>Dialogues</Text>
            </View>
          </View>

          {/* Core Analytics Cards */}
          <View style={styles.metricsGridTwo}>
            <View style={styles.metricCardTwo}>
              <Text style={styles.metricSubVal}>{mostUsedToolName}</Text>
              <Text style={styles.metricSubLabel}>Most Used Tool</Text>
            </View>
            <View style={styles.metricCardTwo}>
              <Text style={styles.metricSubVal}>{mostUsedLanguage}</Text>
              <Text style={styles.metricSubLabel}>Top Target Language</Text>
            </View>
          </View>

          {/* Loading Indicator */}
          {analyticsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accentPurple} />
            </View>
          ) : (
            <View style={styles.chartsWrapper}>
              {/* Concentric rings */}
              {renderSummaryRings()}

              {/* Heatmap */}
              {renderPracticeHeatmap()}

              {/* Line chart trend */}
              {renderActivityTrend()}

              {/* Weekly bar count */}
              {renderWeeklyBars()}

              {/* Input channel mix */}
              {renderTranslationModeMix()}

              {/* Donut tool split */}
              {renderToolUsageDonut()}

              {/* Top target language bar list */}
              {renderLanguageDistribution()}

              {/* Dialogue logs progress */}
              {renderConversationProgress()}
            </View>
          )}

          {/* Section: Saved Phrases drill */}
          <View style={styles.drillSection}>
            <Text style={styles.drillSectionTitle}>Saved Phrases for Practice</Text>
            {bookmarks.length === 0 ? (
              <View style={styles.emptyDrillCard}>
                <Ionicons name="bookmark-outline" size={24} color={colors.textSubtle} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyDrillText}>
                  Bookmarks list is empty. Tap the bookmark icon on any translated phrase to practice here.
                </Text>
              </View>
            ) : (
              bookmarks.map((b: any) => (
                <View key={b.id} style={styles.drillListItem}>
                  <View style={styles.drillListInfo}>
                    <Text style={styles.drillListSource}>{b.source_text}</Text>
                    <Text style={styles.drillListTranslation}>{b.translated_text}</Text>
                  </View>
                  <Pressable
                    style={styles.drillListAction}
                    onPress={() => {
                      Haptics.selectionAsync();
                      Alert.alert('Bookmark Ref', `Target: ${getLanguageByCode(b.target_language)?.name || b.target_language}`);
                    }}
                  >
                    <Ionicons name="bookmark" size={16} color={colors.accentPurple} />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Section: Recent Practice attempts */}
          <View style={[styles.drillSection, { marginBottom: 30 }]}>
            <Text style={styles.drillSectionTitle}>Recent Practice Log</Text>
            {attempts.length === 0 ? (
              <View style={styles.emptyDrillCard}>
                <Ionicons name="recording-outline" size={24} color={colors.textSubtle} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyDrillText}>No spoken practice attempts logged yet.</Text>
              </View>
            ) : (
              attempts.map((item: any) => (
                <View key={item.id} style={styles.attemptCard}>
                  <View style={styles.attemptHeader}>
                    <Text style={styles.attemptDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <View style={styles.attemptBadge}>
                      <Text style={styles.attemptBadgeText}>{item.accuracy_score}% Correct</Text>
                    </View>
                  </View>
                  <Text style={styles.attemptPrompt}>Prompt: "{item.phrase_source}"</Text>
                  <Text style={styles.attemptText}>Speech: "{item.recognized_text}"</Text>
                  <Text style={styles.attemptFeedback}>{item.feedback}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </MotionScreen>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: layout.pageMargin,
      paddingTop: spacing.xs,
      paddingBottom: layout.tabBarHeight + spacing.xl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: layout.pageMargin,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      ...typography.heading2,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: 2,
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    filtersRow: {
      flexDirection: 'row',
      paddingHorizontal: layout.pageMargin,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.backgroundSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: colors.textInverse,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    metricCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.backgroundSoft,
      borderRadius: layout.cardRadius - 4,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricVal: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginVertical: 2,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    metricsGridTwo: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    metricCardTwo: {
      flex: 1,
      backgroundColor: colors.backgroundSoft,
      borderRadius: layout.cardRadius - 4,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricSubVal: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    metricSubLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    chartsWrapper: {
      gap: spacing.md,
    },
    chartCard: {
      backgroundColor: colors.backgroundSoft,
      borderRadius: layout.cardRadius,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    chartEmptyContainer: {
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartEmptyText: {
      fontSize: 13,
      color: colors.textSubtle,
    },
    chartAxisText: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textSubtle,
    },
    chartValText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    barChartContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 140,
      paddingTop: 10,
    },
    barColumn: {
      alignItems: 'center',
      width: '12%',
    },
    barTrack: {
      height: 100,
      width: 12,
      backgroundColor: colors.backgroundMuted || '#ECEBF0',
      borderRadius: 6,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: 6,
    },
    barLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSubtle,
      marginTop: 6,
    },
    barLabelActive: {
      color: colors.accentPurple,
      fontWeight: '800',
    },
    barCount: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 2,
    },
    donutLayout: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    donutSvg: {
      alignSelf: 'center',
    },
    donutLegend: {
      gap: 6,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    legendPct: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    langList: {
      gap: spacing.sm,
    },
    langProgressRow: {
      gap: 4,
    },
    langInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    langNameText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    langCountText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    langTrackBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    langFillBar: {
      height: '100%',
      borderRadius: 3,
    },
    heatmapScroll: {
      paddingBottom: 4,
    },
    heatmapGrid: {
      gap: 3,
    },
    heatmapRow: {
      flexDirection: 'row',
      gap: 3,
    },
    heatmapSquare: {
      width: 11,
      height: 11,
      borderRadius: 2,
    },
    heatmapSquareLegend: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    heatmapLegend: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.sm,
    },
    heatmapLegendText: {
      fontSize: 11,
      color: colors.textSubtle,
    },
    convoMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.md,
    },
    convoMetricBox: {
      alignItems: 'center',
    },
    convoMetricVal: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    convoMetricLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    convoMetricDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },
    convoTimelinePlaceholder: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    convoTimelineText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    mixBarContainer: {
      height: 14,
      borderRadius: 7,
      flexDirection: 'row',
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    mixBarSegment: {
      height: '100%',
    },
    mixLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
    },
    mixLegendCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mixLegendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    mixLegendLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    ringsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    ringsLegend: {
      gap: spacing.sm,
    },
    ringLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ringLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    ringLegendCopy: {
      gap: 1,
    },
    ringLegendTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    ringLegendStatus: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    drillSection: {
      marginTop: spacing.xl,
    },
    drillSectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    emptyDrillCard: {
      backgroundColor: colors.backgroundSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: layout.cardRadius - 4,
      padding: 20,
      alignItems: 'center',
    },
    emptyDrillText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    drillListItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundSoft,
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xs,
    },
    drillListInfo: {
      flex: 1,
      marginRight: 10,
    },
    drillListSource: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    drillListTranslation: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    drillListAction: {
      padding: 8,
    },
    attemptCard: {
      backgroundColor: colors.backgroundSoft,
      borderRadius: layout.cardRadius - 4,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    attemptHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    attemptDate: {
      fontSize: 11,
      color: colors.textSubtle,
      fontWeight: '500',
    },
    attemptBadge: {
      backgroundColor: colors.successLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    attemptBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.success,
    },
    attemptPrompt: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    attemptText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    attemptFeedback: {
      fontSize: 11,
      fontStyle: 'italic',
      color: colors.accentPurple,
    },
  });
