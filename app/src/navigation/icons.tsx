import Svg, { Path, Circle } from 'react-native-svg';

type IconProps = { color: string; size?: number };

export function WatchtowerIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20V10M10 20V4M16 20V13M21 20H3" />
    </Svg>
  );
}

export function PlanningIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 5h18v16H3z" />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function HomeIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11l9-8 9 8" />
      <Path d="M5 10v10h5v-6h4v6h5V10" />
    </Svg>
  );
}

export function AllocationIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 3v9l7 4" />
    </Svg>
  );
}

export function MeasurementIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1} />
    </Svg>
  );
}
