import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioWaveform } from './AudioWaveform';
import { AudioScrubber } from './AudioScrubber';
import { PlaybackSpeedSelector } from './PlaybackSpeedSelector';
import { colors, layout, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface AudioPlayerProps {
  duration: number; // total duration in seconds
  onPlayToggle?: (isPlaying: boolean) => void;
  onSpeedChange?: (speed: number) => void;
  isLoading?: boolean;
  style?: ViewStyle;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  duration = 60,
  onPlayToggle,
  onSpeedChange,
  isLoading = false,
  style,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [progress, setProgress] = useState(0); // float 0 to 1
  const [currentTime, setCurrentTime] = useState(0);

  // Playback timer simulation
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prevTime) => {
          const nextTime = prevTime + 0.1 * playbackSpeed;
          if (nextTime >= duration) {
            setIsPlaying(false);
            setProgress(0);
            if (onPlayToggle) onPlayToggle(false);
            return 0;
          }
          setProgress(nextTime / duration);
          return nextTime;
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, duration, onPlayToggle]);

  const handlePlayToggle = () => {
    triggerHaptic('medium');
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (onPlayToggle) onPlayToggle(newState);
  };

  const handleScrubEnd = (newProgress: number) => {
    setProgress(newProgress);
    setCurrentTime(newProgress * duration);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (onSpeedChange) onSpeedChange(speed);
  };

  return (
    <View style={[styles.playerCard, style]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={handlePlayToggle}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.playPressed,
            isLoading && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause translation audio' : 'Play translation audio'}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={colors.textInverse}
            />
          )}
        </Pressable>

        <View style={styles.waveformContainer}>
          <AudioWaveform progress={progress} barCount={32} height={40} />
        </View>
      </View>

      <AudioScrubber
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        onScrubEnd={handleScrubEnd}
      />

      <View style={styles.divider} />

      <PlaybackSpeedSelector
        currentSpeed={playbackSpeed}
        onSpeedChange={handleSpeedChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  playerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    width: '100%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.95 }],
  },
  waveformContainer: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  disabled: {
    opacity: 0.6,
  },
});
export default AudioPlayer;
