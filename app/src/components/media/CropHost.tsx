// app/src/components/media/CropHost.tsx — 자르기 창을 **화면 뿌리에서** 그린다
// ═══════════════════════════════════════════════════════════════════════════
// `_layout` 의 루트 View 마지막 자식으로 하나만 둔다. 왜 여기냐는 `cropRequest.ts` 참고
// (요약: `absoluteFill` 은 부모를 채우고, 카드는 `ScrollView` 안에 있다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { subscribeCrop, finishCrop, type CropRequest } from '../../lib/media/cropRequest';
import { CropSheet } from './CropSheet';

export function CropHost() {
  const [req, setReq] = useState<CropRequest | null>(null);
  useEffect(() => subscribeCrop((p) => setReq(p?.req ?? null)), []);
  if (!req) return null;
  return (
    <CropSheet
      uri={req.uri}
      aspect={req.aspect}
      outWidth={req.outWidth}
      onDone={(r) => finishCrop(r)}
      onCancel={() => finishCrop(null)}
    />
  );
}
