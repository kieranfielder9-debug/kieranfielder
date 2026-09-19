import { ReactNode, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../theme';

// --- Containers -------------------------------------------------------

type CardProps = { children: ReactNode; style?: ViewStyle };

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function InsetModule({ children, style }: CardProps) {
  return <View style={[styles.insetModule, style]}>{children}</View>;
}

// --- Text ---------------------------------------------------------------

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Meta({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.meta, style]}>{children}</Text>;
}

export function ValueEmphasis({ children }: { children: ReactNode }) {
  return <Text style={styles.valueEmphasis}>{children}</Text>;
}

// --- Form fields -------------------------------------------------------------

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric';
};

export function TextField({ label, value, onChangeText, placeholder, helperText, maxLength, keyboardType }: TextFieldProps) {
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.neutral[300]}
        maxLength={maxLength}
        keyboardType={keyboardType}
      />
      {helperText && <Meta style={{ fontSize: 10 }}>{helperText}</Meta>}
    </View>
  );
}

type ChipSelectProps<T extends string> = { label: string; options: readonly T[]; value: T; onChange: (value: T) => void };

export function ChipSelect<T extends string>({ label, options, value, onChange }: ChipSelectProps<T>) {
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {options.map((option) => (
          <Chip key={option} label={option} active={option === value} onPress={() => onChange(option)} />
        ))}
      </View>
    </View>
  );
}

// --- Rows -----------------------------------------------------------------

type RowProps = { left: ReactNode; right: ReactNode; onPress?: () => void; strong?: boolean };

export function Row({ left, right, onPress, strong }: RowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={[styles.row, strong && styles.rowStrong]} onPress={onPress}>
      <View style={{ flex: 1 }}>{left}</View>
      {right}
    </Wrapper>
  );
}

export function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.neutral[200]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

// --- Buttons ---------------------------------------------------------------

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean; style?: ViewStyle };

export function PrimaryButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable style={[styles.outlineButton, style]} onPress={onPress} disabled={disabled}>
      <Text style={styles.outlineButtonLabel}>{label}</Text>
    </Pressable>
  );
}

// --- Chips / badges ---------------------------------------------------------

type ChipProps = { label: string; active: boolean; onPress: () => void };

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

// --- Callout ----------------------------------------------------------------

export function Callout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.callout}>
      <Text style={styles.calloutText}>{children}</Text>
    </View>
  );
}

// --- Show more / show less --------------------------------------------------

type ShowMoreProps = { hiddenCount: number; children: ReactNode };

export function ShowMore({ hiddenCount, children }: ShowMoreProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      {isOpen && <View style={styles.hiddenItems}>{children}</View>}
      <Pressable style={styles.showMoreRow} onPress={() => setIsOpen((prev) => !prev)}>
        <Text style={styles.showMoreLabel}>
          {isOpen ? 'Show Less' : `Show More (${hiddenCount})`}
        </Text>
      </Pressable>
    </View>
  );
}

// --- Dial gauge (circular progress ring) -------------------------------------

type DialGaugeProps = { percent: number; size?: number };

export function DialGauge({ percent, size = 24 }: DialGaugeProps) {
  const strokeWidth = 2;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const center = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} stroke={theme.colors.neutral[100]} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={theme.colors.neutral[800]}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    </Svg>
  );
}

// --- Track bar (dial-track style linear progress with a knob) ----------------

type TrackBarProps = { percent: number };

export function TrackBar({ percent }: TrackBarProps) {
  return (
    <View style={styles.trackBarWrap}>
      <View style={styles.trackBarBase} />
      <View style={[styles.trackBarFill, { width: `${percent}%` }]} />
      <View style={[styles.trackBarKnob, { left: `${percent}%` }]}>
        <DialGauge percent={percent} size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.neutral[0],
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  insetModule: {
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.radius.md - 2,
    padding: theme.spacing.md,
  },
  sectionTitle: { ...theme.text.t2, color: theme.colors.neutral[800] },
  fieldLabel: { ...theme.text.t3, fontSize: 11, color: theme.colors.neutral[600] },
  field: {
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.radius.md - 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.neutral[800],
  },
  label: { ...theme.text.t3, color: theme.colors.neutral[600] },
  meta: { ...theme.text.t4, color: theme.colors.neutral[400] },
  valueEmphasis: { ...theme.text.t3n, color: theme.colors.neutral[800] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[100],
    borderRadius: theme.radius.md - 4,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.neutral[0],
  },
  rowStrong: { borderColor: theme.colors.neutral[200] },
  primaryButton: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  primaryButtonLabel: { ...theme.text.t3, color: theme.colors.neutral[0] },
  buttonDisabled: { backgroundColor: theme.colors.neutral[100] },
  outlineButton: {
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  outlineButtonLabel: { ...theme.text.t3, color: theme.colors.neutral[800] },
  chip: {
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  chipActive: { backgroundColor: theme.colors.neutral[800], borderColor: theme.colors.neutral[800] },
  chipLabel: { ...theme.text.t3, color: theme.colors.neutral[600] },
  chipLabelActive: { color: theme.colors.neutral[0] },
  badge: {
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  badgeLabel: { ...theme.text.t4, color: theme.colors.neutral[600], fontWeight: '600' },
  callout: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.neutral[50],
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.neutral[100],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.neutral[800],
    borderRadius: theme.radius.md - 6,
    padding: theme.spacing.md,
  },
  calloutText: { ...theme.text.t4, color: theme.colors.neutral[600], flex: 1 },
  hiddenItems: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  showMoreRow: { alignItems: 'center', paddingTop: theme.spacing.sm },
  showMoreLabel: { ...theme.text.t4, color: theme.colors.neutral[600], fontWeight: '600' },
  trackBarWrap: { height: 24, justifyContent: 'center' },
  trackBarBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.neutral[100],
  },
  trackBarFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: theme.colors.neutral[500],
    borderRadius: 2,
  },
  trackBarKnob: { position: 'absolute', transform: [{ translateX: -11 }] },
});
