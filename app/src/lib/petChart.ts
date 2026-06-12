// app/src/lib/petChart.ts — 반려동물 명식 보관 (온디바이스, 사람 명식과 분리)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 콘텐츠 '나의 반려동물'. 사람 명식(myChart)과 *따로* 보관 — 궁합/풀이 후보에 섞이지 않게.
//   재미·추정 콘텐츠라 임상셋(사람 사주)과 격리(규칙6). API 0 — 통변은 온디바이스 템플릿(petTraits).
//   생년월일(시 옵션)은 PII → 사람 명식과 동일하게 기기에만(SecureStore/localStorage), 서버 무전송.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ChartInput } from '@spec/chart';

const PET_KEY = 'my_pets_v1';   // SavedPet[]

// 동물 종류 — key=내부/통변 분기, 라벨은 i18n(pet.type.*). 모르는 종류는 'other'.
export const PET_TYPES = ['dog', 'cat', 'rabbit', 'hamster', 'bird', 'fish', 'reptile', 'other'] as const;
export type PetType = (typeof PET_TYPES)[number];

// 반려동물 1마리 = 이름 + 종류 + 사주 입력(생년월일, 시 옵션). timeAccuracy='미상'이면 시주 해석 제외.
export type SavedPet = { id: string; name: string; petType: PetType; input: ChartInput };

async function getRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function setRaw(key: string, val: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(key, val);
  else await SecureStore.setItemAsync(key, val);
}

/** 저장된 반려동물 전체. */
export async function listPets(): Promise<SavedPet[]> {
  const json = await getRaw(PET_KEY);
  return json ? (JSON.parse(json) as SavedPet[]) : [];
}

/** 반려동물 추가 → id 반환. (사람 명식 한도와 무관 — 별도 보관) */
export async function addPet(name: string, petType: PetType, input: ChartInput): Promise<string> {
  const pets = await listPets();
  const id = `p_${Date.now()}`;
  pets.push({ id, name: name.trim() || '우리 아이', petType, input });
  await setRaw(PET_KEY, JSON.stringify(pets));
  return id;
}

/** 반려동물 삭제. */
export async function deletePet(id: string): Promise<void> {
  const pets = await listPets();
  await setRaw(PET_KEY, JSON.stringify(pets.filter((p) => p.id !== id)));
}
