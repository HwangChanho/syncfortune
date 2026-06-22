// circular-natal-horoscope-js 타입 선언 — lib 자체 타입 없음(최소 선언). 계산 검증은 결정론 테스트로.
declare module 'circular-natal-horoscope-js' {
  export class Origin {
    constructor(opts: { year: number; month: number; date: number; hour: number; minute: number; latitude: number; longitude: number });
  }
  export class Horoscope {
    constructor(opts: { origin: Origin; houseSystem?: string; zodiac?: string; aspectTypes?: string[]; aspectPoints?: string[]; language?: string });
    CelestialBodies: Record<string, any>;
    Ascendant: any;
    Midheaven?: any;
    Houses: any[];
    Aspects: { all: any[]; types: any; points: any };
  }
}
