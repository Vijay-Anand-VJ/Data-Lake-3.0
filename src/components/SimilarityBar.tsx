import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme, spacing } from '../theme/theme';

export interface SimilarityBarProps {
  /**
   * The similarity score float, ranging from 0.0 to 1.0.
   */
  score: number;
}

/**
 * A highly-polished animated progress bar showing face match similarity confidence.
 * Color codes:
 * - Green (Success) if >= 0.6
 * - Amber/Orange (Warning) if 0.4 to 0.6
 * - Red (Error) if < 0.4
 */
export const SimilarityBar: React.FC<SimilarityBarProps> = ({ score }) => {
  const { colors, spacing, borderRadius, fontSize } = useAppTheme();
  
  // Safe bounded percentage
  const percentage = Math.min(Math.max(score * 100, 0), 100);

  // Dynamic colors and status text
  let activeColor = colors.error;
  let labelText = 'Weak Match';

  if (score >= 0.6) {
    activeColor = colors.success;
    labelText = 'Match Verified';
  } else if (score >= 0.4) {
    activeColor = colors.warning;
    labelText = 'Low Confidence';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textMuted, fontSize: fontSize.xs }]}>
          SIMILARITY INDEX
        </Text>
        <Text style={[styles.percentage, { color: activeColor, fontSize: fontSize.sm }]}>
          {percentage.toFixed(1)}% — {labelText}
        </Text>
      </View>
      
      <View style={[styles.track, { backgroundColor: colors.border, borderRadius: borderRadius.sm }]}>
        <View
          style={[
            styles.progress,
            {
              width: `${percentage}%`,
              backgroundColor: activeColor,
              borderRadius: borderRadius.sm,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xs + 2,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  percentage: {
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  track: {
    height: 10,
    width: '100%',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
  },
});
export default SimilarityBar;
