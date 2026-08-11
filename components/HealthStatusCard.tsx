// components/HealthStatusCard.tsx
import { View, Text, Pressable } from 'react-native';
import { MemberHealthSummary } from '../services/firestoreService';
import { getLabStatus, STATUS_COLOR_MAP, REFERENCE_RANGES } from '../constants/referenceRanges';
import { LabParameterKey } from '../types/health';
import { formatAge } from '../utils/age';

interface Props {
  summary: MemberHealthSummary;
  onPress?: () => void;
}

export default function HealthStatusCard({ summary, onPress }: Props) {
  const { member, activeSickness, latestLab, lowStockMeds, latestWeight } = summary;
  const ageLabel = formatAge(member.birthDate);

  // Ambil maksimal 3 parameter lab paling relevan untuk preview cepat
  const previewKeys: LabParameterKey[] = member.role === 'anak'
    ? []
    : ['glukosaPuasa', 'kolesterolTotal', 'asamUrat'];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 web:hover:shadow-md web:transition-shadow w-full md:w-[340px]"
    >
      {/* Header profil */}
      <View className="flex-row items-center mb-3">
        <View
          style={{ backgroundColor: member.avatarColor }}
          className="w-11 h-11 rounded-full items-center justify-center mr-3"
        >
          <Text className="text-white font-bold text-base">
            {member.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-slate-900 font-semibold text-base">{member.name}</Text>
          <Text className="text-slate-500 text-xs">
            {member.role === 'anak' ? 'Anak' : member.role === 'lansia' ? 'Lansia' : 'Dewasa'} · {ageLabel}
          </Text>
        </View>

        {activeSickness && (
          <View className="bg-red-50 px-2 py-1 rounded-full">
            <Text className="text-red-600 text-[11px] font-medium">Sedang Sakit</Text>
          </View>
        )}
      </View>

      {/* Status sakit aktif */}
      {activeSickness && (
        <View className="bg-red-50/60 rounded-xl px-3 py-2 mb-2">
          <Text className="text-red-700 text-xs font-medium">{activeSickness.title}</Text>
          <Text className="text-red-600 text-[11px] mt-0.5">
            {activeSickness.mainComplaints.join(', ')}
          </Text>
        </View>
      )}

      {/* Preview parameter lab (dewasa) */}
      {previewKeys.length > 0 && latestLab && (
        <View className="flex-row flex-wrap gap-2 mb-2">
          {previewKeys.map((key) => {
            const val = latestLab.values[key];
            if (val === undefined) return null;
            const status = getLabStatus(key, val);
            const colors = STATUS_COLOR_MAP[status];
            return (
              <View key={key} className={`rounded-lg px-2 py-1 ${colors.bg}`}>
                <Text className={`text-[10px] ${colors.text}`}>
                  {REFERENCE_RANGES[key].label}
                </Text>
                <Text className={`text-xs font-semibold ${colors.text}`}>
                  {val} {REFERENCE_RANGES[key].unit}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Info tambahan: berat badan & stok obat rendah */}
      <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
        <Text className="text-slate-500 text-xs">
          {latestWeight ? `Berat: ${latestWeight} kg` : 'Belum ada data berat'}
        </Text>
        {lowStockMeds.length > 0 && (
          <Text className="text-amber-600 text-xs font-medium">
            ⚠ {lowStockMeds.length} obat menipis
          </Text>
        )}
      </View>
    </Pressable>
  );
}
