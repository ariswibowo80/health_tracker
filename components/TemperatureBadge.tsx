// components/TemperatureBadge.tsx
// Pill suhu badan berwarna sesuai tingkatnya (normal / hangat / demam / demam tinggi).
import { View, Text } from 'react-native';
import { getTemperatureStatus } from '../utils/temperature';

export default function TemperatureBadge({ celsius }: { celsius: number }) {
  const s = getTemperatureStatus(celsius);
  return (
    <View className={`self-start flex-row items-center rounded-full px-2 py-0.5 ${s.bg}`}>
      <View style={{ backgroundColor: s.color }} className="w-1.5 h-1.5 rounded-full mr-1.5" />
      <Text className={`text-[11px] font-semibold ${s.text}`}>
        {celsius}°C · {s.label}
      </Text>
    </View>
  );
}
