// components/ScreenHeader.tsx
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

interface Props {
  title: string;
  /** Kalau diisi, dipakai sebagai fallback saat tidak ada riwayat navigasi
   * untuk di-back (mis. saat halaman dibuka langsung lewat URL/refresh). */
  fallbackHref?: string;
}

export default function ScreenHeader({ title, fallbackHref }: Props) {
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else if (fallbackHref) {
      router.replace(fallbackHref as any);
    } else {
      router.replace('/');
    }
  }

  return (
    <View className="flex-row items-center bg-white border-b border-slate-100 px-4 py-3 md:px-8">
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        className="w-9 h-9 rounded-full items-center justify-center mr-2 web:hover:bg-slate-100"
      >
        <Text className="text-xl text-slate-700">←</Text>
      </Pressable>
      <Text className="text-lg font-semibold text-slate-900">{title}</Text>
    </View>
  );
}
