import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme, spacing } from '../theme/theme';

export type BadgeStatus = 'matched' | 'failed' | 'pending' | 'offline' | 'synced';

export interface StatusBadgeProps {
  /**
   * The status string key.
   */
  status: BadgeStatus;
}

/**
 * Premium Status badge display. Renders a colorful capsule chip
 * with optimized colors for light and dark modes.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { colors, spacing, borderRadius, fontSize } = useAppTheme();

  let labelText = '';
  let badgeBackground = '';
  let badgeTextColor = '';

  switch (status) {
    case 'matched':
      labelText = 'MATCHED';
      badgeBackground = colors.successBG;
      badgeTextColor = colors.success;
      break;
    case 'failed':
      labelText = 'MATCHED FAILED';
      badgeBackground = colors.errorBG;
      badgeTextColor = colors.error;
      break;
    case 'pending':
      labelText = 'PENDING SYNC';
      badgeBackground = colors.warningBG;
      badgeTextColor = colors.warning;
      break;
    case 'offline':
      labelText = 'OFFLINE';
      badgeBackground = colors.border;
      badgeTextColor = colors.textMuted;
      break;
    case 'synced':
      labelText = 'SYNCED TO AWS';
      badgeBackground = colors.successBG;
      badgeTextColor = colors.success;
      break;
  }

  return (
    <View style={[styles.container, { backgroundColor: badgeBackground, borderRadius: borderRadius.sm }]}>
      <View style={styles.dotIndicator} />
      <Text style={[styles.text, { color: badgeTextColor, fontSize: fontSize.xs }]}>
        {labelText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: 'currentColor',
    opacity: 0.8,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
export default StatusBadge;
