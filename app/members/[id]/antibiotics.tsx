// app/members/[id]/antibiotics.tsx
// Timeline antibiotik: semua obat yang ditandai antibiotik, lintas episode sakit.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SicknessService } from '../../../services/firestoreService';
import { AcuteMedication, SicknessEpisode } from '../../../types/health';
import ScreenHeader from '../../../components/ScreenHeader';

type WithId<T> = T & { id: string };

function isValidDateObj(d: Date) {
  return !isNaN(d.getTime());
}

function sortKeyOf(m: AcuteMedication): number {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(m.startDate) ? m.startDate : '1970-01-01';
  const time = m.administeredTime && /^\d{2}:\d{2}$/.test(m.administeredTime) ? m.administeredTime : '00:00';
  const d = new Date(`${date}T${time}:00`);
  return isValidDateObj(d) ? d.getTime() : 0;
}

function formatDayHeader(dayKey: string) {
  const d = new Date(`${dayKey}T00:00:00`);
  if (!isValidDateObj(d)) return dayKey;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AntibioticsScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState<WithId<AcuteMedication>[]>([]);
  const [episodes, setEpisodes] = useState<WithId<SicknessEpisode>[]>([]);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const [md, ep] = await Promise.all([
        SicknessService.listAcuteMedications(memberId),
        SicknessService.listEpisodes(memberId),
      ]);
      setMeds(md.filter((m) => m.isAntibiotic));
      setEpisodes(ep);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const episodeTitle = (episodeId: string) => episodes.find((e) => e.id === episodeId)?.title ?? '-';

  // Ringkasan per nama obat
  const byDrug = new Map<string, WithId<AcuteMedication>[]>();
  for (const m of meds) {
    const key = m.name.trim().toLowerCase();
    byDrug.set(key, [...(byDrug.get(key) ?? []), m]);
  }
  const drugSummaries = Array.from(byDrug.values())
    .map((list) => {
      const dates = Array.from(new Set(list.map((m) => m.startDate))).sort();
      return {
        name: list[0].name.trim(),
        count: list.length,
        days: dates.length,
        first: dates[0],
        last: dates[dates.length - 1],
        episodeTitles: Array.from(new Set(list.map((m) => episodeTitle(m.episodeId)))),
      };
    })
    .sort((a, b) => b.last.localeCompare(a.last));

  // Timeline per hari (terbaru di atas), item dalam hari juga terbaru di atas
  const sorted = [...meds].sort((a, b) => sortKeyOf(b) - sortKeyOf(a));
  const byDay = new Map<string, WithId<AcuteMedication>[]>();
  for (const m of sorted) {
    byDay.set(m.startDate, [...(byDay.get(m.startDate) ?? []), m]);
  }
  const dayGroups = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Timeline Antibiotik" fallbackHref={`/members/${memberId}`} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
        {loading ? (
          <ActivityIndicator color="#0F766E" />
        ) : meds.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 border border-dashed border-slate-200">
            <Text className="text-slate-500 text-sm">
              Belum ada antibiotik yang tercatat. Di Catatan Sakit, tambahkan obat lalu tandai sebagai antibiotik.
            </Text>
            <Pressable
              onPress={() => router.push(`/members/${memberId}/sickness`)}
              className="bg-teal-700 rounded-xl py-2.5 px-4 items-center mt-4 self-start"
            >
              <Text className="text-white text-sm font-medium">Buka Catatan Sakit</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="text-slate-700 text-xs font-semibold mb-2">Ringkasan per Obat</Text>
            <View className="gap-2 mb-5">
              {drugSummaries.map((d) => (
                <View key={d.name} className="bg-white rounded-xl border border-slate-100 p-3">
                  <Text className="text-slate-900 text-sm font-semibold">💊 {d.name}</Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5">
                    {d.first === d.last ? d.first : `${d.first} – ${d.last}`} · {d.days} hari · {d.count} catatan
                  </Text>
                  <Text className="text-slate-500 text-[11px]">Episode: {d.episodeTitles.join(', ')}</Text>
                </View>
              ))}
            </View>

            <Text className="text-slate-700 text-xs font-semibold mb-2">Timeline</Text>
            {dayGroups.map(([dayKey, items]) => (
              <View key={dayKey} className="mb-3">
                <Text className="text-slate-500 text-[11px] font-semibold mb-1.5 uppercase">
                  {formatDayHeader(dayKey)}
                </Text>
                <View className="pl-2 border-l-2 border-slate-100 gap-2">
                  {items.map((m) => (
                    <View key={m.id} className="bg-rose-50 rounded-lg p-2.5">
                      <Text className="text-slate-900 text-xs font-medium">
                        💊 {m.name} ({m.form}) — {m.dose}, {m.frequencyPerDay}x/hari
                      </Text>
                      <Text className="text-slate-500 text-[11px] mt-0.5">
                        {m.administeredTime ? `Jam ${m.administeredTime} · ` : ''}
                        {episodeTitle(m.episodeId)}
                      </Text>
                      {m.specialNotes ? <Text className="text-slate-500 text-[11px]">{m.specialNotes}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
