import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ActionItemCardProps {
  title?: string;
  tasks: TaskItem[];
  onToggleTask?: (id: string) => void;
  style?: ViewStyle;
}

export const ActionItemCard: React.FC<ActionItemCardProps> = ({
  title = 'Action Items',
  tasks,
  onToggleTask,
  style,
}) => {
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);

  const handleToggle = (id: string) => {
    triggerHaptic('light');
    
    // Toggle locally for instant UI update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );

    if (onToggleTask) {
      onToggleTask(id);
    }
  };

  if (!localTasks || localTasks.length === 0) return null;

  return (
    <View style={[styles.card, style]}>
      {/* Title */}
      <View style={styles.header}>
        <Feather name="check-square" size={18} color={colors.accentGreen} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.divider} />

      {/* Task lines */}
      <View style={styles.taskList}>
        {localTasks.map((task) => {
          const isInteractive = !!onToggleTask;
          return (
            <Pressable
              key={task.id}
              disabled={!isInteractive}
              onPress={() => handleToggle(task.id)}
              style={({ pressed }) => [
                styles.taskRow,
                pressed && isInteractive && styles.pressed,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.completed }}
              accessibilityLabel={task.text}
            >
              {/* Check Box Icon */}
              <View
                style={[
                  styles.checkbox,
                  task.completed ? styles.checkedBox : styles.uncheckedBox,
                ]}
              >
                {task.completed && (
                  <Ionicons name="checkmark" size={12} color={colors.textInverse} />
                )}
              </View>

              {/* Task Text */}
              <Text
                style={[
                  styles.taskText,
                  task.completed && styles.taskTextCompleted,
                ]}
              >
                {task.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    width: '100%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  taskList: {
    gap: spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  uncheckedBox: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  taskText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  taskTextCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.7,
  },
});
export default ActionItemCard;
