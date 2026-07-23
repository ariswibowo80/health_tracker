// components/TrendChart.tsx
import { View, Text } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

export interface TrendPoint {
  date: string; // label sumbu-X, sudah diformat pendek (mis. "12 Jul")
  value: number;
}

interface Props {
  title: string;
  unit: string;
  points: TrendPoint[];
  normalMin?: number;
  normalMax?: number;
  color?: string;
  height?: number;
}

/**
 * Grafik garis tren sederhana untuk satu parameter lab, dengan pita area
 * normal (hijau transparan) sebagai referensi visual cepat.
 * Dibangun murni dengan react-native-svg agar identik di Android & Web.
 */
export default function TrendChart({
  title,
  unit,
  points,
  normalMin,
  normalMax,
  color = '#0F766E',
  height = 160,
}: Props) {
  if (points.length === 0) {
    return (
      <View className="bg-white rounded-xl p-4 border border-slate-100">
        <Text className="text-slate-900 font-medium mb-1">{title}</Text>
        <Text className="text-slate-400 text-xs">Belum ada data.</Text>
      </View>
    );
  }

  const width = 320;
  const paddingX = 28;
  const paddingY = 16;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const values = points.map((p) => p.value);
  const dataMin = Math.min(...values, normalMin ?? Infinity);
  const dataMax = Math.max(...values, normalMax ?? -Infinity);
  const rangeMin = dataMin - (dataMax - dataMin || 1) * 0.15;
  const rangeMax = dataMax + (dataMax - dataMin || 1) * 0.15;

  const scaleX = (i: number) =>
    paddingX + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const scaleY = (v: number) =>
    paddingY + chartH - ((v - rangeMin) / (rangeMax - rangeMin || 1)) * chartH;

  const linePoints = points.map((p, i) => `${scaleX(i)},${scaleY(p.value)}`).join(' ');
  const latest = points[points.length - 1];

  return (
    <View className="bg-white rounded-xl p-4 border border-slate-100">
      <View className="flex-row justify-between items-baseline mb-1">
        <Text className="text-slate-900 font-medium">{title}</Text>
        <Text className="text-slate-500 text-xs">
          Terkini: <Text className="font-semibold text-slate-700">{latest.value} {unit}</Text>
        </Text>
      </View>

      <Svg width={width} height={height}>
        {/* Pita area normal */}
        {normalMin !== undefined && normalMax !== undefined && (
          <Line
            x1={paddingX}
            x2={width - paddingX}
            y1={scaleY(normalMax)}
            y2={scaleY(normalMax)}
            stroke="#10B981"
            strokeDasharray="4,4"
            strokeWidth={1}
          />
        )}
        {normalMin !== undefined && (
          <Line
            x1={paddingX}
            x2={width - paddingX}
            y1={scaleY(normalMin)}
            y2={scaleY(normalMin)}
            stroke="#10B981"
            strokeDasharray="4,4"
            strokeWidth={1}
          />
        )}

        {/* Garis tren */}
        <Polyline points={linePoints} fill="none" stroke={color} strokeWidth={2.5} />

        {/* Titik data */}
        {points.map((p, i) => (
          <Circle key={i} cx={scaleX(i)} cy={scaleY(p.value)} r={3.5} fill={color} />
        ))}

        {/* Label sumbu-X (tanggal pertama & terakhir saja agar tidak padat) */}
        <SvgText x={paddingX} y={height - 2} fontSize={9} fill="#94A3B8">
          {points[0].date}
        </SvgText>
        <SvgText x={width - paddingX - 30} y={height - 2} fontSize={9} fill="#94A3B8">
          {points[points.length - 1].date}
        </SvgText>
      </Svg>
    </View>
  );
}
