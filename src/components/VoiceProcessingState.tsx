import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

export type VoiceProcessingStep = {
  key: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
};

interface VoiceProcessingStateProps {
  steps: VoiceProcessingStep[];
  title?: string;
  style?: ViewStyle;
}

export const VoiceProcessingState: React.FC<VoiceProcessingStateProps> = ({
  steps,
  title = 'Cloning Voice Profile',
  style,
}) => {
  const getStepIcon = (status: VoiceProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <Ionicons name="checkmark-circle" size={20} color={colors.success} />;
      case 'failed':
        return <Ionicons name="close-circle" size={20} color={colors.error} />;
      case 'processing':
        return <ActivityIndicator size="small" color={colors.accentPurple} />;
      case 'pending':
      default:
        return <Feather name="circle" size={18} color={colors.textSubtle} />;
    }
  };

  const getStepTextStyle = (status: VoiceProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return styles.stepTextCompleted;
      case 'processing':
        return styles.stepTextProcessing;
      case 'failed':
        return styles.stepTextFailed;
      case 'pending':
      default:
        return styles.stepTextPending;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.stepsList}>
        {steps.map((step, idx) => (
          <View key={step.key} style={styles.stepRow}>
            {/* Left status icon/loader */}
            <View style={styles.iconContainer}>{getStepIcon(step.status)}</View>

            {/* Step Label */}
            <View style={styles.labelContainer}>
              <Text style={[styles.stepText, getStepTextStyle(step.status)]}>
                {step.label}
              </Text>
            </View>

            {/* Connecting lines for visuals */}
            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.connectingLine,
                  step.status === 'completed'
                    ? styles.lineCompleted
                    : styles.linePending,
                ]}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    width: '100%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  stepsList: {
    paddingLeft: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    zIndex: 2,
    backgroundColor: colors.surface,
  },
  labelContainer: {
    flex: 1,
  },
  stepText: {
    ...typography.body,
    fontSize: 14,
  },
  stepTextCompleted: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  stepTextProcessing: {
    color: colors.accentPurple,
    fontWeight: '600',
  },
  stepTextFailed: {
    color: colors.error,
    fontWeight: '500',
  },
  stepTextPending: {
    color: colors.textMuted,
  },
  connectingLine: {
    position: 'absolute',
    left: 11,
    top: 36, // connect down to next node
    width: 2,
    height: 28,
    zIndex: 1,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  linePending: {
    backgroundColor: colors.border,
  },
});
export default VoiceProcessingState;
