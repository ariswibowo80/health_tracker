// components/TemperatureChart.tsx
// Grafik garis suhu badan: zona warna latar + titik berwarna per tingkat suhu.
import { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { G, Line, Polyline, Circle, Rect, Text as SvgText } from 'react-native-svg';
import {
  getTemperatureStatus, getStatusByLevel, TEMPERATURE_ZONES,
} from '../utils/temperature';
import { formatShortDateTime } from '../utils/datetime';

export interface TemperaturePoint {
  at: number;  // epoch ms
  celsius: number;
}

const HEIGHT = 170;
const PAD = { top: 12, right: 14, bottom: 26, left: 34 };

export default function TemperatureChart({ points }: { points: TemperaturePoint[] }) {
  const [width, setWidth] = useState(0);
  const data = [...points].sort((a, b) => a.at - b.at);

  if (data.length === 0) {
    return <Text className="text-slate-400 text-xs mb-2">Belum ada data suhu untuk grafik.</Text>;
  }

  const temps = data.map((p) => p.celsius);
  const yMin = Math.floor(Math.min(35.5, ...temps) * 2) / 2;
  const yMax = Math.ceil(Math.max(40, ...temps) * 2) / 2;
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const tMin = data[0].at;
  const tMax = data[data.length - 1].at;
  const xOf = (t: number) =>
    PAD.left + (tMax === tMin ? innerW / 2 : ((t - tMin) / (tMax - tMin)) * innerW);
  const yOf = (c: number) => PAD.top + (1 - (c - yMin) / (yMax - yMin)) * innerH;

  const gridValues: number[] = [];
  for (let v = Math.ceil(yMin); v <= yMax; v += 1) gridValues.push(v);

  const latest = data[data.length - 1];
  const latestStatus = getTemperatureStatus(latest.celsius);

  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-slate-500 text-[11px]">
          {data.length} pengukuran · {formatShortDateTime(tMin)}
          {data.length > 1 ? ` – ${formatShortDateTime(tMax)}` : ''}
        </Text>
        <Text style={{ color: latestStatus.color }} className="text-[11px] font-semibold">
          Terakhir {latest.celsius}°C · {latestStatus.label}
        </Text>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className="bg-white border border-slate-100 rounded-xl">
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {/* zona warna latar */}
            {TEMPERATURE_ZONES.map((z) => {
              const top = Math.max(z.from, yMin);
              const bottom = Math.min(z.to, yMax);
              if (bottom <= top) return null;
              return (
                <Rect
                  key={z.level}
                  x={PAD.left}
                  y={yOf(bottom)}
                  width={innerW}
                  height={yOf(top) - yOf(bottom)}
                  fill={getStatusByLevel(z.level).color}
                  opacity={0.1}
                />
              );
            })}
            {/* garis & label sumbu Y */}
            {gridValues.map((v) => (
              <G key={v}>
                <Line x1={PAD.left} x2={PAD.left + innerW} y1={yOf(v)} y2={yOf(v)} stroke="#CBD5E1" strokeWidth={0.5} />
                <SvgText x={PAD.left - 6} y={yOf(v) + 3} fontSize={9} fill="#64748B" textAnchor="end">
                  {v}°
                </SvgText>
              </G>
            ))}
            {/* garis data */}
            {data.length > 1 && (
              <Polyline
                points={data.map((p) => `${xOf(p.at)},${yOf(p.celsius)}`).join(' ')}
                fill="none"
                stroke="#64748B"
                strokeWidth={1.5}
              />
            )}
            {/* titik berwarna */}
            {data.map((p, i) => (
              <Circle
                key={`${p.at}-${i}`}
                cx={xOf(p.at)}
                cy={yOf(p.celsius)}
                r={4.5}
                fill={getTemperatureStatus(p.celsius).color}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            ))}
            {/* label sumbu X: awal & akhir */}
            <SvgText x={PAD.left} y={HEIGHT - 8} fontSize={9} fill="#64748B" textAnchor="start">
              {formatShortDateTime(tMin)}
            </SvgText>
            {data.length > 1 && (
              <SvgText x={PAD.left + innerW} y={HEIGHT - 8} fontSize={9} fill="#64748B" textAnchor="end">
                {formatShortDateTime(tMax)}
              </SvgText>
            )}
          </Svg>
        )}
      </View>

      {/* legenda */}
      <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {TEMPERATURE_ZONES.map((z) => {
          const s = getStatusByLevel(z.level);
          return (
            <View key={z.level} className="flex-row items-center">
              <View style={{ backgroundColor: s.color }} className="w-2 h-2 rounded-full mr-1" />
              <Text className="text-slate-500 text-[10px]">{s.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
