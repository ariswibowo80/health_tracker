// app/(tabs)/members.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { auth } from '../../services/firebaseConfig';
import { getFamilyMembers } from '../../services/firestoreService';
import { FamilyMember } from '../../types/health';

type WithId<T> = T & { id: string };

export default function MembersScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;
  const [members, setMembers] = useState<WithId<FamilyMember>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      setMembers(await getFamilyMembers(uid));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 md:p-8">
      <View className="flex-row items-center justify-between mb-5">
        <Text className="text-2xl font-bold text-slate-900">Profil Keluarga</Text>
        <Pressable
          onPress={() => router.push('/members/new')}
          className="bg-teal-700 px-4 py-2 rounded-xl"
        >
          <Text className="text-white text-sm font-medium">+ Tambah</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#0F766E" />
      ) : members.length === 0 ? (
        <View className="bg-white rounded-2xl p-8 items-center border border-dashed border-slate-200">
          <Text className="text-slate-500 text-center">Belum ada profil. Tambahkan anggota keluarga pertama Anda.</Text>
        </View>
      ) : (
        <View className={isWideScreen ? 'flex-row flex-wrap gap-3' : 'flex-col gap-3'}>
          {members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/members/${m.id}`)}
              className="bg-white rounded-xl p-4 flex-row items-center border border-slate-100 w-full md:w-[300px]"
            >
              <View
                style={{ backgroundColor: m.avatarColor }}
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
              >
                <Text className="text-white font-bold">{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text className="text-slate-900 font-semibold">{m.name}</Text>
                <Text className="text-slate-500 text-xs capitalize">{m.role}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
